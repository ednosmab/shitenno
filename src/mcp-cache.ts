/**
 * mcp-cache.ts — Response Cache for MCP Handlers
 *
 * Caches MCP responses to reduce redundant file reads and processing.
 * Uses TTL-based invalidation and content hashing.
 */

import { createHash } from "node:crypto";
import { logger } from "./logger.js";
import { recordHit, recordMiss, recordEviction, getCacheStats as getMetrics } from "./cache-metrics.js";

// ── Cache Configuration ───────────────────────────────────────────────────

const DEFAULT_TTL_MS = 60_000; // 60 seconds
const MAX_CACHE_SIZE = 100;    // Maximum cache entries

// ── Cache Entry ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  key: string;
  data: T;
  hash: string;
  createdAt: number;
  ttlMs: number;
}

// ── Cache Store ───────────────────────────────────────────────────────────

const cacheStore = new Map<string, CacheEntry<unknown>>();

// ── Helper Functions ──────────────────────────────────────────────────────

function computeHash(data: unknown): string {
  const str = JSON.stringify(data);
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.createdAt > entry.ttlMs;
}

function evictOldEntries(): void {
  if (cacheStore.size <= MAX_CACHE_SIZE) return;
  
  // Sort by creation time and remove oldest entries
  const entries = Array.from(cacheStore.entries())
    .sort((a, b) => a[1].createdAt - b[1].createdAt);
  
  const toRemove = entries.slice(0, cacheStore.size - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    cacheStore.delete(key);
    recordEviction("mcp-cache");
  }
  
  logger.debug("mcp-cache", `Evicted ${toRemove.length} old cache entries`);
}

// ── Public API ────────────────────────────────────────────────────────────

export interface CacheOptions {
  key: string;
  ttlMs?: number;
}

/**
 * Get cached response or execute handler and cache result.
 */
export async function withCache<T>(
  handler: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const cacheKey = options.key;
  
  // Check cache
  const cached = cacheStore.get(cacheKey);
  if (cached && !isExpired(cached)) {
    recordHit("mcp-cache");
    logger.debug("mcp-cache", `Cache hit for key: ${cacheKey}`);
    return cached.data as T;
  }
  
  recordMiss("mcp-cache");
  // Execute handler
  const data = await handler();
  const hash = computeHash(data);
  
  // Store in cache (always update if expired or data changed)
  evictOldEntries();
  cacheStore.set(cacheKey, {
    key: cacheKey,
    data,
    hash,
    createdAt: Date.now(),
    ttlMs,
  });
  
  logger.debug("mcp-cache", `Cached response for key: ${cacheKey}`);
  return data;
}

/**
 * Invalidate cache by key pattern.
 */
export function invalidateCache(pattern: string | RegExp): number {
  let count = 0;
  const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
  
  for (const [key] of cacheStore) {
    if (regex.test(key)) {
      cacheStore.delete(key);
      count++;
    }
  }
  
  logger.debug("mcp-cache", `Invalidated ${count} cache entries matching pattern`);
  return count;
}

/**
 * Clear all cache entries.
 */
export function clearCache(): void {
  const size = cacheStore.size;
  cacheStore.clear();
  logger.debug("mcp-cache", `Cleared ${size} cache entries`);
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
} {
  const m = getMetrics("mcp-cache");
  return {
    size: cacheStore.size,
    hitRate: m.hitRate,
    totalHits: m.hits,
    totalMisses: m.misses,
  };
}
