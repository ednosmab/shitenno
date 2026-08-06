/**
 * engineering-state-history.ts — Engineering State History
 *
 * Provides functions to query historical snapshots of Engineering State.
 *
 * PRINCIPLE: State changes over time. History enables trend analysis
 * and debugging of state transitions.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type EngineeringState } from "../application/engineering-state.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SnapshotMeta {
  id: string;
  timestamp: string;
  filePath: string;
}

export interface EngineeringStateDelta {
  timestamp: string;
  healthScoreChange: number;
  entropyChange: number;
  assetsAdded: number;
  assetsRemoved: number;
  capabilitiesChanged: boolean;
}

// ── Functions ───────────────────────────────────────────────────────────────

/**
 * Get a snapshot at a specific timestamp.
 * Returns the closest snapshot to the given timestamp.
 */
export function getSnapshotAt(
  shitennoDir: string,
  timestamp: string
): EngineeringState | null {
  const snapshotsDir = join(shitennoDir, "history", "snapshots");
  if (!existsSync(snapshotsDir)) return null;

  const files = readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) return null;

  // Find closest snapshot
  let closest: string | null = null;
  let closestDiff = Infinity;

  for (const file of files) {
    const fileTimestamp = file.replace(".json", "").replace(/-/g, (m, offset) => {
      if (offset === 4 || offset === 7) return "-";
      if (offset === 10) return "T";
      if (offset === 13 || offset === 16) return ":";
      return m;
    });
    const diff = Math.abs(new Date(fileTimestamp).getTime() - new Date(timestamp).getTime());
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = file;
    }
  }

  if (!closest) return null;

  try {
    const content = readFileSync(join(snapshotsDir, closest), "utf-8");
    return JSON.parse(content) as EngineeringState;
  } catch {
    return null;
  }
}

/**
 * List all snapshots with optional time range filter.
 */
export function listSnapshots(
  shitennoDir: string,
  range?: { from: string; to: string }
): SnapshotMeta[] {
  const snapshotsDir = join(shitennoDir, "history", "snapshots");
  if (!existsSync(snapshotsDir)) return [];

  const files = readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const snapshots: SnapshotMeta[] = [];

  for (const file of files) {
    const id = file.replace(".json", "");
    const timestamp = id.replace(/-/g, (m, offset) => {
      if (offset === 4 || offset === 7) return "-";
      if (offset === 10) return "T";
      if (offset === 13 || offset === 16) return ":";
      return m;
    });

    if (range) {
      const ts = new Date(timestamp);
      if (ts < new Date(range.from) || ts > new Date(range.to)) continue;
    }

    snapshots.push({
      id,
      timestamp,
      filePath: join(snapshotsDir, file),
    });
  }

  return snapshots;
}

/**
 * Compute delta between two engineering states.
 */
export function diffSnapshots(
  a: EngineeringState,
  b: EngineeringState
): EngineeringStateDelta {
  const aAssetIds = new Set(a.assets.map((asset) => asset.id));
  const bAssetIds = new Set(b.assets.map((asset) => asset.id));

  let assetsAdded = 0;
  let assetsRemoved = 0;

  for (const id of bAssetIds) {
    if (!aAssetIds.has(id)) assetsAdded++;
  }

  for (const id of aAssetIds) {
    if (!bAssetIds.has(id)) assetsRemoved++;
  }

  return {
    timestamp: b.consolidatedAt,
    healthScoreChange: b.healthScores.overall - a.healthScores.overall,
    entropyChange: b.entropy.score - a.entropy.score,
    assetsAdded,
    assetsRemoved,
    capabilitiesChanged: JSON.stringify(a.capabilities) !== JSON.stringify(b.capabilities),
  };
}
