/**
 * plan-backlog-sync-cooldown.ts — Persistent cooldown for retroactive scan
 *
 * Reduces scan frequency by persisting last scan timestamp.
 * Avoids running the scan on every CLI invocation.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

interface ScanState {
  lastScanAt: string;
}

const SCAN_COOLDOWN_MS = 15_000; // 15 seconds cooldown

function scanStatePath(shitennoDir: string): string {
  const cacheDir = join(shitennoDir, ".cache");
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, "retroactive-scan-state.json");
}

export function shouldSkipScan(shitennoDir: string): boolean {
  const path = scanStatePath(shitennoDir);
  if (!existsSync(path)) return false;
  try {
    const state: ScanState = JSON.parse(readFileSync(path, "utf-8"));
    return Date.now() - new Date(state.lastScanAt).getTime() < SCAN_COOLDOWN_MS;
  } catch {
    return false; // Unreadable state → don't block scan
  }
}

export function markScanRun(shitennoDir: string): void {
  writeFileSync(scanStatePath(shitennoDir), JSON.stringify({ lastScanAt: new Date().toISOString() }));
}
