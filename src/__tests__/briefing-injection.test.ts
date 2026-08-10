import { describe, it, expect } from "vitest";
import {
  buildBriefingContextBlock,
  isTrivialPrompt,
} from "../application/briefing-injection.js";

describe("briefing-injection", () => {
  describe("buildBriefingContextBlock", () => {
    it("wraps briefing markdown in context markers", () => {
      const block = buildBriefingContextBlock("# Pre-Session Briefing\n\nRisk: critical");

      expect(block).toContain("<!-- shitenno-briefing-start -->");
      expect(block).toContain("<!-- shitenno-briefing-end -->");
      expect(block).toContain("# Pre-Session Briefing");
      expect(block.indexOf("<!-- shitenno-briefing-start -->")).toBeLessThan(
        block.indexOf("# Pre-Session Briefing")
      );
    });

    it("returns empty string for empty input", () => {
      expect(buildBriefingContextBlock("")).toBe("");
    });
  });

  describe("isTrivialPrompt", () => {
    it("returns true for minimal continuations", () => {
      expect(isTrivialPrompt("continue")).toBe(true);
      expect(isTrivialPrompt("ok")).toBe(true);
      expect(isTrivialPrompt("go on")).toBe(true);
    });

    it("returns false for real task prompts", () => {
      expect(isTrivialPrompt("fix the failing test in pipeline.ts")).toBe(false);
      expect(isTrivialPrompt("what is the project maturity?")).toBe(false);
    });
  });
});
