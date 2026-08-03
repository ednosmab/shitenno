/**
 * bounded-health-score.test.ts — Shared dampened health-score formula
 *
 * The formula must stay stable on small samples: a cluster of severe findings
 * in a small scope must not zero the score by statistical noise, while large
 * samples still dilute proportionally.
 */

import { describe, it, expect } from "vitest";
import { calculateBoundedHealthScore } from "../shared/bounded-health-score.js";

describe("calculateBoundedHealthScore", () => {
  it("returns 100 when there are no findings", () => {
    expect(calculateBoundedHealthScore({ buckets: [], sampleSize: 10 })).toBe(100);
  });

  it("returns 100 when all buckets are empty", () => {
    const buckets = [
      { key: "3", weight: 5, count: 0 },
      { key: "2", weight: 2, count: 0 },
      { key: "1", weight: 0.5, count: 0 },
    ];
    expect(calculateBoundedHealthScore({ buckets, sampleSize: 100 })).toBe(100);
  });

  it("clamps to [0, 100]", () => {
    const huge = [{ key: "3", weight: 1000, count: 100 }];
    expect(calculateBoundedHealthScore({ buckets: huge, sampleSize: 1 })).toBe(0);

    const none = [{ key: "3", weight: 1000, count: 0 }];
    expect(calculateBoundedHealthScore({ buckets: none, sampleSize: 1 })).toBe(100);
  });

  it("keeps the score above zero for a small sample with a few severe findings (noise resistance)", () => {
    // 3 files with 5 severe findings: without the sample floor the denominator
    // collapses to 3 and the score zeroes; the floor keeps it stable.
    const buckets = [{ key: "3", weight: 5, count: 5 }];
    const withFloor = calculateBoundedHealthScore({ buckets, sampleSize: 3, minSampleSize: 10 });
    const withoutFloor = calculateBoundedHealthScore({ buckets, sampleSize: 3, minSampleSize: 3 });
    expect(withFloor).toBeGreaterThan(0);
    expect(withFloor).toBeGreaterThan(withoutFloor);
  });

  it("dilutes the penalty as the sample grows (same findings, more files)", () => {
    const buckets = [{ key: "3", weight: 5, count: 30 }];
    const small = calculateBoundedHealthScore({ buckets, sampleSize: 10 });
    const large = calculateBoundedHealthScore({ buckets, sampleSize: 500 });
    expect(large).toBeGreaterThan(small);
  });

  it("weights sqrt(count) sub-linearly — 4x findings do not 4x the penalty", () => {
    const one = calculateBoundedHealthScore({ buckets: [{ key: "3", weight: 5, count: 1 }], sampleSize: 100 });
    const four = calculateBoundedHealthScore({ buckets: [{ key: "3", weight: 5, count: 4 }], sampleSize: 100 });
    const deltaOne = 100 - one;
    const deltaFour = 100 - four;
    expect(deltaFour).toBeLessThan(deltaOne * 4);
  });

  it("honors avgConfidence — low-confidence findings penalize less", () => {
    const confident = [{ key: "3", weight: 5, count: 10, avgConfidence: 1.0 }];
    const unsure = [{ key: "3", weight: 5, count: 10, avgConfidence: 0.3 }];
    expect(
      calculateBoundedHealthScore({ buckets: unsure, sampleSize: 100 })
    ).toBeGreaterThan(
      calculateBoundedHealthScore({ buckets: confident, sampleSize: 100 })
    );
  });

  it("respects a custom decayFactor", () => {
    const buckets = [{ key: "3", weight: 5, count: 10 }];
    const gentle = calculateBoundedHealthScore({ buckets, sampleSize: 100, decayFactor: 1 });
    const steep = calculateBoundedHealthScore({ buckets, sampleSize: 100, decayFactor: 3 });
    expect(gentle).toBeGreaterThan(steep);
  });
});
