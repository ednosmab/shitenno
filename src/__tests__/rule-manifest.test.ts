import { describe, it, expect } from "vitest";
import { partitionRules, type RuleManifestEntry } from "../infrastructure/rule-manifest.js";

const MANIFEST: RuleManifestEntry[] = [
  { id: "forbidden-operations", path: "docs/FORBIDDEN_OPERATIONS.md", mandatory: true, priority: 0 },
  { id: "architecture", path: "docs/architecture.md", mandatory: true, priority: 1 },
  { id: "typescript", path: "rules/typescript.md", when: { language: "typescript" }, priority: 2 },
  { id: "react", path: "rules/react.md", when: { framework: "react" }, priority: 2 },
  { id: "audit-protocol", path: "rules/audit.md", when: { task: "audit" }, priority: 1 },
  { id: "implementation-protocol", path: "rules/implementation.md", when: { task: "implementation" }, priority: 1 },
];

describe("rule-manifest", () => {
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
