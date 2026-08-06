/**
 * git-churn.ts — Git Churn and History Metrics
 *
 * Computes file churn from git history, pre-reads violation history,
 * and counts context pressure for area scoring.
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../types/constants.js";
import { walkSourceFiles } from "../../infrastructure/utils.js";
import { logger } from "../../shared/logger.js";

// ── Batch Git Churn ─────────────────────────────────────────────────────────

function fileMatchesArea(trimmed: string, area: string): boolean {
  return trimmed.startsWith(area + "/") || trimmed.includes("/" + area + "/");
}

function addToAreaFileSet(
  fileSetByArea: Map<string, Set<string>>,
  areas: string[],
  trimmed: string
): void {
  for (const a of areas) {
    if (fileMatchesArea(trimmed, a)) {
      fileSetByArea.get(a)?.add(trimmed);
    }
  }
}

export function batchGitChurn(
  projectRoot: string,
  areas: string[],
  windowDays: number
): Map<string, number> {
  const churnMap = new Map<string, number>();
  for (const a of areas) churnMap.set(a, 0);

  try {
    const output = execSync(
      `git log --since="${windowDays} days ago" --name-only --pretty=format:"" 2>/dev/null`,
      { encoding: "utf-8", cwd: projectRoot, timeout: 5000 }
    );

    const fileSetByArea = new Map<string, Set<string>>();
    for (const a of areas) fileSetByArea.set(a, new Set());

    for (const line of output.split("\n")) {
      const trimmed = line.trim();
      if (trimmed) addToAreaFileSet(fileSetByArea, areas, trimmed);
    }

    for (const [a, files] of fileSetByArea) {
      churnMap.set(a, files.size);
    }
  } catch {
    logger.debug("scorer", "Failed to compute churn metrics");
  }

  return churnMap;
}

// ── Pre-Read History ────────────────────────────────────────────────────────

export interface PreReadHistory {
  totalEntries: number;
  violationsByArea: Map<string, number>;
  incidentFreeAgeByArea: Map<string, number>;
}

interface HistoryScanCtx {
  areas: string[];
  violationKeywords: string[];
  violationsByArea: Map<string, number>;
  lastViolationIdx: Map<string, number>;
}

function scanHistoryFile(content: string, fileIndex: number, ctx: HistoryScanCtx): void {
  const lower = content.toLowerCase();
  for (const a of ctx.areas) {
    if (!lower.includes(a.toLowerCase())) continue;
    if (!ctx.violationKeywords.some((kw) => lower.includes(kw))) continue;
    ctx.violationsByArea.set(a, (ctx.violationsByArea.get(a) || 0) + 1);
    ctx.lastViolationIdx.set(a, fileIndex);
  }
}

export function preReadHistory(
  shitennoDir: string,
  areas: string[],
  violationKeywords: string[]
): PreReadHistory {
  const historyDir = join(shitennoDir, "docs", "history");
  const result: PreReadHistory = {
    totalEntries: 0,
    violationsByArea: new Map(),
    incidentFreeAgeByArea: new Map(),
  };

  for (const a of areas) {
    result.violationsByArea.set(a, 0);
    result.incidentFreeAgeByArea.set(a, 0);
  }

  if (!existsSync(historyDir)) return result;

  const files = readdirSync(historyDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("README"))
    .sort();

  result.totalEntries = files.length;

  const lastViolationIdx = new Map<string, number>();
  for (const a of areas) lastViolationIdx.set(a, -1);

  const ctx: HistoryScanCtx = {
    areas,
    violationKeywords,
    violationsByArea: result.violationsByArea,
    lastViolationIdx,
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    try {
      scanHistoryFile(readFileSync(join(historyDir, file), "utf-8"), i, ctx);
    } catch {
      logger.debug("git-churn", `Failed to read history file: ${file}`);
    }
  }

  for (const a of areas) {
    const idx = lastViolationIdx.get(a);
    result.incidentFreeAgeByArea.set(a, (idx === undefined || idx < 0) ? files.length : files.length - idx - 1);
  }

  return result;
}

// ── Context Pressure ────────────────────────────────────────────────────────

export function countContextPressure(projectRoot: string, area: string): number {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  const layersDir = join(shitennoDir, "docs", "layers");
  if (!existsSync(layersDir)) return 0;

  const areaParts = area.split("/");
  const layerName = areaParts[areaParts.length - 1] ?? "";
  const layerDir = join(layersDir, layerName);

  if (!existsSync(layerDir)) return 0;

  let totalBytes = 0;
  walkSourceFiles(layerDir, (fullPath) => {
    try {
      const stats = statSync(fullPath);
      totalBytes += stats.size;
    } catch {
      logger.debug("scorer", "Failed to stat file:", fullPath);
    }
  });

  return Math.round(totalBytes / 1024);
}
