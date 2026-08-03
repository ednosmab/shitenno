/**
 * bounded-health-score.ts — Shared dampened health-score formula
 *
 * Extracted from the audit's calculateHealthScore to be reused by all health
 * score consumers. The formula is calibrated for a large denominator
 * (minimum sample floor of 10) so that small samples with a cluster of severe
 * findings do not mathematically zero out the score — noise, not degradation.
 */

export interface SeverityBucket {
  key: string;
  weight: number;
  count: number;
  avgConfidence?: number;
}

export interface BoundedHealthScoreInput {
  buckets: SeverityBucket[];
  sampleSize: number;
  minSampleSize?: number;
  decayFactor?: number;
}

export function calculateBoundedHealthScore(input: BoundedHealthScoreInput): number {
  const { buckets, sampleSize, minSampleSize = 10, decayFactor = 2 } = input;
  const rawPenalty = buckets.reduce((sum, b) => {
    if (b.count <= 0) return sum;
    const conf = b.avgConfidence ?? 1.0;
    return sum + b.weight * Math.sqrt(b.count) * conf;
  }, 0);
  const normalizer = Math.max(sampleSize, minSampleSize);
  const density = rawPenalty / normalizer;
  const score = 100 * Math.exp(-density * decayFactor);
  return Math.max(0, Math.min(100, Math.round(score)));
}
