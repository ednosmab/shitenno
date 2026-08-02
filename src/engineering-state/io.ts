import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { EngineeringState } from "../domain/entities/engineering-state.js";
import { isEngineeringState } from "../schema-validators.js";

// ── Retention Policy ────────────────────────────────────────────────────────

const RETENTION_POLICY = {
  keepAllWithinDays: 7,
  keepDailyWithinDays: 90,
  keepWeeklyBeyondDays: 90,
};

function pruneOldSnapshots(snapshotsDir: string): void {
  const files = readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return;

  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;
  const keptFiles = new Set<string>();

  for (const file of files) {
    const timestamp = file.replace(".json", "").replace(/-/g, (m, offset) => {
      if (offset === 4 || offset === 7) return "-";
      if (offset === 10) return "T";
      if (offset === 13 || offset === 16) return ":";
      return m;
    });
    const fileDate = new Date(timestamp);
    const daysSince = (now - fileDate.getTime()) / msPerDay;

    let keep = false;

    if (daysSince <= RETENTION_POLICY.keepAllWithinDays) {
      keep = true;
    } else if (daysSince <= RETENTION_POLICY.keepDailyWithinDays) {
      const dayKey = fileDate.toISOString().slice(0, 10);
      if (!keptFiles.has(`day:${dayKey}`)) {
        keptFiles.add(`day:${dayKey}`);
        keep = true;
      }
    } else if (daysSince <= RETENTION_POLICY.keepWeeklyBeyondDays) {
      const weekKey = `${fileDate.getFullYear()}-W${Math.ceil(fileDate.getDate() / 7)}`;
      if (!keptFiles.has(`week:${weekKey}`)) {
        keptFiles.add(`week:${weekKey}`);
        keep = true;
      }
    }

    if (!keep) {
      try {
        unlinkSync(join(snapshotsDir, file));
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export function saveEngineeringState(
  shitennoDir: string,
  state: EngineeringState
): void {
  const filePath = join(shitennoDir, "engineering-state.json");
  writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");

  const snapshotsDir = join(shitennoDir, "history", "snapshots");
  mkdirSync(snapshotsDir, { recursive: true });

  const snapshotId = state.consolidatedAt.replace(/[:.]/g, "-");
  const snapshotPath = join(snapshotsDir, `${snapshotId}.json`);
  writeFileSync(snapshotPath, JSON.stringify(state, null, 2), "utf-8");

  pruneOldSnapshots(snapshotsDir);
}

export function loadEngineeringState(
  shitennoDir: string
): EngineeringState | null {
  const filePath = join(shitennoDir, "engineering-state.json");
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (!isEngineeringState(parsed)) {
      return null;
    }
    return parsed as unknown as EngineeringState;
  } catch {
    return null;
  }
}

export function engineeringStateToText(state: EngineeringState): string {
  const lines: string[] = [];

  lines.push("# Engineering State Report");
  lines.push(`Consolidated: ${state.consolidatedAt}`);
  lines.push(`Lifecycle: ${state.lifecycle}`);
  lines.push("");

  lines.push("## Project");
  lines.push(`  Name: ${state.project.name}`);
  lines.push(`  Stack: ${state.project.stack.join(", ") || "none detected"}`);
  lines.push(`  Files: ${state.project.sourceFileCount}`);
  lines.push(`  Packages: ${state.project.packageCount}`);
  lines.push("");

  lines.push("## Health");
  lines.push(`  Overall: ${state.healthScores.overall}/100`);
  lines.push(`  Knowledge Debt: ${state.healthScores.knowledgeDebt}/100`);
  lines.push(`  Knowledge Graph: ${state.healthScores.knowledgeGraph}/100`);
  lines.push("");

  if (state.maturity) {
    lines.push("## Maturity");
    lines.push(`  Overall: ${state.maturity.overallScore}/100`);
    for (const [key, value] of Object.entries(state.maturity.dimensions)) {
      lines.push(`  ${key}: ${value}/100`);
    }
    lines.push("");
  }

  lines.push("## Capabilities");
  lines.push(`  Installed: ${state.capabilities.join(", ")}`);
  lines.push(`  Active Rules: ${state.activeRules}`);
  lines.push(`  Active Policies: ${state.activePolicies}`);
  lines.push("");

  lines.push("## Engineering Assets");
  lines.push(`  Total: ${state.assets.length}`);
  for (const [type, count] of Object.entries(state.assetsByType)) {
    lines.push(`  ${type}: ${count}`);
  }
  lines.push("");

  lines.push("## Entropy");
  lines.push(`  Score: ${state.entropy.score}/100`);
  lines.push(`  Orphaned Assets: ${state.entropy.orphanedAssets}`);
  lines.push(`  Stale Assets: ${state.entropy.staleAssets}`);
  lines.push(`  Missing Dependencies: ${state.entropy.missingDependencies}`);
  lines.push("");

  return lines.join("\n");
}
