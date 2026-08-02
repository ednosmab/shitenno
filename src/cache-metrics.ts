/**
 * cache-metrics.ts — Cache Performance Monitoring
 *
 * Tracks cache hit rates, eviction counts, and performance metrics.
 * Provides insights for cache tuning and optimization.
 */

import { logger } from "./logger.js";

// ── Metrics Storage ───────────────────────────────────────────────────────

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  lastResetAt: number;
}

const metrics: Record<string, CacheMetrics> = {};

// ── Helper Functions ──────────────────────────────────────────────────────

function getOrCreateMetrics(cacheName: string): CacheMetrics {
  if (!metrics[cacheName]) {
    metrics[cacheName] = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      lastResetAt: Date.now(),
    };
  }
  return metrics[cacheName];
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Record a cache hit.
 */
export function recordHit(cacheName: string): void {
  const m = getOrCreateMetrics(cacheName);
  m.hits++;
  m.totalRequests++;
}

/**
 * Record a cache miss.
 */
export function recordMiss(cacheName: string): void {
  const m = getOrCreateMetrics(cacheName);
  m.misses++;
  m.totalRequests++;
}

/**
 * Record a cache eviction.
 */
export function recordEviction(cacheName: string): void {
  const m = getOrCreateMetrics(cacheName);
  m.evictions++;
}

/**
 * Get cache statistics.
 */
export function getCacheStats(cacheName: string): {
  hitRate: number;
  missRate: number;
  totalRequests: number;
  hits: number;
  misses: number;
  evictions: number;
} {
  const m = getOrCreateMetrics(cacheName);
  const hitRate = m.totalRequests > 0 ? m.hits / m.totalRequests : 0;
  const missRate = m.totalRequests > 0 ? m.misses / m.totalRequests : 0;
  
  return {
    hitRate,
    missRate,
    totalRequests: m.totalRequests,
    hits: m.hits,
    misses: m.misses,
    evictions: m.evictions,
  };
}

/**
 * Get all cache statistics.
 */
export function getAllCacheStats(): Record<string, ReturnType<typeof getCacheStats>> {
  const result: Record<string, ReturnType<typeof getCacheStats>> = {};
  for (const cacheName of Object.keys(metrics)) {
    result[cacheName] = getCacheStats(cacheName);
  }
  return result;
}

/**
 * Reset metrics for a specific cache.
 */
export function resetMetrics(cacheName: string): void {
  delete metrics[cacheName];
}

/**
 * Reset all metrics.
 */
export function resetAllMetrics(): void {
  for (const key of Object.keys(metrics)) {
    delete metrics[key];
  }
}

/**
 * Log cache performance summary.
 */
export function logCachePerformance(): void {
  const allStats = getAllCacheStats();
  
  for (const [cacheName, stats] of Object.entries(allStats)) {
    if (stats.totalRequests > 0) {
      logger.info("cache-metrics", `${cacheName}: ${stats.hitRate.toFixed(2)} hit rate (${stats.hits}/${stats.totalRequests}), ${stats.evictions} evictions`);
    }
  }
}

/**
 * Get performance report.
 */
export function getPerformanceReport(): string {
  const allStats = getAllCacheStats();
  const lines: string[] = ["Cache Performance Report:", ""];
  
  for (const [cacheName, stats] of Object.entries(allStats)) {
    if (stats.totalRequests > 0) {
      lines.push(`${cacheName}:`);
      lines.push(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
      lines.push(`  Total Requests: ${stats.totalRequests}`);
      lines.push(`  Hits: ${stats.hits}`);
      lines.push(`  Misses: ${stats.misses}`);
      lines.push(`  Evictions: ${stats.evictions}`);
      lines.push("");
    }
  }
  
  return lines.join("\n");
}
