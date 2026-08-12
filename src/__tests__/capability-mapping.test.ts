import { describe, it, expect } from "vitest";
import {
  getCapabilityMapping,
  getCapabilityFiles,
} from "../domain/types/capability-mapping.js";
import type { Capability } from "../application/maturity-profile.js";

// ── getCapabilityMapping ───────────────────────────────────────────────────

describe("getCapabilityMapping", () => {
  it("returns mapping for core capability", () => {
    const mapping = getCapabilityMapping("core");
    expect(mapping).toBeDefined();
    expect(mapping.directories.length).toBeGreaterThan(0);
    expect(mapping.files.length).toBeGreaterThan(0);
  });

  it("returns mapping for knowledge capability", () => {
    const mapping = getCapabilityMapping("knowledge");
    expect(mapping).toBeDefined();
    expect(mapping.directories).toContain(".shitenno/docs/skills");
  });

  it("returns mapping for architecture capability", () => {
    const mapping = getCapabilityMapping("architecture");
    expect(mapping).toBeDefined();
    expect(mapping.files.some((f) => f.dest.includes("ADR-TEMPLATE"))).toBe(true);
  });

  it("returns mapping for ai capability", () => {
    const mapping = getCapabilityMapping("ai");
    expect(mapping).toBeDefined();
    expect(mapping.files.some((f) => f.dest.includes("AI-CONTRACT"))).toBe(true);
  });

  it("returns mapping for governance capability", () => {
    const mapping = getCapabilityMapping("governance");
    expect(mapping).toBeDefined();
    expect(mapping.files.some((f) => f.dest.includes("WORKFLOW"))).toBe(true);
  });

  it("returns mapping for quality capability", () => {
    const mapping = getCapabilityMapping("quality");
    expect(mapping).toBeDefined();
    expect(mapping.files.some((f) => f.dest.includes("validate-session"))).toBe(true);
  });

  it("returns mapping for metrics capability", () => {
    const mapping = getCapabilityMapping("metrics");
    expect(mapping).toBeDefined();
    expect(mapping.directories).toContain(".shitenno/reports");
  });

  it("returns mapping for operations capability", () => {
    const mapping = getCapabilityMapping("operations");
    expect(mapping).toBeDefined();
    expect(mapping.files.some((f) => f.dest.includes("close-session"))).toBe(true);
  });

  it("returns mapping for compliance capability", () => {
    const mapping = getCapabilityMapping("compliance");
    expect(mapping).toBeDefined();
    expect(mapping.directories).toContain(".shitenno/governance/premortem");
  });
});

// ── getCapabilityFiles ─────────────────────────────────────────────────────

describe("getCapabilityFiles", () => {
  it("returns files for core capability", () => {
    const files = getCapabilityFiles("core");
    expect(files.length).toBeGreaterThan(0);
    expect(files.every((f) => typeof f.src === "string")).toBe(true);
    expect(files.every((f) => typeof f.dest === "string")).toBe(true);
  });

  it("core files include AGENTS.md", () => {
    const files = getCapabilityFiles("core");
    expect(files.some((f) => f.dest.includes("AGENTS.md"))).toBe(true);
  });

  it("core files include backlog modular (ACTIVE.md + DONE.md)", () => {
    const files = getCapabilityFiles("core");
    expect(files.some((f) => f.dest.includes("backlog/ACTIVE.md"))).toBe(true);
    expect(files.some((f) => f.dest.includes("backlog/DONE.md"))).toBe(true);
  });

  it("knowledge files are empty (skills copied separately)", () => {
    const files = getCapabilityFiles("knowledge");
    expect(files).toEqual([]);
  });

  it("architecture files include ADR-TEMPLATE", () => {
    const files = getCapabilityFiles("architecture");
    expect(files.some((f) => f.src.includes("ADR-TEMPLATE"))).toBe(true);
  });

  it("files may have customize flag", () => {
    const files = getCapabilityFiles("core");
    const customized = files.filter((f) => f.customize === true);
    expect(customized.length).toBeGreaterThan(0);
  });
});

// ── Cross-validation ──────────────────────────────────────────────────────

describe("capability mapping cross-validation", () => {
  const allCapabilities: Capability[] = [
    "core", "knowledge", "architecture", "governance",
    "ai", "quality", "metrics", "operations", "compliance",
  ];

  it("all capabilities have valid mapping structure", () => {
    for (const cap of allCapabilities) {
      const mapping = getCapabilityMapping(cap);
      expect(mapping.directories).toBeDefined();
      expect(mapping.files).toBeDefined();
      expect(Array.isArray(mapping.directories)).toBe(true);
      expect(Array.isArray(mapping.files)).toBe(true);
    }
  });

  it("all file entries have both src and dest", () => {
    for (const cap of allCapabilities) {
      const files = getCapabilityFiles(cap);
      for (const file of files) {
        expect(file.src.length).toBeGreaterThan(0);
        expect(file.dest.length).toBeGreaterThan(0);
      }
    }
  });

  it("getCapabilityFiles returns same as getCapabilityMapping().files", () => {
    for (const cap of allCapabilities) {
      expect(getCapabilityFiles(cap)).toEqual(getCapabilityMapping(cap).files);
    }
  });
});
