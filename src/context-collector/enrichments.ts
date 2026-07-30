/**
 * context-collector/enrichments.ts — Briefing enrichment functions
 */

import type { Briefing } from "../briefing.js";
import type { PatternDetectionReport, DetectedPattern } from "../domain/entities/engineering-state.js";
import { listAdrs, listSkills } from "../knowledge-loader.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../session-feedback.js";
import { readPersistedEvents, type EventEnvelope } from "../event-bus.js";
import { logger } from "../logger.js";
import type { ContextDeps } from "./types.js";

export function enrichBriefingWithGovernanceKnowledge(
  briefing: Briefing,
  shitennoDir: string,
): Briefing {
  try {
    const activeAdrs = listAdrs(shitennoDir).filter(
      (a) => a.status === "Accepted" || a.status === "Proposed",
    );
    const availableSkills = listSkills(shitennoDir);

    return {
      ...briefing,
      governanceKnowledge: {
        adrs: activeAdrs.map((a) => ({ id: a.id, title: a.title, status: a.status })),
        skills: availableSkills.map((s) => ({ name: s.name, description: s.description })),
      },
    };
  } catch (err) {
    logger.debug("enrichBriefing", "Governance knowledge unavailable:", err instanceof Error ? err.message : err);
    return briefing;
  }
}

function collectRecurringErrors(shitennoDir: string): string[] {
  try {
    const records = getFeedbackRecords(shitennoDir);
    if (records.length > 0) {
      const summary = computeFeedbackSummary(records);
      return summary.failureHotspots;
    }
  } catch (err) {
    logger.debug("enrichBriefing", "Feedback data unavailable:", err instanceof Error ? err.message : err);
  }
  return [];
}

function collectDetectedPatterns(
  projectRoot: string,
  shitennoDir: string,
  deps: ContextDeps,
  existingPatternReport?: PatternDetectionReport,
): Briefing["patterns"]["detected"] {
  try {
    const patternReport = existingPatternReport ?? deps.detectPatterns(projectRoot, shitennoDir);
    return patternReport.patterns.map((p: DetectedPattern) => ({
      type: p.type,
      description: p.description,
      occurrences: p.occurrences,
      affectedArea: p.affectedArea,
      severity: p.severity,
    }));
  } catch (err) {
    logger.debug("enrichBriefing", "Pattern detection unavailable:", err instanceof Error ? err.message : err);
  }
  return [];
}

export interface EnrichPatternsOptions {
  briefing: Briefing;
  projectRoot: string;
  shitennoDir: string;
  deps: ContextDeps;
  existingPatternReport?: PatternDetectionReport;
}

export function enrichBriefingWithPatterns(opts: EnrichPatternsOptions): Briefing {
  const { briefing, projectRoot, shitennoDir, deps, existingPatternReport } = opts;
  const recurringErrors = collectRecurringErrors(shitennoDir);
  const detected = collectDetectedPatterns(projectRoot, shitennoDir, deps, existingPatternReport);

  return {
    ...briefing,
    patterns: {
      ...briefing.patterns,
      recurringErrors,
      detected,
    },
  };
}

const ACTIVITY_EVENT_TYPES = new Set([
  "plan.created",
  "plan.file_changed",
  "plan.format_warning",
  "plan.archived",
  "backlog.updated",
]);

function summarizeEvent(event: EventEnvelope): string {
  const p = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "plan.created":
      return `Plano criado: ${p.planId ?? "unknown"}`;
    case "plan.file_changed":
      return `Plano alterado: ${p.planId ?? "unknown"}`;
    case "plan.format_warning":
      return `Formato inválido: ${p.planId ?? "unknown"}`;
    case "plan.archived":
      return `Plano arquivado: ${p.planId ?? "unknown"}`;
    case "backlog.updated":
      return `${p.source ?? "sync"}: ${p.stepsCount ?? 0} passos`;
    default:
      return String(p.planId ?? p.source ?? event.type);
  }
}

export function enrichBriefingWithRecentActivity(
  briefing: Briefing,
  shitennoDir: string,
): Briefing {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

    const todayEvents = readPersistedEvents(shitennoDir, today);
    const yesterdayEvents = readPersistedEvents(shitennoDir, yesterday);
    const allEvents = [...yesterdayEvents, ...todayEvents];

    const cutoff = now.getTime() - 86400000;
    const recent = allEvents
      .filter((e) => ACTIVITY_EVENT_TYPES.has(e.type))
      .filter((e) => new Date(e.timestamp).getTime() >= cutoff)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    const syncCount = recent.filter((e) => e.type === "backlog.updated").length;
    const errorCount = recent.filter((e) => e.type === "plan.format_warning").length;

    return {
      ...briefing,
      recentActivity: recent.length > 0 ? {
        events: recent.map((e) => ({
          type: e.type,
          summary: summarizeEvent(e),
          timestamp: e.timestamp,
        })),
        syncCount,
        errorCount,
      } : undefined,
    };
  } catch (err) {
    logger.debug("enrichBriefing", "Recent activity unavailable:", err instanceof Error ? err.message : err);
    return briefing;
  }
}
