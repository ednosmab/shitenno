/**
 * evidence-collector.ts — Evidence Collection for Semantic Reasoning
 *
 * Collects evidence from multiple subsystems (patterns, risk, maturity,
 * knowledge, journal, health) to feed into insight rules.
 *
 * PRINCIPLE: Evidence is factual — each piece traces to a specific source file or event.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ChangeJournal } from "./change-journal.js";
import type { DetectedPattern } from "./pattern-rules.js";

export interface Evidence {
  source: "pattern" | "risk" | "maturity" | "knowledge" | "journal" | "health";
  description: string;
  data: Record<string, unknown>;
}

interface JsonEvidenceCtx {
  shitennoDir: string;
}

function collectJsonEvidence(
  ctx: JsonEvidenceCtx,
  evidence: Evidence[],
  source: Evidence["source"],
  relPath: string
): void {
  try {
    const fullPath = join(ctx.shitennoDir, relPath);
    if (!existsSync(fullPath)) return;
    const raw = JSON.parse(readFileSync(fullPath, "utf-8")) as Record<string, unknown>;
    if (source === "risk") {
      evidence.push({ source, description: `Risk map: ${raw.overallRisk ?? "unknown"} (${raw.overallScore ?? 0})`, data: { level: raw.overallRisk ?? "unknown", score: raw.overallScore ?? 0 } });
    } else {
      evidence.push({ source, description: `Health score: ${raw.score ?? "unknown"}`, data: { score: raw.score ?? 0 } });
    }
  } catch { /* file may not exist */ }
}

function collectMaturityEvidence(ctx: JsonEvidenceCtx, evidence: Evidence[]): void {
  try {
    const p = join(ctx.shitennoDir, "governance", "maturity-profile.json");
    if (!existsSync(p)) return;
    const m = JSON.parse(readFileSync(p, "utf-8")) as { dimensions?: Record<string, { score?: number }> };
    if (!m.dimensions) return;
    for (const [domain, dim] of Object.entries(m.dimensions)) {
      evidence.push({ source: "maturity", description: `Maturity ${domain}: ${dim.score ?? 0}`, data: { domain, score: dim.score ?? 0 } });
    }
  } catch { /* file may not exist */ }
}

function collectJournalEvidence(journal: ChangeJournal, evidence: Evidence[]): void {
  const entries = journal.query({ limit: 20 });
  if (entries.length === 0) return;
  const domainCounts: Record<string, number> = {};
  for (const e of entries) { domainCounts[e.classification.domain] = (domainCounts[e.classification.domain] ?? 0) + 1; }
  evidence.push({ source: "journal", description: `${entries.length} entries across ${Object.keys(domainCounts).length} domains`, data: { entryCount: entries.length, domains: domainCounts } });
}

function collectPatternEvidence(patterns: DetectedPattern[], evidence: Evidence[]): void {
  for (const p of patterns) {
    evidence.push({ source: "pattern", description: `Pattern: ${p.type} in ${p.domain}`, data: { patternType: p.type, domain: p.domain, confidence: p.confidence } });
  }
}

/** Collect evidence from multiple subsystems. */
export function collectEvidence(
  shitennoDir: string,
  patterns: DetectedPattern[],
  journal: ChangeJournal
): Evidence[] {
  const evidence: Evidence[] = [];
  const ctx = { shitennoDir };
  collectPatternEvidence(patterns, evidence);
  collectJournalEvidence(journal, evidence);
  collectJsonEvidence(ctx, evidence, "risk", "governance/risk-map.json");
  collectJsonEvidence(ctx, evidence, "health", "governance/health-score.json");
  collectMaturityEvidence(ctx, evidence);
  return evidence;
}
