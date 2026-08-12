/**
 * cache-metrics.ts — Cache Performance Monitoring
 *
 * Tracks cache hit rates, eviction counts, and performance metrics.
 * Provides insights for cache tuning and optimization.
 */

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
