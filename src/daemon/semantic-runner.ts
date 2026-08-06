/**
 * daemon/semantic-runner.ts — Semantic pattern matching and insight generation
 *
 * Extracted from daemon/index.ts to keep modules focused.
 */

import { getEventBus } from "../infrastructure/event-bus.js";
import { classifyEvent } from "../semantic/signal-classifier.js";
import { getChangeJournal, resetChangeJournal } from "../semantic/change-journal.js";
import { getPatternMatcher, resetPatternMatcher } from "../semantic/pattern-matcher.js";
import { loadSemanticGrowthProfile } from "../semantic/growth-profile.js";
import { generateInsights, resetSemanticReasoner } from "../semantic/reasoner.js";
import { detectCorrelations, resetSemanticCorrelator } from "../semantic/correlator.js";
import { daemonLog } from "./log-rotation.js";
import type { DaemonContext } from "./pid-manager.js";

// ── Journal Initialization ──────────────────────────────────────────────────

const ALL_EVENT_TYPES = [
  "session.start", "session.end", "analysis.complete", "command.completed",
  "score.calculated", "pattern.detected", "health.checked", "debt.detected",
  "capability.installed", "capability.unlocked", "maturity.changed",
  "rule.triggered", "evolution.recommended", "adr.created", "skill.created",
  "validation.completed", "task.completed", "pipeline.complete",
  "engineering_state.consolidated", "knowledge_debt.detected",
  "plan.status_changed", "plan.created", "plan.file_changed",
  "source.changed", "source.file_added", "source.file_deleted",
  "git.branch_changed", "git.commit_detected", "git.ref_updated",
  "challenge.generated", "audit.standard",
] as const;

export function initializeSemanticJournal(ctx: DaemonContext): void {
  const journal = getChangeJournal(ctx.shitennoDir, ctx.state.startedAt);
  const bus = getEventBus();

  bus.enableDeadLetterQueue(ctx.shitennoDir);
  daemonLog(ctx.logPath, "INFO", "Dead letter queue enabled — async errors will be captured");

  for (const eventType of ALL_EVENT_TYPES) {
    bus.subscribe(eventType, (payload) => {
      try {
        const event = { type: eventType, payload, timestamp: new Date().toISOString(), traceId: crypto.randomUUID() };
        const classification = classifyEvent(event);
        const files = Array.isArray((payload as Record<string, unknown>).affectedFiles)
          ? (payload as Record<string, unknown>).affectedFiles as string[]
          : typeof (payload as Record<string, unknown>).file === "string"
            ? [(payload as Record<string, unknown>).file as string]
            : [];
        journal.add(classification, 1, files, [classification.signals[0] ?? "source.changed"]);
      } catch {
        // Classification failure should not break the daemon
      }
    });
  }
  daemonLog(ctx.logPath, "INFO", "Semantic journal initialized — classifying events into journal");
}

// ── Semantic Cycle ──────────────────────────────────────────────────────────

export function runSemanticCycle(ctx: DaemonContext): void {
  try {
    const journal = getChangeJournal(ctx.shitennoDir, ctx.state.startedAt);
    const matcher = getPatternMatcher(journal);
    const patterns = matcher.detect();
    if (patterns.length === 0) return;

    daemonLog(ctx.logPath, "INFO", `Semantic pattern matcher: ${patterns.length} pattern(s) detected`);

    const profile = loadSemanticGrowthProfile(ctx.shitennoDir);
    daemonLog(ctx.logPath, "DEBUG", `Semantic growth: capacity=${Math.round(profile.growthCapacity * 100)}%, challenge=${Math.round(profile.challengeLevel * 100)}%, patterns=${profile.semanticChoices.length}`);

    const insights = generateInsights(ctx.shitennoDir, ctx.projectRoot, patterns, journal);
    if (insights.length > 0) {
      daemonLog(ctx.logPath, "INFO", `Semantic reasoner: ${insights.length} insight(s) generated`);
      for (const insight of insights) {
        getEventBus().publish("semantic.insight_detected", {
          insightId: insight.id,
          insightType: insight.type,
          domains: insight.domains,
          priority: insight.priority,
          confidence: insight.confidence,
        });
      }
    }

    const correlations = detectCorrelations(ctx.shitennoDir, ctx.projectRoot, journal);
    if (correlations.length > 0) {
      daemonLog(ctx.logPath, "INFO", `Semantic correlator: ${correlations.length} correlation(s) detected`);
    }
  } catch (err) {
    daemonLog(ctx.logPath, "ERROR", `Semantic pattern matcher failed: ${err}`);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

export function cleanupSemanticLayer(): void {
  try {
    resetChangeJournal();
    resetPatternMatcher();
    resetSemanticReasoner();
    resetSemanticCorrelator();
  } catch {
    // Cleanup failure should not prevent shutdown
  }
}
