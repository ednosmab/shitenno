/**
 * scripts/verify/health-score-small-sample.ts — Reproduction for small-sample entropy instability
 *
 * A single orphaned asset in a freshly-started project must NOT produce a
 * high entropy score (statistical noise of a small sample, not real degradation).
 * Expected: score <= 40. Current buggy behavior: score = 45 (RED).
 *
 * Run: pnpm exec tsx scripts/verify/health-score-small-sample.ts
 */

import { calculateEntropy } from "../../src/engineering-state/entropy.js";

let failed = false;
const now = new Date().toISOString();

// Scenario: 1 single catalogued asset, orphaned — the realistic worst case of
// a freshly-started branch/project, not 2 assets (which does not reproduce).
const oneAsset = [
  {
    id: "a1",
    type: "plan",
    name: "Plan A",
    path: "plans/a1.md",
    description: "Single plan",
    tags: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
    contributesTo: [],
    dependencies: [],
  },
];
const result = calculateEntropy(oneAsset, [], "governed");

console.log(`Scenario: 1 asset, 1 orphan → entropy.score = ${result.score}`);
if (result.score > 40) {
  console.error(
    "❌ A single asset/orphan produced a high entropy score — statistical noise " +
      "from a small sample, not a real signal of degradation."
  );
  failed = true;
}
if (failed) process.exit(1);
console.log("✅ No small-sample instability.");
