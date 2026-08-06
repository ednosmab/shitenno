/**
 * cache.ts — Disk cache for shugo scoring results
 *
 * Strategy: SHA256 checksum per key file (content-based, no stat fast-paths).
 * Cache stored at project root as .shitenno-cache.json.
 * Invalidated when any tracked file changes.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync, renameSync, chmodSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import { logger } from "../shared/logger.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  /** SHA256 checksums of key files at time of computation. */
  checksums: Record<string, string>;
  /** ISO timestamp of when the entry was computed. */
  computedAt: string;
  /** The cached result. */
  data: T;
}

export interface ShitennoCache {
  /** Cache schema version for future migration. */
  version: 1;
  /** Project root relative path. */
  projectRoot: string;
  /** Cached complexity report. */
  complexity?: CacheEntry<unknown>;
  /** Cached pattern detection report. */
  patterns?: CacheEntry<unknown>;
  /** Cached health audit report. */
  health?: CacheEntry<unknown>;
}

// ── Checksum Helpers ────────────────────────────────────────────────────────
//
// Note: no stat-based fast paths here. On filesystems with coarse timestamp
// granularity (e.g. 1s rounding), mtime/ctime/size can all stay unchanged when
// a file is added or modified within the same tick, which would return stale
// checksums. Content is always re-read to guarantee cache invalidation.

/** Compute SHA256 of a file's content. */
function fileChecksum(filePath: string): string | null {
  try {
    const content = readFileSync(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

/** Compute a directory's aggregate checksum (all files recursively, capped at depth 3). */
function dirChecksum(dirPath: string, maxDepth = 3): string {
  if (!existsSync(dirPath)) return "missing";

  const hashes: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.isFile() && !entry.name.startsWith(".")) {
          const hash = fileChecksum(fullPath);
          if (hash) {
            hashes.push(`${relative(dirPath, fullPath)}:${hash}`);
          }
        }
      }
    } catch {
      logger.debug("cache", "Inaccessible directory skipped:", dirPath);
    }
  }

  walk(dirPath, 0);
  hashes.sort(); // deterministic order
  return createHash("sha256").update(hashes.join("\n")).digest("hex");
}

// ── Checksum Collection ─────────────────────────────────────────────────────

/**
 * Compute checksums for all key files that affect scoring results.
 * Returns a map of file/dir path → SHA256.
 */
export function computeKeyChecksums(projectRoot: string, shitennoDir: string): Record<string, string> {
  const checksums: Record<string, string> = {};

  // 1. git HEAD (most important — any commit invalidates)
  const gitHead = fileChecksum(join(projectRoot, ".git", "HEAD"));
  if (gitHead) checksums[".git/HEAD"] = gitHead;

  // Also check packed-refs for branch changes
  const packedRefs = fileChecksum(join(projectRoot, ".git", "packed-refs"));
  if (packedRefs) checksums[".git/packed-refs"] = packedRefs;

  // 2. package.json (dependency changes)
  const pkgHash = fileChecksum(join(projectRoot, "package.json"));
  if (pkgHash) checksums["package.json"] = pkgHash;

  // 3. opencode.json (agent config changes)
  const opencodeHash = fileChecksum(join(projectRoot, "opencode.json"));
  if (opencodeHash) checksums["opencode.json"] = opencodeHash;

  // 4. shitenno/profile/ (area config)
  checksums[`${SHITENNO_DIR_NAME}/profile/`] = dirChecksum(join(projectRoot, SHITENNO_DIR_NAME, "profile"));

  // 5. shitenno/ — aggregate hash of the whole governance directory
  checksums[`${SHITENNO_DIR_NAME}/`] = dirChecksum(shitennoDir);

  return checksums;
}


// ── Cache Validation ────────────────────────────────────────────────────────

/** Check if cached checksums match current checksums. */
function isCacheValid(
  cached: Record<string, string>,
  current: Record<string, string>
): boolean {
  const cachedKeys = Object.keys(cached);
  const currentKeys = Object.keys(current);

  // Different number of keys → invalid
  if (cachedKeys.length !== currentKeys.length) return false;

  // Any mismatch → invalid
  for (const key of currentKeys) {
    if (cached[key] !== current[key]) return false;
  }

  return true;
}

// ── Cache Read/Write ────────────────────────────────────────────────────────

const CACHE_FILENAME = ".shitenno-cache.json";

function readCache(projectRoot: string): ShitennoCache | null {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  if (!existsSync(cachePath)) return null;

  try {
    const content = readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(content) as ShitennoCache;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(projectRoot: string, cache: ShitennoCache): void {
  const cachePath = join(projectRoot, CACHE_FILENAME);
  const tmpPath = join(tmpdir(), `shitenno-cache-${Date.now()}.json`);
  try {
    writeFileSync(tmpPath, JSON.stringify(cache, null, 2), "utf-8");
    renameSync(tmpPath, cachePath);
    chmodSync(cachePath, 0o600);
  } catch {
    try { unlinkSync(tmpPath); } catch (error) { logger.debug("cache", "Suppressed error", { error }); }
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export type CacheKey = "complexity" | "patterns" | "health";

interface GetCachedInput { projectRoot: string; key: CacheKey; computeChecksumsFn: () => Record<string, string> }
/**
 * Try to get a cached result. Returns null if cache miss.
 */
export function getCached<T>(input: GetCachedInput): T | null {
  const { projectRoot, key, computeChecksumsFn } = input;
  const cache = readCache(projectRoot);
  if (!cache) return null;

  const entry = cache[key] as CacheEntry<T> | undefined;
  if (!entry) return null;

  const currentChecksums = computeChecksumsFn();
  if (!isCacheValid(entry.checksums, currentChecksums)) return null;

  return entry.data;
}

/**
 * Store a result in the cache.
 */
interface SetCacheInput<T> { projectRoot: string; shitennoDir: string; key: CacheKey; data: T; checksums: Record<string, string> }

export function setCache<T>(input: SetCacheInput<T>): void {
  const { projectRoot, key, data, checksums } = input;
  const cache = readCache(projectRoot) || { version: 1 as const, projectRoot };
  cache[key] = { checksums, computedAt: new Date().toISOString(), data };
  writeCache(projectRoot, cache);
}

/**
 * Invalidate a specific cache entry or the entire cache.
 */
interface InvalidateCacheInput { projectRoot: string; key?: CacheKey }
export function invalidateCache(input: InvalidateCacheInput): void {
  const { projectRoot, key } = input;
  const cache = readCache(projectRoot);
  if (!cache) return;

  if (key) {
    delete cache[key];
    writeCache(projectRoot, cache);
  } else {
    // Remove entire cache file
    try {
      unlinkSync(join(projectRoot, CACHE_FILENAME));
    } catch (error) {
      logger.debug("cache", "Suppressed error", { error });
    }
  }
}
