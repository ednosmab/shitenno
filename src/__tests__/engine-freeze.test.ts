import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("FRZ-01: freeze on new engine/detector/analyser files", () => {
  it("does not exceed the frozen baseline count", () => {
    const output = execSync(
      `find src -name "*-engine.ts" -o -name "*-detector.ts" -o -name "*-analyser.ts" | grep -v __tests__ | wc -l`,
      { encoding: "utf-8" }
    ).trim();
    const BASELINE = 15;
    expect(Number(output)).toBeLessThanOrEqual(BASELINE);
  });
});
