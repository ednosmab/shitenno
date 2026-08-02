/**
 * correlator.ts — Cross-System Semantic Correlation
 *
 * Connects signals from multiple subsystems (event bus, risk map,
 * maturity profile, knowledge graph, audit dimensions) to detect
 * correlations that single subsystems cannot see.
 *
 * PRINCIPLE: Correlation is deterministic — same inputs always produce
 * the same correlations.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { SemanticDomain } from "./taxonomy.js";
import type { ChangeJournal } from "./change-journal.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Correlation {
  id: string;
  type: CorrelationType;
  domains: SemanticDomain[];
  description: string;
  confidence: number;
  signals: CorrelationSignal[];
  strength: "weak" | "moderate" | "strong";
}

export type CorrelationType =
  | "risk_maturity_divergence"
  | "health_knowledge_mismatch"
  | "domain_isolation"
  | "cascade_effect";

export interface CorrelationSignal {
  source: string;
  type: string;
  value: unknown;
}

export interface CorrelatorContext {
  shitennoDir: string;
  projectRoot: string;
  journal: ChangeJournal;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadJson(shitennoDir: string, relativePath: string): unknown {
  const fullPath = join(shitennoDir, relativePath);
  if (!existsSync(fullPath)) return null;
  try {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch {
    return null;
  }
}

// ── Correlation Rules ───────────────────────────────────────────────────────

interface CorrelationRule {
  type: CorrelationType;
  name: string;
  detect: (ctx: CorrelatorContext) => Correlation | null;
}

const CORRELATION_RULES: CorrelationRule[] = [
  {
    type: "risk_maturity_divergence",
    name: "Divergencia Risco-Maturidade",
    detect: (ctx) => {
      const risk = loadJson(ctx.shitennoDir, "governance/risk-map.json") as { overallRisk?: string; overallScore?: number } | null;
      const maturity = loadJson(ctx.shitennoDir, "governance/maturity-profile.json") as { overallScore?: number } | null;
      if (!risk || !maturity) return null;
      const riskScore = risk.overallScore ?? 0;
      const maturityScore = maturity.overallScore ?? 0;
      if (riskScore > 60 && maturityScore > 60) {
        return {
          id: `rmd-${Date.now()}`,
          type: "risk_maturity_divergence",
          domains: ["governance"],
          description: `Risco elevado (${riskScore}) apesar de maturidade alta (${maturityScore})`,
          confidence: Math.min((riskScore + maturityScore) / 200, 0.9),
          signals: [
            { source: "risk-map", type: "overallRisk", value: risk.overallRisk },
            { source: "maturity", type: "overallScore", value: maturityScore },
          ],
          strength: riskScore > 75 ? "strong" : "moderate",
        };
      }
      return null;
    },
  },
  {
    type: "health_knowledge_mismatch",
    name: "Incompatibilidade Saude-Conhecimento",
    detect: (ctx) => {
      const health = loadJson(ctx.shitennoDir, "governance/health-score.json") as { score?: number } | null;
      const debt = loadJson(ctx.shitennoDir, "governance/knowledge-debt.json") as { totalGaps?: number } | null;
      if (!health || !debt) return null;
      const healthScore = health.score ?? 0;
      const gapCount = debt.totalGaps ?? 0;
      if (healthScore > 70 && gapCount > 10) {
        return {
          id: `hkm-${Date.now()}`,
          type: "health_knowledge_mismatch",
          domains: ["documentation", "governance"],
          description: `Saude alta (${healthScore}) mas ${gapCount} gaps de conhecimento`,
          confidence: 0.65,
          signals: [
            { source: "health", type: "score", value: healthScore },
            { source: "debt", type: "totalGaps", value: gapCount },
          ],
          strength: gapCount > 20 ? "strong" : "moderate",
        };
      }
      return null;
    },
  },
  {
    type: "domain_isolation",
    name: "Isolamento de Dominio",
    detect: (ctx) => {
      const entries = ctx.journal.query({ limit: 50 });
      if (entries.length < 10) return null;
      const domainCounts = new Map<string, number>();
      for (const entry of entries) {
        domainCounts.set(entry.classification.domain, (domainCounts.get(entry.classification.domain) ?? 0) + 1);
      }
      const isolated: string[] = [];
      for (const [domain, count] of domainCounts) {
        if (count === 1) isolated.push(domain);
      }
      if (isolated.length > 0) {
        return {
          id: `di-${Date.now()}`,
          type: "domain_isolation",
          domains: isolated as SemanticDomain[],
          description: `${isolated.length} dominio(s) isolado(s): ${isolated.join(", ")}`,
          confidence: 0.6,
          signals: isolated.map((d) => ({ source: "journal", type: "isolated", value: d })),
          strength: isolated.length > 2 ? "strong" : "weak",
        };
      }
      return null;
    },
  },
  {
    type: "cascade_effect",
    name: "Efeito Cascata",
    detect: (ctx) => {
      const entries = ctx.journal.query({ limit: 30 });
      if (entries.length < 5) return null;
      const domainTimes = new Map<string, number[]>();
      for (const entry of entries) {
        const domain = entry.classification.domain;
        const time = new Date(entry.timestamp).getTime();
        if (!domainTimes.has(domain)) domainTimes.set(domain, []);
        domainTimes.get(domain)?.push(time);
      }
      const now = Date.now();
      const recentDomains: string[] = [];
      for (const [domain, times] of domainTimes) {
        const recentCount = times.filter((t) => now - t < 5 * 60 * 1000).length;
        if (recentCount >= 2) recentDomains.push(domain);
      }
      if (recentDomains.length >= 3) {
        return {
          id: `ce-${Date.now()}`,
          type: "cascade_effect",
          domains: recentDomains as SemanticDomain[],
          description: `Efeito cascata - ${recentDomains.length} dominios alterados em sequencia rapida`,
          confidence: Math.min(recentDomains.length / 5, 0.85),
          signals: recentDomains.map((d) => ({ source: "journal", type: "rapid_change", value: d })),
          strength: recentDomains.length >= 4 ? "strong" : "moderate",
        };
      }
      return null;
    },
  },
];

// ── Correlator Implementation ───────────────────────────────────────────────

export class SemanticCorrelator {
  private ctx: CorrelatorContext;

  constructor(ctx: CorrelatorContext) {
    this.ctx = ctx;
  }

  correlate(): Correlation[] {
    const correlations: Correlation[] = [];
    for (const rule of CORRELATION_RULES) {
      try {
        const correlation = rule.detect(this.ctx);
        if (correlation) correlations.push(correlation);
      } catch (err) {
        logger.warn("semantic-correlator", `Error in rule "${rule.name}": ${err}`);
      }
    }
    return correlations;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let defaultCorrelator: SemanticCorrelator | null = null;

export function getSemanticCorrelator(ctx: CorrelatorContext): SemanticCorrelator {
  if (!defaultCorrelator) {
    defaultCorrelator = new SemanticCorrelator(ctx);
  }
  return defaultCorrelator;
}

export function resetSemanticCorrelator(): void {
  defaultCorrelator = null;
}

export function detectCorrelations(
  shitennoDir: string,
  projectRoot: string,
  journal: ChangeJournal
): Correlation[] {
  return getSemanticCorrelator({ shitennoDir, projectRoot, journal }).correlate();
}
