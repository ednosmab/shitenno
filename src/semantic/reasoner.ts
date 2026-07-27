import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { SemanticDomain } from "./taxonomy.js";
import type { DetectedPattern } from "./pattern-rules.js";
import type { ChangeJournal } from "./change-journal.js";
import { INSIGHT_RULES } from "./reasoner/insight-rules.js";

export type InsightType =
  | "architecture_evolution"
  | "security_posture_change"
  | "scope_expansion"
  | "maturity_mismatch"
  | "debt_accumulation"
  | "governance_gap"
  | "cross_system_correlation";

export interface SemanticInsight {
  id: string;
  type: InsightType;
  domains: SemanticDomain[];
  description: string;
  confidence: number;
  evidence: Evidence[];
  suggestedActions: string[];
  priority: "urgent" | "high" | "medium" | "low";
  detectedAt: string;
  sourcePatterns: string[];
}

export interface Evidence {
  source: "pattern" | "risk" | "maturity" | "knowledge" | "journal" | "health";
  description: string;
  data: Record<string, unknown>;
}

export interface ReasonerContext {
  shitennoDir: string;
  projectRoot: string;
  patterns: DetectedPattern[];
  journal: ChangeJournal;
}

export class SemanticReasoner {
  private ctx: ReasonerContext;

  constructor(ctx: ReasonerContext) {
    this.ctx = ctx;
  }

  reason(): SemanticInsight[] {
    const evidence = this.collectEvidence();
    const insights: SemanticInsight[] = [];

    for (const rule of INSIGHT_RULES) {
      try {
        const insight = rule.condition(this.ctx, evidence);
        if (insight) {
          insights.push(insight);
        }
      } catch (err) {
        logger.warn("semantic-reasoner", `Error in rule "${rule.name}": ${err}`);
      }
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return insights;
  }

  private collectJsonEvidence(evidence: Evidence[], source: Evidence["source"], relPath: string): void {
    try {
      const fullPath = join(this.ctx.shitennoDir, relPath);
      if (!existsSync(fullPath)) return;
      const raw = JSON.parse(readFileSync(fullPath, "utf-8")) as Record<string, unknown>;
      if (source === "risk") {
        evidence.push({ source, description: `Risk map: ${raw.overallRisk ?? "unknown"} (${raw.overallScore ?? 0})`, data: { level: raw.overallRisk ?? "unknown", score: raw.overallScore ?? 0 } });
      } else {
        evidence.push({ source, description: `Health score: ${raw.score ?? "unknown"}`, data: { score: raw.score ?? 0 } });
      }
    } catch { /* file may not exist */ }
  }

  private collectMaturityEvidence(evidence: Evidence[]): void {
    try {
      const p = join(this.ctx.shitennoDir, "governance", "maturity-profile.json");
      if (!existsSync(p)) return;
      const m = JSON.parse(readFileSync(p, "utf-8")) as { dimensions?: Record<string, { score?: number }> };
      if (!m.dimensions) return;
      for (const [domain, dim] of Object.entries(m.dimensions)) {
        evidence.push({ source: "maturity", description: `Maturity ${domain}: ${dim.score ?? 0}`, data: { domain, score: dim.score ?? 0 } });
      }
    } catch { /* file may not exist */ }
  }

  private collectJournalEvidence(evidence: Evidence[]): void {
    const entries = this.ctx.journal.query({ limit: 20 });
    if (entries.length === 0) return;
    const domainCounts: Record<string, number> = {};
    for (const e of entries) { domainCounts[e.classification.domain] = (domainCounts[e.classification.domain] ?? 0) + 1; }
    evidence.push({ source: "journal", description: `${entries.length} entries across ${Object.keys(domainCounts).length} domains`, data: { entryCount: entries.length, domains: domainCounts } });
  }

  private collectPatternEvidence(evidence: Evidence[]): void {
    for (const p of this.ctx.patterns) {
      evidence.push({ source: "pattern", description: `Pattern: ${p.type} in ${p.domain}`, data: { patternType: p.type, domain: p.domain, confidence: p.confidence } });
    }
  }

  private collectEvidence(): Evidence[] {
    const evidence: Evidence[] = [];
    this.collectPatternEvidence(evidence);
    this.collectJournalEvidence(evidence);
    this.collectJsonEvidence(evidence, "risk", "governance/risk-map.json");
    this.collectJsonEvidence(evidence, "health", "governance/health-score.json");
    this.collectMaturityEvidence(evidence);
    return evidence;
  }
}

let defaultReasoner: SemanticReasoner | null = null;

export function getSemanticReasoner(ctx: ReasonerContext): SemanticReasoner {
  if (!defaultReasoner) {
    defaultReasoner = new SemanticReasoner(ctx);
  }
  return defaultReasoner;
}

export function resetSemanticReasoner(): void {
  defaultReasoner = null;
}

export function generateInsights(
  shitennoDir: string,
  projectRoot: string,
  patterns: DetectedPattern[],
  journal: ChangeJournal
): SemanticInsight[] {
  return getSemanticReasoner({ shitennoDir, projectRoot, patterns, journal }).reason();
}
