/**
 * cli-middleware.ts — Pre/Post Command Hooks for CLI
 *
 * Uses Commander.js native preAction/postAction hooks to provide:
 * - Command tracking (session telemetry)
 * - Plugin loading (project + global)
 * - Event bus integration (pre/post analysis events)
 *
 * PRINCIPLE: Cross-cutting concerns belong in middleware, not in commands.
 */

import { Command } from "commander";
import { existsSync } from "node:fs";
import { getEventBus } from "../../infrastructure/event-bus.js";
import { logger } from "../../shared/logger.js";
import { trackCommand } from "../../infrastructure/session-tracker.js";
import { loadPlugins, getHookBus } from "../../infrastructure/plugin-system.js";
import { isDaemonRunning, startDaemon, shouldSkipDaemon, getApprovedPath } from "../../infrastructure/daemon-client.js";
import { DaemonCircuitBreaker } from "../../infrastructure/daemon-circuit-breaker.js";
import { createFileStorage, recordOutcome } from "../../infrastructure/session-feedback.js";
import { initAutoBriefing } from "../../application/auto-briefing.js";

// ── Types ────────────────────────────────────────────────────────────────────

export interface MiddlewareContext {
  projectRoot: string;
  shitennoDir: string;
  sessionId: string | null;
}

// ── Sensitive Command Detection ────────────────────────────────────────────

const SENSITIVE_COMMAND_PATTERNS = [
  /commit/i,
  /push/i,
  /delete/i,
  /rm\b/i,
  /force/i,
];

function isSensitiveCommand(commandName: string, args?: string[]): boolean {
  const full = `${commandName} ${(args ?? []).join(" ")}`;
  return SENSITIVE_COMMAND_PATTERNS.some((pattern) => pattern.test(full));
}

// ── Plugin Loader ────────────────────────────────────────────────────────────

let pluginsLoaded = false;

/** Load plugins once per process. Safe to call multiple times. */
export async function ensurePluginsLoaded(projectRoot: string): Promise<void> {
  if (pluginsLoaded) return;

  const plugins = await loadPlugins(projectRoot);
  const hookBus = getHookBus();

  for (const plugin of plugins) {
    hookBus.registerPlugin(plugin);
  }

  pluginsLoaded = true;
}

// ── Middleware Setup ──────────────────────────────────────────────────────────

/**
 * Install preAction/postAction hooks on a Commander program.
 * Every subcommand will automatically:
 * 1. Track the command in the session
 * 2. Load plugins on first invocation
 * 3. Execute pre/post analysis hooks
 * 4. Publish analysis.complete events
 */
function handlePreAction(ctx: MiddlewareContext, resolvedSessionId: string, sessionStartedRef: { value: boolean }) {
  // NOTE: Commander.js v13 preAction hook signature is (thisCommand, actionCommand)
  // where thisCommand = the command the hook is installed on (root program),
  // and actionCommand = the command whose action is actually being executed.
  // We MUST use actionCommand for command identification and daemon guard.
  return async (_thisCommand: Command, actionCommand: Command) => {
    const commandName = actionCommand.name();
    if (ctx.sessionId) trackCommand(ctx.shitennoDir, ctx.sessionId, commandName);
    if (!sessionStartedRef.value) {
      sessionStartedRef.value = true;
      getEventBus().publish("session.start", { sessionId: resolvedSessionId, projectRoot: ctx.projectRoot });
      // Auto-briefing fallback: generate BRIEFING.md if daemon is not running
      if (!isDaemonRunning(ctx.shitennoDir)) {
        try { initAutoBriefing(ctx.projectRoot, ctx.shitennoDir); } catch (err) {
          logger.debug("middleware", `Auto-briefing fallback failed: ${err}`);
        }
      }
    }
    await ensurePluginsLoaded(ctx.projectRoot);
    if (isSensitiveCommand(commandName, actionCommand.args)) {
      getEventBus().publish("action.pre_sensitive", { command: commandName, args: actionCommand.args, reminder: "MANDATORY RULES: Consult FORBIDDEN_OPERATIONS.md before proceeding. G-01: No commit without explicit authorization." });
    }
    tryAutoStartDaemon(ctx.shitennoDir, actionCommand);
    await getHookBus().executeHook("pre-analysis", { command: commandName, projectRoot: ctx.projectRoot }, (_plugin, input) => input);
  };
}

function isDescendantOfCommand(cmd: Command, name: string): boolean {
  let c: Command | null = cmd;
  while (c) {
    if (c.name() === name) return true;
    c = c.parent;
  }
  return false;
}

function tryAutoStartDaemon(shitennoDir: string, command: Command) {
  if (shouldSkipDaemon() || isDescendantOfCommand(command, "daemon")) return;
  try {
    const breaker = new DaemonCircuitBreaker(shitennoDir);
    const approvedPath = getApprovedPath(shitennoDir);
    if (existsSync(approvedPath) && !breaker.isTripped() && !isDaemonRunning(shitennoDir)) {
      startDaemon(shitennoDir).catch((err) => logger.debug("middleware", `Daemon auto-start failed: ${err}`));
    }
  } catch (err) {
    logger.debug("middleware", `Auto-start daemon check failed: ${err}`);
  }
}

interface PostActionInput { ctx: MiddlewareContext; preActionTimestampRef: { value: number }; sessionEndedRef: { value: boolean };
  resolvedSessionId: string; sessionStartTime: number; }

function handlePostAction(input: PostActionInput) {
  const { ctx, preActionTimestampRef, sessionEndedRef, resolvedSessionId, sessionStartTime } = input;
  return async (thisCommand: Command) => {
    const commandName = thisCommand.name();
    const duration = preActionTimestampRef.value ? Date.now() - preActionTimestampRef.value : 0;
    await getHookBus().executeHook("post-analysis", { command: commandName, projectRoot: ctx.projectRoot, success: true, duration }, (_plugin, input) => input);
    getEventBus().publish("command.completed", { command: commandName, projectRoot: ctx.projectRoot, timestamp: new Date().toISOString(), duration });
    if (!sessionEndedRef.value && commandName !== "feedback") {
      sessionEndedRef.value = true;
      const sessionDuration = Date.now() - sessionStartTime;
      const outcome = process.exitCode && process.exitCode !== 0 ? "failed" : "success";
      getEventBus().publish("session.end", { sessionId: resolvedSessionId, duration: sessionDuration, outcome });
    }
    if (!ctx.sessionId) return;
    const storage = createFileStorage(ctx.shitennoDir);
    recordOutcome(storage, {
      outcome: "success",
      briefingHash: "",
      briefingTimestamp: "",
      sessionId: ctx.sessionId,
      durationMinutes: Math.round(duration / 60000),
    });
  };
}
export function installMiddleware(program: Command, ctx: MiddlewareContext): void {
  const resolvedSessionId = ctx.sessionId ?? `cli-${Date.now()}`;
  const sessionStartedRef = { value: false };
  const sessionEndedRef = { value: false };
  const sessionStartTime = Date.now();
  const preActionTimestampRef = { value: 0 };

  program.hook("preAction", handlePreAction(ctx, resolvedSessionId, sessionStartedRef));
  program.hook("preAction", () => { preActionTimestampRef.value = Date.now(); });
  program.hook("postAction", handlePostAction({ ctx, preActionTimestampRef, sessionEndedRef, resolvedSessionId, sessionStartTime }));
}
