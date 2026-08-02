# Plan — Verification & Observability for Skill Routing

**Status:** Done

> Fourth plan, depends on `PLAN_skill_routing_mechanism.md` (the manifest + MCP resolution must exist first). This plan answers a different question: not "does the mechanism work by design" but "how do we know, for a specific real task, that it actually happened." Four independent layers — deliberately redundant, because a single point of proof is exactly what already failed once (a rule existed, nothing forced or recorded whether it was read).

## Layer 1 — Determinism, at design time (unit tests)

`resolveEntries`/`resolveSkills` are pure functions — same input, same output, no I/O, no LLM. This is the cheapest layer and should be the first line of defense.

**File:** `src/manifest-resolver.test.ts`

```typescript
import { describe, it, expect } from "vitest"; // or the project's actual test runner — verify in package.json
import { resolveEntries, partitionEntries, type ManifestEntry } from "./manifest-resolver.js";

const fixtureManifest: ManifestEntry[] = [
  { id: "tdd_workflow", path: "docs/skills/tdd_workflow.md", mandatory: true, priority: 0, when: { task: "implementation" } },
  { id: "clean_code_standards", path: "docs/skills/clean_code_standards.md", mandatory: true, priority: 1, when: { task: "implementation" } },
  { id: "solid_principles", path: "docs/skills/solid_principles.md", priority: 2, when: { task: "implementation", language: "typescript" } },
  { id: "architectural_integrity", path: "docs/skills/architectural_integrity.md", priority: 2, when: { task: "refactor" } },
];

describe("resolveEntries — skill manifest (unconditionalMandatory: false)", () => {
  it("returns only skills matching the task's `when` clause", () => {
    const result = resolveEntries(fixtureManifest, { task: "implementation" }, { unconditionalMandatory: false });
    expect(result.map((r) => r.id)).toEqual(["tdd_workflow", "clean_code_standards"]);
  });

  it("does NOT return tdd_workflow for a non-implementation task, even though it's mandatory", () => {
    const result = resolveEntries(fixtureManifest, { task: "audit" }, { unconditionalMandatory: false });
    expect(result.map((r) => r.id)).not.toContain("tdd_workflow");
  });

  it("narrows further when language is also provided", () => {
    const result = resolveEntries(
      fixtureManifest,
      { task: "implementation", language: "typescript" },
      { unconditionalMandatory: false }
    );
    expect(result.map((r) => r.id)).toContain("solid_principles");
  });

  it("partitions mandatory vs contextual correctly", () => {
    const { mandatory, contextual } = partitionEntries(
      fixtureManifest,
      { task: "implementation", language: "typescript" },
      { unconditionalMandatory: false }
    );
    expect(mandatory.map((m) => m.id)).toEqual(["tdd_workflow", "clean_code_standards"]);
    expect(contextual.map((c) => c.id)).toEqual(["solid_principles"]);
  });
});

describe("resolveEntries — rule manifest (unconditionalMandatory: true), regression guard", () => {
  it("still returns mandatory entries regardless of `when`, unchanged from current rule-manifest.ts behavior", () => {
    const ruleFixture: ManifestEntry[] = [
      { id: "forbidden-operations", path: "docs/FORBIDDEN_OPERATIONS.md", mandatory: true, priority: 0 },
    ];
    const result = resolveEntries(ruleFixture, {}, { unconditionalMandatory: true });
    expect(result.map((r) => r.id)).toEqual(["forbidden-operations"]);
  });
});
```

The last block matters specifically because `manifest-resolver.ts` is a refactor of existing, already-relied-upon code (`rule-manifest.ts`) — this test exists to catch a regression in rule resolution caused by the skill-routing work, not to test skills.

**Acceptance:** this file passes in CI before any other layer is considered relevant — if the pure logic is wrong, nothing downstream can be trusted regardless of what it reports.

---

## Layer 2 — Static consistency, at audit time (close the planned-but-missing orphan-skill detector)

`src/audit/skill-refs.ts` already states the intent: *"This enables the orphan-skill detector to find skills without any associated detector."* Confirmed in this investigation: no such detector exists yet. Build it now, extended to also validate the new manifest — not just the old detector-mapping use case.

**File:** `src/audit/skill-manifest-detectors.ts` (new, mirrors the shape of `governance-detectors-docs.ts`)

```typescript
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { HealthIssue } from "./types.js";
import { loadSkillManifest } from "../skill-manifest.js";

/**
 * Detect skills that exist as files but have no entry in skill-manifest.yaml —
 * meaning they can never be resolved by getSkills(taskMeta) or getBriefing,
 * only reached by an agent that already knows the exact name to ask for.
 * This is the exact failure mode that left tdd_workflow unreferenced in practice.
 */
export function detectOrphanSkills(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skillsDir = join(shitennoDir, "docs", "skills");
  const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");

  if (!existsSync(skillsDir)) return issues;

  let manifestIds = new Set<string>();
  if (existsSync(manifestPath)) {
    try {
      manifestIds = new Set(loadSkillManifest(manifestPath).map((s) => s.id));
    } catch (err) {
      logger.debug("skill-manifest-detectors", "Failed to parse skill-manifest.yaml:", err);
    }
  }

  const files = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  for (const file of files) {
    const id = file.replace(".md", "");
    if (!manifestIds.has(id)) {
      issues.push({
        type: "orphan_skill",
        severity: 2,
        description: `Skill "${id}" exists in docs/skills/ but has no entry in skill-manifest.yaml — it will never be auto-resolved for any task, only fetched by an agent that already knows its exact name.`,
        location: `shitenno/docs/skills/${file}`,
        recommendation: `Add an entry for "${id}" to governance/skill-manifest.yaml with an appropriate \`when\` clause, or remove the skill if it's no longer relevant.`,
        confidence: 0.95,
      });
    }
  }

  return issues;
}

/**
 * Inverse check: every manifest entry must point at a file that exists.
 * Catches typos and stale references after a skill file is renamed/deleted.
 */
export function detectBrokenSkillManifestEntries(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
  if (!existsSync(manifestPath)) return issues;

  let entries: ReturnType<typeof loadSkillManifest> = [];
  try {
    entries = loadSkillManifest(manifestPath);
  } catch (err) {
    logger.debug("skill-manifest-detectors", "Failed to parse skill-manifest.yaml:", err);
    return issues;
  }

  for (const entry of entries) {
    if (!existsSync(join(shitennoDir, entry.path))) {
      issues.push({
        type: "orphan_skill", // reuse type; distinguish via description if a separate type is preferred
        severity: 3,
        description: `skill-manifest.yaml entry "${entry.id}" points to "${entry.path}", which does not exist.`,
        location: `shitenno/governance/skill-manifest.yaml`,
        recommendation: `Fix the path for "${entry.id}" or remove the entry.`,
        confidence: 1.0,
      });
    }
  }

  return issues;
}
```

**Wiring (mirrors how `detectOrphanDirs` is registered — three touch points, confirmed in the codebase):**

1. `src/audit/types.ts` — add `"orphan_skill"` to the `HealthIssueType` union (alongside existing `"missing_docs" | "orphan_dir" | ...`).
2. `src/audit/detector-map.ts` — add:
   ```typescript
   detectOrphanSkills: () => detectOrphanSkills(ctx.shitennoDir),
   detectBrokenSkillManifestEntries: () => detectBrokenSkillManifestEntries(ctx.shitennoDir),
   ```
3. `src/audit/constants.ts` — add both detector names to the same dimension list(s) `detectOrphanDirs` currently belongs to (confirmed at three list locations in that file).
4. `src/audit/governance-detectors.ts` — re-export both from the barrel, same as `detectOrphanDirs`.

**Acceptance:** running `shugo audit` on the Shitenno repository itself (or any project using the templates) surfaces an issue for any skill file not wired into the manifest — including, right now, every existing skill until Phase 1 of the routing plan populates the manifest. That's expected and correct: it's the audit making the current gap visible instead of silent.

---

## Layer 3 — Contract, at call time (MCP integration tests)

**File:** `src/mcp-server-handlers.test.ts` (extend existing test file if present, or create)

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleGetSkills } from "./mcp-server-handlers.js";

describe("handleGetSkills — scope-aware resolution", () => {
  let shitennoDir: string;

  beforeEach(() => {
    shitennoDir = mkdtempSync(join(tmpdir(), "shitenno-test-"));
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "docs", "skills", "tdd_workflow.md"),
      `---\nname: tdd_workflow\ndescription: TDD guide\n---\n\n# TDD Workflow\nRed-Green-Refactor.`
    );
    writeFileSync(
      join(shitennoDir, "governance", "skill-manifest.yaml"),
      `skills:\n  - id: tdd_workflow\n    path: docs/skills/tdd_workflow.md\n    mandatory: true\n    priority: 0\n    when:\n      task: implementation\n`
    );
  });

  it("inlines mandatory skill content when task metadata matches", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "implementation" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("[MANDATORY] tdd_workflow");
    expect(text).toContain("Red-Green-Refactor");
  });

  it("does not include tdd_workflow when task doesn't match", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "audit" });
    const text = result.content[0]?.text ?? "";
    expect(text).not.toContain("tdd_workflow");
  });

  it("falls back to flat listing when no scope args are given", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, {});
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("tdd_workflow");
  });
});
```

**Acceptance:** this is the layer that proves the MCP surface — the actual thing an external agent calls — behaves as Layer 1 proved the underlying logic does. Layer 1 passing does not imply Layer 3 passes (wiring bugs live exactly in that gap).

---

## Layer 4 — Evidence, at runtime (the layer that actually answers your question)

Layers 1–3 prove the mechanism is *capable* of working. None of them prove it *happened* in a specific real session — that can only be known by recording it. This is the same method that found the original gap: reading `context_buffer.yaml`'s `documents_loaded` field and noticing `AGENTS.md` and every skill were absent.

**Add a new field to the buffer schema:** `skills_resolved`, written by the same code path that calls `partitionSkills` inside `handleGetSkills`/`handleGetBriefing`.

**File:** `src/context-buffer-writer.ts` — new function, modeled directly on the existing `addReminder` (same read → dedupe → regex-insert → write pattern already used for every other list field in this file):

```typescript
export interface SkillResolutionInput {
  skillId: string;
  reason: "mandatory" | "contextual";
  taskMeta: string; // serialized, e.g. "task=implementation,language=typescript"
  resolvedAt: string; // ISO timestamp
}

/**
 * Record that a skill was resolved and delivered for a task — the runtime
 * proof that Layer 1–3's guarantees actually reached a live session.
 * Call this from handleGetSkills / handleGetBriefing whenever
 * partitionSkills(...) returns a non-empty mandatory set.
 */
export function recordSkillResolution(
  shitennoDir: string,
  resolution: SkillResolutionInput
): { success: boolean; message: string; skipped?: boolean } {
  const content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  // Dedup within the same task: same skillId + same taskMeta already logged → skip.
  const dedupeKey = `skillId: "${resolution.skillId}"\n    taskMeta: "${resolution.taskMeta}"`;
  if (content.includes(dedupeKey)) {
    return { success: true, message: "Skill resolution already recorded, skipped", skipped: true };
  }

  const entry = `  - skillId: "${resolution.skillId}"
    reason: "${resolution.reason}"
    taskMeta: "${resolution.taskMeta}"
    resolvedAt: "${resolution.resolvedAt}"
`;

  const sectionRegex = /^skills_resolved:\s*\n/m;
  const match = sectionRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(shitennoDir, updated);
    return { success: true, message: `Skill resolution recorded: ${resolution.skillId}` };
  }

  const updated = "skills_resolved:\n" + entry + "\n" + content;
  writeBuffer(shitennoDir, updated);
  return { success: true, message: `Skill resolution recorded (new section): ${resolution.skillId}` };
}
```

**Wire it into Layer 2/3 of `PLAN_skill_routing_mechanism.md`'s `handleGetSkills`:**

```typescript
if (hasScope) {
  // ...existing resolution...
  for (const entry of mandatory) {
    recordSkillResolution(shitennoDir, {
      skillId: entry.id,
      reason: "mandatory",
      taskMeta: Object.entries(taskMeta).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(","),
      resolvedAt: new Date().toISOString(),
    });
  }
  // ...
}
```

**Template update:** `src/templates/base/governance/context/context_buffer.yaml` gets a new empty `skills_resolved: []` (or section header) added to the default scaffold, so `sectionRegex` always has an anchor to insert after on a freshly-initialized project.

**Acceptance — this is the concrete, checkable answer to your question:** after implementation, to verify a specific task actually got the right skill, don't reason about the mechanism in the abstract — open that project's `context_buffer.yaml` and check `skills_resolved` for the expected `skillId` tied to that task's metadata. If it's not there, the mechanism didn't fire for that session, regardless of whether Layers 1–3 pass. This is also naturally auditable by `shugo audit` later (a Layer-2-style detector could flag an `implementation`-typed task in `docs/BACKLOG.md` with no corresponding `skills_resolved` entry, but that's a follow-on, not required for this plan).

---

## Summary — what each layer answers

| Layer | Question it answers | When it can fail silently without the others |
|---|---|---|
| 1. Unit tests | Is the routing logic itself correct? | Yes — passing logic doesn't mean it's called |
| 2. Audit detector | Is every skill actually reachable by the router? | Yes — reachable doesn't mean requested |
| 3. MCP integration test | Does the tool surface deliver what the logic resolved? | Yes — works in test doesn't mean it ran in a real session |
| 4. Runtime evidence (`skills_resolved`) | Did it actually happen, in this specific session? | This is the layer with no blind spot — it's a fact, not a guarantee |

None of the first three replace the fourth. That's the point of building all four instead of picking the cheapest one.
