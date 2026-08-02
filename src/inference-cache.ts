/**
 * inference-cache.ts — Cache for Inference Engine Results
 *
 * Caches plan inference results to avoid redundant file reads.
 * Uses file modification times for invalidation.
 */

import { statSync } from "node:fs";
import { logger } from "./logger.js";
import type { PlanInference, InferenceSummary } from "./inference-engine.js";

// ── Cache Configuration ───────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000; // 30 seconds
const MAX_CACHE_SIZE = 50;   // Maximum cached plans

// ── Cache Entry ───────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fileMtime: number;
  createdAt: number;
}

// ── Cache Store ───────────────────────────────────────────────────────────

const planCache = new Map<string, CacheEntry<PlanInference>>();
let summaryCache: CacheEntry<InferenceSummary> | null = null;

// ── Helper Functions ──────────────────────────────────────────────────────

function getFileMtime(filePath: string): number {
  try {
    const stat = statSync(filePath);
    return stat.mtimeMs;
  } catch {
    return 0;
  }
}

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.createdAt > CACHE_TTL_MS;
}

function evictOldEntries(): void {
  if (planCache.size <= MAX_CACHE_SIZE) return;
  
  const entries = Array.from(planCache.entries())
    .sort((a, b) => a[1].createdAt - b[1].createdAt);
  
  const toRemove = entries.slice(0, planCache.size - MAX_CACHE_SIZE);
  for (const [key] of toRemove) {
    planCache.delete(key);
  }
  
  logger.debug("inference-cache", `Evicted ${toRemove.length} old cache entries`);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Get cached plan inference or compute and cache result.
 */
export function getCachedPlanInference(
  planId: string,
  filePath: string,
  computeFn: () => PlanInference,
): PlanInference {
  const cached = planCache.get(planId);
  const currentMtime = getFileMtime(filePath);
  
  // Check if cache is valid
  if (cached && !isExpired(cached) && cached.fileMtime === currentMtime) {
    logger.debug("inference-cache", `Cache hit for plan: ${planId}`);
    return cached.data;
  }
  
  // Compute and cache
  evictOldEntries();
  const data = computeFn();
  planCache.set(planId, {
    data,
    fileMtime: currentMtime,
    createdAt: Date.now(),
  });
  
  logger.debug("inference-cache", `Cached plan: ${planId}`);
  return data;
}

/**
 * Get cached summary or compute and cache result.
 */
export function getCachedSummary(
  computeFn: () => InferenceSummary,
): InferenceSummary {
  if (summaryCache && !isExpired(summaryCache)) {
    logger.debug("inference-cache", "Cache hit for summary");
    return summaryCache.data;
  }
  
  const data = computeFn();
  summaryCache = {
    data,
    fileMtime: 0, // Summary doesn't have a single file
    createdAt: Date.now(),
  };
  
  logger.debug("inference-cache", "Cached summary");
  return data;
}

/**
 * Invalidate cache for a specific plan.
 */
export function invalidatePlanCache(planId: string): boolean {
  return planCache.delete(planId);
}

/**
 * Invalidate all cache entries.
 */
export function invalidateAllCache(): number {
  const size = planCache.size + (summaryCache ? 1 : 0);
  planCache.clear();
  summaryCache = null;
  return size;
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  planCacheSize: number;
  summaryCached: boolean;
} {
  return {
    planCacheSize: planCache.size,
    summaryCached: summaryCache !== null,
  };
}
