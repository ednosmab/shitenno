/**
 * daemon/engine-init.ts — Engine initialization for the daemon
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { initializeRuleEngine } from "../rule-engine/engine.js";
import { initializeProactiveEngine } from "../prioritization/triggers.js";
import { initDesktopNotifier } from "../desktop-notifier.js";
import { initAutoBriefing } from "../auto-briefing.js";
import { initProactiveDigest } from "../proactive-digest.js";
import { initializeKnowledgeGraph } from "../knowledge-graph.js";
import { startWatching } from "../infrastructure/persistence/file-watcher.js";
import { daemonLog } from "./log-rotation.js";
import { initializeSemanticJournal } from "./semantic-runner.js";
import { setupResourceArbitration } from "./event-handlers.js";
import type { DaemonContext } from "./pid-manager.js";

// ── Engine Initialization ───────────────────────────────────────────────────

function initEngines(ctx: DaemonContext): { stopProactive: () => void; isResourceClaimed: (id: string) => boolean } {
  const isResourceClaimed = setupResourceArbitration(ctx);

  initializeRuleEngine(ctx.projectRoot, ctx.shitennoDir, isResourceClaimed);
  daemonLog(ctx.logPath, "INFO", "Rule engine initialized — subscribed to event bus");

  const stopProactive = initializeProactiveEngine(ctx.projectRoot, ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Proactive engine initialized — subscribed to event bus");

  initDesktopNotifier(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Desktop notifier initialized — subscribed to lifecycle events");

  initAutoBriefing(ctx.projectRoot, ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Auto-briefing initialized — will generate BRIEFING.md on session start");

  const stopDigest = initProactiveDigest(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Proactive digest initialized — periodic summary every 30min");

  initializeSemanticJournal(ctx);

  return { stopProactive: () => { stopProactive(); stopDigest(); }, isResourceClaimed };
}

export function initializeDaemonEngines(ctx: DaemonContext, resolvedProjectRoot: string): void {
  ctx.stopWatcher = startWatching(ctx.shitennoDir, {
    watchSourceCode: process.env.SHITENNO_WATCH_SOURCE === "1",
    projectRoot: resolvedProjectRoot,
    watchGitEvents: process.env.SHITENNO_WATCH_GIT === "1",
  });
  const { stopProactive } = initEngines(ctx);
  ctx.stopProactive = stopProactive;

  try {
    initializeKnowledgeGraph(ctx.shitennoDir);
    daemonLog(ctx.logPath, "INFO", "Knowledge graph initialized — subscribed to adr/skill/capability events");
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Knowledge graph init failed: ${err}`);
  }
}
