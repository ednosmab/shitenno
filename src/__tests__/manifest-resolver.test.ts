/**
 * manifest-resolver.test.ts — Deterministic skill/rule resolution tests
 *
 * Layer 1 of PLAN_skill_routing_verification.md:
 * Pure function tests — same input, same output, no I/O, no LLM.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEntries,
  partitionEntries,
  type ManifestEntry,
} from "../manifest-resolver.js";

// ── Fixtures ────────────────────────────────────────────────────────────────

const skillManifestFixture: ManifestEntry[] = [
  {
    id: "tdd_workflow",
    path: "docs/skills/tdd_workflow.md",
    mandatory: true,
    priority: 0,
    when: { task: "implementation" },
  },
  {
    id: "clean_code_standards",
    path: "docs/skills/clean_code_standards.md",
    mandatory: true,
    priority: 1,
    when: { task: "implementation" },
  },
  {
    id: "solid_principles",
    path: "docs/skills/solid_principles.md",
    priority: 2,
    when: { task: "implementation", language: "typescript" },
  },
  {
    id: "architectural_integrity",
    path: "docs/skills/architectural_integrity.md",
    priority: 2,
    when: { task: "refactor" },
  },
];

// ── resolveEntries — skill manifest (unconditionalMandatory: false) ─────────

describe("resolveEntries — skill manifest (unconditionalMandatory: false)", () => {
  it("returns only skills matching the task's `when` clause", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "implementation" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).toEqual([
      "tdd_workflow",
      "clean_code_standards",
    ]);
  });

  it("does NOT return tdd_workflow for a non-implementation task, even though it's mandatory", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "audit" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).not.toContain("tdd_workflow");
  });

  it("narrows further when language is also provided", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "implementation", language: "typescript" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).toContain("solid_principles");
  });

  it("does NOT include solid_principles when language is missing", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "implementation" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).not.toContain("solid_principles");
  });

  it("returns empty array when no when clause matches", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "deploy" },
      { unconditionalMandatory: false }
    );
    expect(result).toEqual([]);
  });

  it("returns entries sorted by priority (0 = highest)", () => {
    const result = resolveEntries(
      skillManifestFixture,
      { task: "implementation" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.priority)).toEqual([0, 1]);
  });

  it("returns all entries when no when clause exists on any entry", () => {
    const noWhenManifest: ManifestEntry[] = [
      { id: "always_a", path: "a.md", priority: 1 },
      { id: "always_b", path: "b.md", priority: 0 },
    ];
    const result = resolveEntries(
      noWhenManifest,
      { task: "anything" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).toEqual(["always_b", "always_a"]);
  });
});

// ── partitionEntries — skill manifest (unconditionalMandatory: false) ────────

describe("partitionEntries — skill manifest (unconditionalMandatory: false)", () => {
  it("partitions mandatory vs contextual correctly", () => {
    const { mandatory, contextual } = partitionEntries(
      skillManifestFixture,
      { task: "implementation", language: "typescript" },
      { unconditionalMandatory: false }
    );
    expect(mandatory.map((m) => m.id)).toEqual([
      "tdd_workflow",
      "clean_code_standards",
    ]);
    expect(contextual.map((c) => c.id)).toEqual(["solid_principles"]);
  });

  it("returns empty mandatory and contextual when nothing matches", () => {
    const { mandatory, contextual } = partitionEntries(
      skillManifestFixture,
      { task: "deploy" },
      { unconditionalMandatory: false }
    );
    expect(mandatory).toEqual([]);
    expect(contextual).toEqual([]);
  });

  it("mandatory is empty when matching entries are not marked mandatory", () => {
    const nonMandatory: ManifestEntry[] = [
      { id: "optional_skill", path: "opt.md", priority: 0, when: { task: "test" } },
    ];
    const { mandatory, contextual } = partitionEntries(
      nonMandatory,
      { task: "test" },
      { unconditionalMandatory: false }
    );
    expect(mandatory).toEqual([]);
    expect(contextual.map((c) => c.id)).toEqual(["optional_skill"]);
  });
});

// ── resolveEntries — rule manifest (unconditionalMandatory: true) ───────────

describe("resolveEntries — rule manifest (unconditionalMandatory: true), regression guard", () => {
  it("still returns mandatory entries regardless of `when`, unchanged from current rule-manifest.ts behavior", () => {
    const ruleFixture: ManifestEntry[] = [
      {
        id: "forbidden-operations",
        path: "docs/FORBIDDEN_OPERATIONS.md",
        mandatory: true,
        priority: 0,
      },
    ];
    const result = resolveEntries(ruleFixture, {}, {
      unconditionalMandatory: true,
    });
    expect(result.map((r) => r.id)).toEqual(["forbidden-operations"]);
  });

  it("mandatory entries always included even with empty task metadata", () => {
    const mixedFixture: ManifestEntry[] = [
      {
        id: "always_rule",
        path: "always.md",
        mandatory: true,
        priority: 0,
      },
      {
        id: "conditional_rule",
        path: "cond.md",
        priority: 1,
        when: { task: "refactor" },
      },
    ];
    const result = resolveEntries(mixedFixture, {}, {
      unconditionalMandatory: true,
    });
    expect(result.map((r) => r.id)).toEqual(["always_rule"]);
  });

  it("returns both mandatory and conditional when condition matches", () => {
    const mixedFixture: ManifestEntry[] = [
      {
        id: "always_rule",
        path: "always.md",
        mandatory: true,
        priority: 0,
      },
      {
        id: "conditional_rule",
        path: "cond.md",
        priority: 1,
        when: { task: "refactor" },
      },
    ];
    const result = resolveEntries(mixedFixture, { task: "refactor" }, {
      unconditionalMandatory: true,
    });
    expect(result.map((r) => r.id)).toEqual([
      "always_rule",
      "conditional_rule",
    ]);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe("resolveEntries — edge cases", () => {
  it("handles empty manifest", () => {
    const result = resolveEntries([], { task: "implementation" }, {
      unconditionalMandatory: false,
    });
    expect(result).toEqual([]);
  });

  it("handles empty task metadata", () => {
    const result = resolveEntries(skillManifestFixture, {}, {
      unconditionalMandatory: false,
    });
    // No when clauses match empty metadata
    expect(result).toEqual([]);
  });

  it("partial when match fails (all fields must match)", () => {
    const fixture: ManifestEntry[] = [
      {
        id: "partial",
        path: "p.md",
        priority: 0,
        when: { task: "implementation", language: "typescript" },
      },
    ];
    const result = resolveEntries(
      fixture,
      { task: "implementation" },
      { unconditionalMandatory: false }
    );
    expect(result).toEqual([]);
  });
});
