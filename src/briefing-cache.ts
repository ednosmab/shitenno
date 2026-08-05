/**
 * briefing-cache.ts — Context Pipeline: Smart Cache Layer
 *
 * Caches briefing results with SHA-256 hash invalidation.
 * Cache is stored at .shugo/briefing-cache.json.
 *
 * Cache invalidation triggers:
 * - Git HEAD changed (new commit)
 * - Fingerprint hash changed (stack/domain change)
 * - Risk map changed (new risk areas)
 *
 * PRINCIPLE: Regenerate only when inputs change.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Briefing } from "./briefing.js";
import { isBriefingCache } from "./schema-validators.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CacheEntry {
  /** SHA-256 hash of the inputs that generated this briefing. */
  inputHash: string;
  /** ISO timestamp of when the entry was computed. */
  computedAt: string;
  /** The cached briefing data. */
  briefing: Briefing;
}

export interface BriefingCache {
  /** Cache schema version. */
  version: 1;
  /** The cached entry (if valid). */
  entry: CacheEntry | null;
}

// ── Hash Helpers ───────────────────────────────────────────────────────────

/**
 * Compute a composite hash from briefing inputs.
 * Changes when any input changes → triggers cache invalidation.
 */
export function computeInputHash(inputs: {
  gitHeadHash?: string;
  fingerprintHash: string;
  riskMapHash: string;
  contextRuleCount: number;
  dynamicRuleCount: number;
  maturityScore: number | null;
}): string {
  const payload = JSON.stringify(inputs);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

/**
 * Compute a request hash from handler input parameters.
 * Used to check cache validity BEFORE computing the briefing.
 * Changes when request parameters change → triggers cache miss.
 */
export function computeRequestHash(inputs: {
  projectRoot: string;
  shitennoDir: string;
  format: string;
  depth: string;
  task?: string;
}): string {
  const payload = JSON.stringify(inputs);
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

// ── Cache Validation ───────────────────────────────────────────────────────

/**
 * Check if a cache entry is valid (hash matches current inputs).
 * Pure function — easy to test.
 */
export function isCacheValid(entry: CacheEntry, currentHash: string): boolean {
  return entry.inputHash === currentHash;
}

/**
 * Check if a cache entry has expired based on SHITENNO_CACHE_TTL_MINUTES env var.
 * Pure function — only reads env var, no side effects.
 */
export function isCacheExpired(entry: CacheEntry, nowMs: number = Date.now()): boolean {
  const ttlMinutes = parseInt(process.env.SHITENNO_CACHE_TTL_MINUTES || "", 10);
  if (ttlMinutes <= 0 || !entry.computedAt) return false;
  const ageMs = nowMs - new Date(entry.computedAt).getTime();
  return ageMs > ttlMinutes * 60 * 1000;
}

// ── Cache Storage ──────────────────────────────────────────────────────────

function getCachePath(shitennoDir: string): string {
  return join(shitennoDir, "briefing-cache.json");
}

function ensureDir(shitennoDir: string): void {
  if (!existsSync(shitennoDir)) {
    mkdirSync(shitennoDir, { recursive: true });
  }
}

/**
 * Read the briefing cache from disk.
 * Returns null if cache doesn't exist or is corrupted.
 */
export function readCache(shitennoDir: string): BriefingCache | null {
  const cachePath = getCachePath(shitennoDir);
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(content);
    if (!isBriefingCache(parsed)) return null;
    return parsed as unknown as BriefingCache;
  } catch {
    return null;
  }
}

/**
 * Write the briefing cache to disk (atomic: tmp + rename).
 */
function writeCache(shitennoDir: string, cache: BriefingCache): void {
  ensureDir(shitennoDir);
  const cachePath = getCachePath(shitennoDir);
  // Write the tmp file in the same directory as the target to guarantee an
  // atomic rename even when the target lives on a different filesystem than
  // the OS tmp dir (renameSync across devices throws EXDEV).
  const tmpPath = join(dirname(cachePath), `briefing-cache-${Date.now()}.tmp`);
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmpPath, cachePath);
  } catch {
    try { unlinkSync(tmpPath); } catch { /* ignore cleanup error */ }
  }
}

/**
 * Get a cached briefing if valid, or null on cache miss.
 */
export function getCachedBriefing(
  shitennoDir: string,
  currentHash: string
): { briefing: Briefing; cacheHit: boolean } | null {
  const cache = readCache(shitennoDir);
  if (!cache?.entry) return null;

  // Check hash validity + optional TTL expiration (3.27)
  if (isCacheValid(cache.entry, currentHash) && !isCacheExpired(cache.entry)) {
    return { briefing: cache.entry.briefing, cacheHit: true };
  }

  return null;
}

/**
 * Get a cached briefing by request hash (computed from input parameters).
 * Used to check cache BEFORE computing the briefing.
 * Returns null on cache miss (hash mismatch or expiration).
 */
export function getCachedBriefingByRequest(
  shitennoDir: string,
  requestHash: string
): { briefing: Briefing; cacheHit: boolean } | null {
  const cache = readCache(shitennoDir);
  if (!cache?.entry) return null;

  // Check request hash validity + optional TTL expiration
  if (isCacheValid(cache.entry, requestHash) && !isCacheExpired(cache.entry)) {
    return { briefing: cache.entry.briefing, cacheHit: true };
  }

  return null;
}

/**
 * Store a briefing in the cache.
 */
export function setCachedBriefing(
  shitennoDir: string,
  briefing: Briefing,
  inputHash: string
): void {
  const cache: BriefingCache = {
    version: 1,
    entry: {
      inputHash,
      computedAt: new Date().toISOString(),
      briefing,
    },
  };
  writeCache(shitennoDir, cache);
}

/**
 * Invalidate the briefing cache (force regeneration).
 */
export function invalidateBriefingCache(shitennoDir: string): void {
  const cachePath = getCachePath(shitennoDir);
  if (existsSync(cachePath)) {
    unlinkSync(cachePath);
  }
}
