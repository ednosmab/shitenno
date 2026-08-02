/**
 * baseline-diff.ts — Detect silent category count drops
 *
 * Compares current audit output against a saved baseline.
 * Flags categories with >30% drop as anomalies requiring review.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase D.21
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BASELINE_PATH = "scripts/security/category-baseline.json";
const THRESHOLD_DROP_PCT = 0.3;

function getCurrentCounts(): Record<string, number> {
  const out = execSync("node dist/bin/shugo.js audit --level enterprise --json --no-cache", {
    maxBuffer: 20 * 1024 * 1024,
    encoding: "utf-8",
  });
  const report = JSON.parse(out);
  const counts: Record<string, number> = {};
  for (const issue of report.issues) {
    counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  }
  return counts;
}

function main(): void {
  const current = getCurrentCounts();

  if (!existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2));
    console.log("Baseline created for the first time.");
    return;
  }

  const baseline: Record<string, number> = JSON.parse(
    readFileSync(BASELINE_PATH, "utf-8"),
  );

  const anomalies: Array<{ type: string; before: number; after: number }> = [];

  for (const [type, beforeCount] of Object.entries(baseline)) {
    const before = beforeCount as number;
    const afterCount = current[type] ?? 0;
    if (before > 0 && afterCount < before * (1 - THRESHOLD_DROP_PCT)) {
      anomalies.push({ type, before, after: afterCount });
    }
  }

  if (anomalies.length > 0) {
    console.log("🟡 Categories with >30% drop — review required:");
    for (const a of anomalies) {
      console.log(`  ${a.type}: ${a.before} → ${a.after}`);
    }
    writeFileSync("/tmp/audit-anomalies.json", JSON.stringify(anomalies, null, 2));
    process.exitCode = 2; // specific code: "review", not "broken"
  } else {
    console.log("✅ No anomalous drops detected.");
  }
}

main();
