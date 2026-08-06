import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { validateRule } from "../application/rule-engine.js";

describe("shipped rule templates", () => {
  const dir = "src/templates/base/governance/rules";

  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    it(`${file} must be a valid rule`, () => {
      const rule = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const result = validateRule(rule);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }
});
