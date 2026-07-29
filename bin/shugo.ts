#!/usr/bin/env node

import { Command } from "commander";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";

// NOTE: command modules and the heavy engine initializers are NOT imported
// statically here. They are loaded on demand (see the command registration
// block and `ensureHeavyBootstrap`) so that lightweight commands never pay the
// cost of loading or initializing subsystems they don't use.

import { getEventBus, enableEventPersistence } from "../src/event-bus.js";
import { startSession, endSession } from "../src/session-tracker.js";
import { setSessionContext, clearSessionContext } from "../src/session-context.js";
import { installMiddleware } from "../src/cli-middleware.js";
import { setGlobalJsonMode, isGlobalJsonMode, output as outputCli } from "../src/output.js";
import { stopWatching } from "../src/infrastructure/persistence/file-watcher.js";
import { COMMAND_CATEGORIES, findCommand } from "../src/help-data.js";
import { SHITENNO_DIR_NAME } from "../src/constants.js";
import { initDesktopNotifier } from "../src/desktop-notifier.js";
import { resolveBacklogPaths } from "../src/backlog-core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Walk up from startDir to find the directory containing package.json.
 * Works in both dev (tsx) and bundled (dist/bin/) modes.
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== dirname(dir)) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return process.cwd();
}

const packageRoot = findPackageRoot(__dirname);
const { version } = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf-8"));

// ── Event-Driven Bootstrap (lazy) ───────────────────────────────────────────

const projectRoot = process.cwd();
const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
const isInitialized = existsSync(shitennoDir);

let currentSessionId: string | null = null;
let currentSessionStartedAt: string | null = null;

// Lightweight session start (cheap) — runs for every initialized invocation so
// that middleware telemetry and session-context consumers (feedback/console)
// keep working. The expensive engine initialization below is deferred to
// `ensureHeavyBootstrap()` and only runs for commands that depend on it.
if (isInitialized) {
  const session = startSession(shitennoDir);
  currentSessionId = session.id;
  currentSessionStartedAt = session.startedAt;
  setSessionContext(session.id, session.startedAt);

  // Desktop notifications for lifecycle events (session end, task completed, etc.)
  initDesktopNotifier(shitennoDir);
}

// Commands whose execution actually depends on the initialized engines
// (rule-engine, knowledge-graph, capability-engine, task-pipeline,
// engineering-state, proactive-engine, model-config, doc-sync, plan-backlog-sync).
// All other commands are "light" and skip the heavy bootstrap entirely.
const HEAVY_COMMANDS = new Set([
  "audit",
  "status",
  "mcp",
  "history",
  "doctor",
  "context",
]);

let heavyBootstrapDone = false;

// Commands that need the plan-backlog retroactive scan (plan ↔ BACKLOG.md sync).
// Mantido separado de HEAVY_COMMANDS porque plan subcommands são leves —
// não precisam do rule-engine, knowledge-graph etc., só da sincronia backlog.
const PLAN_BACKLOG_COMMANDS = new Set([
  "plan list",
  "plan show",
  "plan create",
  "plan status",
  "plan done",
  "plan prepare",
  "plan lifecycle",
]);

/**
 * Full space-separated command path (ex: "plan status", "status", "daemon status").
 * Usar isso em vez de actionCommand.name() evita colisão entre uma folha
 * "status" de um subcomando (ex: `plan status`) e o comando raiz "status".
 */
function fullCommandPath(cmd: import("commander").Command): string {
  const parts: string[] = [];
  let c: import("commander").Command | null = cmd;
  while (c && c.parent) {
    parts.unshift(c.name());
    c = c.parent;
  }
  return parts.join(" ");
}

/**
 * Idempotent, on-demand initialization of the heavy subsystems. Previously this
 * ran unconditionally at module top-level on every CLI invocation (even for
 * commands that never touch those subsystems). Now it runs only when a command
 * that needs it is actually executed.
 */
async function ensureHeavyBootstrap(): Promise<void> {
  if (heavyBootstrapDone || !isInitialized) return;
  heavyBootstrapDone = true;

  const { initializeRules, initializeRuleEngine } = await import("../src/rule-engine.js");
  const { initializeKnowledgeGraph } = await import("../src/knowledge-graph.js");
  const { initializeCapabilityEngine } = await import("../src/capability-engine.js");
  const { initializeEngineeringState, consolidateEngineeringState } = await import("../src/engineering-state.js");
  const { initializeProactiveEngine } = await import("../src/prioritization/triggers.js");
  const { initializeFromAnswers } = await import("../src/model-config.js");
  const { registerDocSyncHook } = await import("../src/doc-sync-hook.js");
  const { DocEngine } = await import("../src/doc-engine.js");
  const { initPlanBacklogSync } = await import("../src/plan-backlog-sync.js");

  enableEventPersistence(shitennoDir);
  getEventBus().enableDeadLetterQueue(shitennoDir);
  initializeRules(shitennoDir);
  initializeRuleEngine(projectRoot, shitennoDir);
  initializeKnowledgeGraph(shitennoDir);
  initializeCapabilityEngine(projectRoot, shitennoDir);
  initializeEngineeringState(projectRoot, shitennoDir);
  initializeProactiveEngine(projectRoot, shitennoDir);
  initializeFromAnswers(shitennoDir);
  registerDocSyncHook({ projectRoot, enableAutoSync: true });

  const docEngine = new DocEngine(shitennoDir);
  const bus = getEventBus();
  bus.subscribe("engineering_state.consolidated", () => {
    const state = consolidateEngineeringState(projectRoot, shitennoDir);
    docEngine.generateAll(state);
  });

  // Skip watcher + briefing in child processes (avoids deadlock via rule engine)
  if (!process.env.SHITENNO_CHILD) {
    let branch: string | undefined;
    try {
      branch = execSync("git branch --show-current", {
        encoding: "utf-8",
        timeout: 2000,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      // not a git repo or git not available — skip
    }

    getEventBus().publish("session.start", {
      sessionId: currentSessionId,
      projectRoot,
      agentName: branch,
    });

    // Register sync subscribers (watcher started by watch command or other long-running commands)
    initPlanBacklogSync(projectRoot, shitennoDir);

    await showBriefingSummary(projectRoot, shitennoDir);
  }
}

/**
 * Show Quick Board in the terminal from context_buffer.yaml.
 * Regenerates BRIEFING.md if stale (> 1 day old) for other consumers.
 */
async function autoRegenerateBriefing(projectRoot: string, shitennoDir: string): Promise<void> {
  const briefingPath = join(shitennoDir, "BRIEFING.md");
  if (!existsSync(briefingPath)) return;

  const { statSync } = await import("node:fs");
  const stat = statSync(briefingPath);
  const ageMs = Date.now() - stat.mtimeMs;
  if (ageMs <= 86400000) return;

  const { collectContext } = await import("../src/context-collector.js");
  const { briefingToMarkdown } = await import("../src/briefing.js");
  const { writeFileSync } = await import("node:fs");
  const snapshot = collectContext(projectRoot, shitennoDir);
  const md = briefingToMarkdown(snapshot.briefing);
  writeFileSync(briefingPath, md, "utf-8");
}

function resolveSessionStatus(data: Record<string, unknown>): string {
  const status = (data?.session as Record<string, unknown>)?.status;
  if (status === "completed") return "Concluída";
  if (status === "in_progress" || status === "active") return "Em curso";
  return "Desconhecido";
}

function resolveP1Debts(data: Record<string, unknown>): string {
  const debts = data?.technical_debt as Array<{ priority?: string; severity?: string; description: string }> | undefined;
  if (!debts?.length) return "Nenhuma";
  return debts
    .filter((d) => d.priority === "P1" || d.severity === "high")
    .map((d) => d.description)
    .join(", ") || "Nenhuma";
}

function resolveNextP0(shitennoDir: string, fallback: string): string {
  const { active: backlogPath } = resolveBacklogPaths(shitennoDir);
  if (!existsSync(backlogPath)) return fallback;

  const backlog = readFileSync(backlogPath, "utf-8");
  const p0Section = backlog.split(/^## P0 /m)?.[1]?.split(/^## P1 /m)?.[0] ?? "";
  const p0Items = p0Section.split(/^### /m).slice(1);

  for (const item of p0Items) {
    const title = item.split("\n")[0]?.trim();
    if (title && item.includes("| **Status** | In Progress")) return title;
  }
  return fallback;
}

async function showBriefingSummary(projectRoot: string, shitennoDir: string): Promise<void> {
  if (isGlobalJsonMode()) return;
  try {
    await autoRegenerateBriefing(projectRoot, shitennoDir);

    const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
    if (!existsSync(bufferPath)) return;

    const { parse: parseYaml } = await import("yaml");
    const data = parseYaml(readFileSync(bufferPath, "utf-8")) || {};

    const currentTask = data?.current_task?.description
      ? `${data.current_task.description} (${data.current_task.status})`
      : "Nenhuma";

    const sessionStatus = resolveSessionStatus(data);
    const p1Debts = resolveP1Debts(data);
    let nextP0 = data?.next_p0 || "Definir";
    try {
      nextP0 = resolveNextP0(shitennoDir, nextP0);
    } catch {
      // Ignore read errors
    }

    outputCli("");
    outputCli(chalk.gray("  📋 Quick Board:"));
    outputCli(chalk.gray(`     Tarefa: ${currentTask} | P0: ${nextP0}`));
    outputCli(chalk.gray(`     Dívidas P1: ${p1Debts} | Estado: ${sessionStatus}`));
    outputCli("");
  } catch {
    // Quick Board not available — skip silently
  }
}

// ── CLI Program ─────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("shugo")
  .description("AI governance ecosystem that grows with your project")
  .version(version)
  .option("--quiet", "Suppress informational output (errors only)")
  .option("--no-color", "Disable colored output")
  .hook("preAction", () => {
    const globalOpts = program.opts();
    if (globalOpts.quiet) {
      process.env.SHITENNO_QUIET = "1";
    }
    if (globalOpts.color === false) {
      chalk.level = 0;
    }
    // Set global JSON mode early — suppresses output() for all modules
    setGlobalJsonMode(process.argv.includes("--json"));
  });

// ── Custom Help Formatting ──────────────────────────────────────────────────

program.configureHelp({
  sortSubcommands: false,
  formatHelp(_cmd, _helper) {
    let output = "";
    output += `${chalk.bold.cyan("shugo")} ${chalk.gray("— AI governance ecosystem")}\n\n`;

    // Usage
    output += `${chalk.bold("Usage:")}\n`;
    output += `  shugo <command> [options]\n\n`;

    output += `${chalk.bold("Quick Start:")}\n`;
    output += `  shugo --help            ${chalk.gray("Show all commands")}\n`;
    output += `  shugo --help <command>  ${chalk.gray("Show help for a command")}\n`;
    output += `  shugo --version         ${chalk.gray("Show version")}\n\n`;

    // Command categories
    for (const category of COMMAND_CATEGORIES) {
      output += `${chalk.bold.green(category.name)}\n`;
      output += `${chalk.gray(`  ${category.description}`)}\n`;

      for (const cmd of category.commands) {
        const name = cmd.name.padEnd(14);
        output += `  ${chalk.cyan(name)} ${chalk.gray(cmd.description)}\n`;
      }
      output += "\n";
    }

    return output;
  },
});

// ── Help Command ─────────────────────────────────────────────────────────────

const helpCmd = new Command("help")
  .description("Show help for a specific command")
  .argument("[command]", "Command name to get help for")
  .action((cmdName: string | undefined) => {
    if (!cmdName) {
      program.help();
      return;
    }

    const cmd = findCommand(cmdName);
    if (!cmd) {
      outputCli(chalk.red(`  Unknown command: ${cmdName}`));
      outputCli(chalk.gray("  Run 'shugo --help' to see all available commands."));
      process.exitCode = 1;
      return;
    }

    outputCli("");
    outputCli(`${chalk.bold.cyan(`shugo ${cmd.name}`)} — ${cmd.description}`);
    outputCli("");
    outputCli(`${chalk.bold("Usage:")}`);
    outputCli(`  ${cmd.usage}`);
    outputCli("");

    if (cmd.examples.length > 0) {
      outputCli(`${chalk.bold("Examples:")}`);
      for (const ex of cmd.examples) {
        outputCli(`  ${chalk.gray(ex)}`);
      }
      outputCli("");
    }

    if (cmd.tips && cmd.tips.length > 0) {
      outputCli(`${chalk.bold("Tips:")}`);
      for (const tip of cmd.tips) {
        outputCli(`  ${chalk.yellow("→")} ${tip}`);
      }
      outputCli("");
    }

    // Show Commander.js help for options
    const registeredCmd = program.commands.find((c) => c.name() === cmdName);
    if (registeredCmd) {
      outputCli(`${chalk.bold("Options:")}`);
      outputCli(registeredCmd.helpInformation());
    }
  });

program.addCommand(helpCmd);

program.addCommand((await import("../src/commands/init.js")).initCommand);
program.addCommand((await import("../src/commands/status.js")).statusCommand);
program.addCommand((await import("../src/commands/upgrade.js")).upgradeCommand);
program.addCommand((await import("../src/commands/validate.js")).validateCommand);
program.addCommand((await import("../src/commands/detect.js")).detectCommand);
program.addCommand((await import("../src/commands/audit.js")).auditCommand);
program.addCommand((await import("../src/commands/clean.js")).cleanCommand);
program.addCommand((await import("../src/commands/assess.js")).assessCommand);
program.addCommand((await import("../src/commands/doctor.js")).doctorCommand);
program.addCommand((await import("../src/commands/run.js")).runCommand);
program.addCommand((await import("../src/commands/evolve.js")).evolveCommand);
program.addCommand((await import("../src/commands/report.js")).reportCommand());
program.addCommand((await import("../src/commands/digest.js")).digestCommand());
program.addCommand((await import("../src/commands/briefing.js")).briefingCommand());
program.addCommand((await import("../src/commands/feedback.js")).feedbackCommand());
program.addCommand((await import("../src/commands/bench.js")).benchCommand());
program.addCommand((await import("../src/commands/dashboard.js")).dashboardCommand());
program.addCommand((await import("../src/commands/profile.js")).profileCommand());
program.addCommand((await import("../src/commands/goal.js")).goalCommand());
program.addCommand((await import("../src/commands/decide.js")).decideCommand());
program.addCommand((await import("../src/commands/policy.js")).policyCommand());
program.addCommand((await import("../src/commands/act.js")).actCommand());
program.addCommand((await import("../src/commands/plan.js")).planCommand());
program.addCommand((await import("../src/commands/console.js")).consoleCommand());
program.addCommand((await import("../src/commands/shell-init.js")).shellInitCommand);
program.addCommand((await import("../src/commands/docs-audit.js")).docsAuditCommand);
program.addCommand((await import("../src/commands/update.js")).updateCommand);
program.addCommand((await import("../src/commands/mcp.js")).mcpCommand());
program.addCommand((await import("../src/commands/sync.js")).syncCommand);
program.addCommand((await import("../src/commands/reminders.js")).remindersCommand());
program.addCommand((await import("../src/commands/history.js")).historyCommand);
program.addCommand((await import("../src/commands/events.js")).eventsCommand);
program.addCommand((await import("../src/commands/context.js")).contextCommand);
program.addCommand((await import("../src/commands/handbook.js")).handbookCommand);
program.addCommand((await import("../src/commands/hooks.js")).hooksCommand);
program.addCommand((await import("../src/commands/backlog.js")).backlogCommand);
program.addCommand((await import("../src/commands/daemon.js")).daemonCommand());
program.addCommand((await import("../src/commands/scheduled-check.js")).internalScheduledCheckCommand);

// ── Middleware Pipeline ──────────────────────────────────────────────────────

installMiddleware(program, {
  projectRoot,
  shitennoDir,
  sessionId: currentSessionId,
});

// Lazy heavy bootstrap: only commands that depend on the initialized engines
// pay the cost. Light commands (validate, detect, act, run, briefing, ...) skip
// the entire initialize* chain, git branch probe, and briefing entirely.
program.hook("preAction", async (_thisCommand, actionCommand) => {
  if (HEAVY_COMMANDS.has(fullCommandPath(actionCommand))) {
    await ensureHeavyBootstrap();
  }
});

// Lazy plan-backlog retroactive scan: só roda para comandos que tocam backlog
// (plan list, plan show, plan create, etc.). Separado do HEAVY_COMMANDS porque
// plan subcommands são leves — não precisam do bootstrap pesado, só da scan.
let planBacklogScanDone = false;
program.hook("preAction", async (_thisCommand, actionCommand) => {
  if (planBacklogScanDone) return;
  if (PLAN_BACKLOG_COMMANDS.has(fullCommandPath(actionCommand)) && isInitialized) {
    planBacklogScanDone = true;
    const { runRetroactiveScan } = await import("../src/plan-backlog-sync.js");
    runRetroactiveScan(projectRoot, shitennoDir);
  }
});

await program.parseAsync();

// ── Post-Execution: Session End ─────────────────────────────────────────────

if (isInitialized && currentSessionId) {
  const bus = getEventBus();
  const endedAt = new Date();
  const duration = currentSessionStartedAt
    ? endedAt.getTime() - new Date(currentSessionStartedAt).getTime()
    : 0;
  bus.publish("session.end", {
    sessionId: currentSessionId,
    duration,
    outcome: "success",
  });
  endSession(shitennoDir, currentSessionId);
  clearSessionContext();
  if (!process.env.SHITENNO_CHILD) {
    stopWatching();
  }
}
