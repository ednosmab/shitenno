import { describe, it, expect } from "vitest";
import { resolveRules, partitionRules, type RuleManifestEntry } from "../infrastructure/rule-manifest.js";

const MANIFEST: RuleManifestEntry[] = [
  { id: "forbidden-operations", path: "docs/FORBIDDEN_OPERATIONS.md", mandatory: true, priority: 0 },
  { id: "architecture", path: "docs/architecture.md", mandatory: true, priority: 1 },
  { id: "typescript", path: "rules/typescript.md", when: { language: "typescript" }, priority: 2 },
  { id: "react", path: "rules/react.md", when: { framework: "react" }, priority: 2 },
  { id: "audit-protocol", path: "rules/audit.md", when: { task: "audit" }, priority: 1 },
  { id: "implementation-protocol", path: "rules/implementation.md", when: { task: "implementation" }, priority: 1 },
];

describe("rule-manifest", () => {
  describe("resolveRules", () => {
    it("mandatory rules always present even with empty taskMeta", () => {
      const result = resolveRules(MANIFEST, {});
      const ids = result.map((r) => r.id);
      expect(ids).toContain("forbidden-operations");
      expect(ids).toContain("architecture");
    });

    it("non-mandatory rule not selected when 'when' field absent from taskMeta", () => {
      const result = resolveRules(MANIFEST, {});
      const ids = result.map((r) => r.id);
      expect(ids).not.toContain("typescript");
      expect(ids).not.toContain("react");
      expect(ids).not.toContain("audit-protocol");
    });

    it("conditional rule selected when taskMeta matches", () => {
      const result = resolveRules(MANIFEST, { task: "audit" });
      const ids = result.map((r) => r.id);
      expect(ids).toContain("audit-protocol");
      expect(ids).not.toContain("implementation-protocol");
    });

    it("conditional rule not selected when taskMeta does not match", () => {
      const result = resolveRules(MANIFEST, { task: "audit" });
      const ids = result.map((r) => r.id);
      expect(ids).not.toContain("implementation-protocol");
    });

    it("results sorted by priority (0 = highest)", () => {
      const result = resolveRules(MANIFEST, { task: "audit" });
      const priorities = result.map((r) => r.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    });

    it("multiple conditional rules selected when all fields match", () => {
      const result = resolveRules(MANIFEST, {
        task: "implementation",
        language: "typescript",
        framework: "react",
      });
      const ids = result.map((r) => r.id);
      expect(ids).toContain("implementation-protocol");
      expect(ids).toContain("typescript");
      expect(ids).toContain("react");
    });
  });

  describe("partitionRules", () => {
    it("separates mandatory and contextual rules", () => {
      const { mandatory, contextual } = partitionRules(MANIFEST, { task: "audit" });
      expect(mandatory.map((r) => r.id)).toEqual(["forbidden-operations", "architecture"]);
      expect(contextual.map((r) => r.id)).toEqual(["audit-protocol"]);
    });

    it("mandatory rules always appear regardless of taskMeta", () => {
      const { mandatory } = partitionRules(MANIFEST, {});
      expect(mandatory).toHaveLength(2);
    });

    it("contextual rules empty when no taskMeta matches", () => {
      const { contextual } = partitionRules(MANIFEST, {});
      expect(contextual).toHaveLength(0);
    });
  });
});
