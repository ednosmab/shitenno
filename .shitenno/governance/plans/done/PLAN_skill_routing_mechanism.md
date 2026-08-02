# Plan — Deterministic Skill Routing (MCP-first, opencode-compatible)

**Status:** Done

> Third plan, separate from identity/documentation and from quality-gate tooling on purpose: this one is about a runtime mechanism, not content. Focused on the MCP server as the primary injection surface, with an explicit compatibility path so `opencode.json` users get the same effective behavior without hand-maintained duplication.

## Phase 0 — Organize before building (as requested)

Three files currently instruct the agent to "check `governance/SYSTEM_MAP.md` for the skill path for this task" — a table that, confirmed in this investigation, does not exist there:

- `docs/AGENTS.md` (Passo 1: "Use o MCP para ler a Skill... específica da camada")
- `cognition/context/CONTEXT_HIERARCHY.md` (P2 row)
- `docs/rules/lazy-loading.md` (rule 3)

Action: once Phase 1 below exists, update these three references to point at the new mechanism (the MCP tool, not a static file to grep) instead of `SYSTEM_MAP.md`. Do not leave three files pointing at a promise that isn't kept — that's the exact failure mode this whole investigation has been finding repeatedly.

Also fix: `docs/opencode-context.md` declares a `loading_profile` where the default (`lite`) does not load skills at all — only `full` does, "sob demanda" (on demand, meaning still not automatic even in `full`). If mandatory skills should reliably reach the agent, `lite` cannot mean "skills are entirely absent." Redefine `lite` to still include mandatory skills (see Phase 1) — only *contextual* skills should be gated behind `full`/on-demand.

---

## Phase 1 — Extend the existing manifest mechanism to skills

**Do not build a parallel system.** `src/rule-manifest.ts` already does deterministic, explicit field-matching (no embeddings, no inference — the file's own header states this as a principle), with `mandatory`, `priority`, and `when` conditions. Skills need exactly this, applied to a different file set.

### 1.1 — New manifest file

**Template file:** `src/templates/base/governance/skill-manifest.yaml`

```yaml
# skill-manifest.yaml — Declarative skill selection by task metadata.
# Same input -> same skill set, always (deterministic). Mirrors rule-manifest.yaml.

skills:
  - id: tdd_workflow
    path: docs/skills/tdd_workflow.md
    mandatory: true          # applies to every implementation task, no `when` needed
    priority: 0
    when:
      task: implementation

  - id: clean_code_standards
    path: docs/skills/clean_code_standards.md
    mandatory: true
    priority: 1
    when:
      task: implementation

  - id: solid_principles
    path: docs/skills/solid_principles.md
    priority: 2
    when:
      task: implementation
      language: typescript

  - id: architectural_integrity
    path: docs/skills/architectural_integrity.md
    priority: 2
    when:
      task: refactor

  - id: security_xss_prevention
    path: docs/skills/security_xss_prevention.md
    priority: 1
    when:
      layer: frontend

  - id: ci_cd_pipeline
    path: docs/skills/ci_cd_pipeline.md
    priority: 3
    when:
      task: infra
```

Note `mandatory: true` combined with `when` — unlike the current rule-manifest (where `mandatory` short-circuits `when` entirely), skill mandatoriness should be **scoped** ("mandatory for implementation tasks", not "mandatory always" — a skill like `tdd_workflow` has no reason to load for a documentation-only task). This is a small, deliberate divergence from `resolveRules`'s current behavior — see 1.2.

### 1.2 — Code change: generalize `resolveRules` instead of copying it

`src/rule-manifest.ts` today:

```typescript
export function resolveRules(
  manifest: RuleManifestEntry[],
  taskMeta: TaskMetadata
): RuleManifestEntry[] {
  const selected = manifest.filter((rule) => {
    if (rule.mandatory) return true;              // <- unconditional mandatory
    if (!rule.when) return false;
    return Object.entries(rule.when).every(
      ([key, value]) => taskMeta[key] === value
    );
  });
  return selected.sort((a, b) => a.priority - b.priority);
}
```

Proposed: extract the generic part into a new, shared module `src/manifest-resolver.ts`, since the matching logic (field equality, priority sort) is identical for rules and skills — only the "does `mandatory` ignore `when`" behavior differs:

```typescript
// src/manifest-resolver.ts — shared deterministic resolver for rule-manifest.yaml and skill-manifest.yaml.

export interface ManifestEntry {
  id: string;
  path: string;
  mandatory?: boolean;
  priority: number;
  when?: Record<string, string>;
}

export interface TaskMetadata {
  task?: string;
  language?: string;
  framework?: string;
  layer?: string;
  [key: string]: string | undefined;
}

function matchesWhen(when: Record<string, string> | undefined, taskMeta: TaskMetadata): boolean {
  if (!when) return true; // no condition = always matches once selected
  return Object.entries(when).every(([key, value]) => taskMeta[key] === value);
}

/**
 * Resolve which entries apply to a task, ordered by priority (0 = highest).
 *
 * `unconditionalMandatory: true` (rule-manifest.yaml behavior) — mandatory
 * entries always apply, `when` is ignored for them.
 *
 * `unconditionalMandatory: false` (skill-manifest.yaml behavior) — mandatory
 * entries still need `when` to match; `mandatory` only means "not optional
 * once in scope", not "always in scope".
 */
export function resolveEntries(
  manifest: ManifestEntry[],
  taskMeta: TaskMetadata,
  options: { unconditionalMandatory: boolean }
): ManifestEntry[] {
  const selected = manifest.filter((entry) => {
    if (entry.mandatory && options.unconditionalMandatory) return true;
    return matchesWhen(entry.when, taskMeta);
  });
  return selected.sort((a, b) => a.priority - b.priority);
}

export function partitionEntries(
  manifest: ManifestEntry[],
  taskMeta: TaskMetadata,
  options: { unconditionalMandatory: boolean }
): { mandatory: ManifestEntry[]; contextual: ManifestEntry[] } {
  const resolved = resolveEntries(manifest, taskMeta, options);
  return {
    mandatory: resolved.filter((e) => e.mandatory),
    contextual: resolved.filter((e) => !e.mandatory),
  };
}
```

`rule-manifest.ts` becomes a thin wrapper (`unconditionalMandatory: true`) to avoid a breaking change for existing callers:

```typescript
// src/rule-manifest.ts (after refactor)
import { resolveEntries, partitionEntries, type ManifestEntry, type TaskMetadata } from "./manifest-resolver.js";
export type { TaskMetadata };
export type RuleManifestEntry = ManifestEntry;

export function resolveRules(manifest: RuleManifestEntry[], taskMeta: TaskMetadata) {
  return resolveEntries(manifest, taskMeta, { unconditionalMandatory: true });
}
export function partitionRules(manifest: RuleManifestEntry[], taskMeta: TaskMetadata) {
  return partitionEntries(manifest, taskMeta, { unconditionalMandatory: true });
}
export { loadManifest } from "./manifest-resolver.js"; // if loadManifest also moves; otherwise keep local
```

New `src/skill-manifest.ts`, same shape:

```typescript
import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { resolveEntries, partitionEntries, type ManifestEntry, type TaskMetadata } from "./manifest-resolver.js";

export type SkillManifestEntry = ManifestEntry;
export type { TaskMetadata };

export function loadSkillManifest(manifestPath: string): SkillManifestEntry[] {
  const raw = readFileSync(manifestPath, "utf-8");
  return (parseYaml(raw) as { skills: SkillManifestEntry[] }).skills;
}

export function resolveSkills(manifest: SkillManifestEntry[], taskMeta: TaskMetadata) {
  return resolveEntries(manifest, taskMeta, { unconditionalMandatory: false });
}
export function partitionSkills(manifest: SkillManifestEntry[], taskMeta: TaskMetadata) {
  return partitionEntries(manifest, taskMeta, { unconditionalMandatory: false });
}
```

**Why this shape:** it's the smallest possible change that avoids duplicating the field-matching logic (the actual risk of drift), keeps `rule-manifest.ts`'s public API backward-compatible (no caller of `resolveRules`/`partitionRules` needs to change), and gives skills their own, correctly-different mandatoriness semantics without contaminating rules.

---

## Phase 2 — MCP server: make `getSkills` scope-aware (the primary injection point)

Current `handleGetSkills` (in `mcp-server-handlers.ts`) only supports fetching one named skill or listing all of them flat — no task metadata, no resolution. Proposed:

```typescript
export async function handleGetSkills(
  _projectRoot: string,
  shitennoDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const name = args.name as string | undefined;

  // Existing behavior: direct lookup by name, unchanged.
  if (name) {
    const skill = getSkill(shitennoDir, name);
    if (!skill) return { content: [{ type: "text", text: `Skill "${name}" not found` }] };
    return { content: [{ type: "text", text: skill.content }] };
  }

  // New: scope-aware resolution when task metadata is provided.
  const taskMeta: TaskMetadata = {
    task: args.task as string | undefined,
    language: args.language as string | undefined,
    framework: args.framework as string | undefined,
    layer: args.layer as string | undefined,
  };
  const hasScope = Object.values(taskMeta).some(Boolean);

  if (hasScope) {
    const manifestPath = join(shitennoDir, "governance", "skill-manifest.yaml");
    if (existsSync(manifestPath)) {
      const manifest = loadSkillManifest(manifestPath);
      const { mandatory, contextual } = partitionSkills(manifest, taskMeta);

      // Mandatory skills: full content, inlined — the agent should not need
      // a second round-trip to read what it's required to follow.
      const mandatoryBlocks = mandatory
        .map((entry) => getSkill(shitennoDir, entry.id))
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => `## [MANDATORY] ${s.name}\n${s.content}`);

      // Contextual skills: metadata only, so the agent knows they exist
      // and can fetch by name if relevant — keeps the response bounded.
      const contextualList = contextual
        .map((entry) => `- ${entry.id} (available — fetch by name if needed)`)
        .join("\n");

      const text = [...mandatoryBlocks, contextualList ? `## Also available for this scope\n${contextualList}` : ""]
        .filter(Boolean)
        .join("\n\n");

      return { content: [{ type: "text", text: text || "No skills matched this scope." }] };
    }
  }

  // Fallback: existing flat list behavior, unchanged.
  const summaries = listSkills(shitennoDir);
  const text = summaries.map((s) => `${s.name}: ${s.description}`).join("\n");
  return { content: [{ type: "text", text: text || "No skills found." }] };
}
```

Update the MCP tool schema (`TOOLS` array in `mcp-server.ts`) to advertise the new optional args:

```typescript
{
  name: "getSkills",
  description:
    "Get skills. Pass `name` for a specific skill, or `task`/`language`/`framework`/`layer` " +
    "to resolve which skills are mandatory or relevant for that scope of work — mandatory " +
    "skills are returned in full, others as pointers.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: { type: "string" as const, description: "Specific skill name or filename." },
      task: { type: "string" as const, description: "e.g. implementation, refactor, audit, infra." },
      language: { type: "string" as const },
      framework: { type: "string" as const },
      layer: { type: "string" as const, description: "e.g. frontend, backend, daemon, cli." },
    },
  },
},
```

---

## Phase 3 — Reinforce at the briefing level (redundancy, not reliance on one call)

`getBriefing` is the tool every session is instructed to call first. Skill resolution should not depend on the agent remembering to also call `getSkills` with the right arguments — that's the same failure mode already found in the `context_buffer.yaml` log (P0 rules existed but weren't loaded because nothing forced it).

Proposed: `handleGetBriefing` infers a coarse `task` from context already available to it (e.g., recent git diff status, or an explicit `task` arg the caller can pass) and appends a `mandatorySkills` field to the briefing JSON/markdown output, populated via the same `partitionSkills(...).mandatory` call. Even a partial/best-effort inference is strictly better than the current state, where briefing carries risk/rules but never skills at all.

This creates two independent paths to the same mandatory skills (briefing, and explicit `getSkills` call) — redundancy is the point, given the manifest already showed one skipped read is enough to lose the rule in practice.

---

## Phase 4 — opencode.json parity, without hand-maintained duplication

Today, `opencode.json`'s `instructions` array hardcodes exactly one skill (`quick-board-enforcement.md`) — a manual, easy-to-forget list, disconnected from the manifest this plan introduces.

Proposed: at `shugo init` / `shugo sync`, generate a file — `governance/MANDATORY_CONTEXT.md` — that concatenates every skill and rule that is `mandatory` **with no `when` condition** (i.e., applies to literally every session, the opencode-safe subset — task-scoped mandatory skills can't be pre-resolved at generation time since opencode has no equivalent of a live `getSkills(taskMeta)` call). Point `opencode.json`'s `instructions` array at that one generated file instead of listing individual skills by hand:

```json
"instructions": [
  "./shitenno/docs/AGENTS.md",
  "./shitenno/docs/opencode-context.md",
  "./shitenno/docs/rules/*.md",
  "./shitenno/governance/MANDATORY_CONTEXT.md",
  "./shitenno/governance/**/*.yaml",
  "./shitenno/governance/context/context_buffer.yaml"
],
```

This means: MCP-based agents get precise, scope-resolved skills at call time (the strong mechanism). opencode-native agents, which can't call MCP tools mid-session the same way, get the always-applicable subset auto-injected at session start, generated from the exact same manifest — so the two paths can't drift into disagreement about what's mandatory. Task-scoped skills (e.g. `tdd_workflow` only for `task: implementation`) remain best served through the MCP path; for opencode, `docs/AGENTS.md`'s existing Passo 1 instruction to consult skills by scope stays as the fallback for those, now pointing at the manifest instead of at `SYSTEM_MAP.md`.

**Implementation location:** a new function in `src/scaffolder.ts` (or a new `src/mandatory-context-generator.ts`), invoked by `shugo init` and by the existing `sync-docs.ts` script referenced in `capabilities.md`, so the generated file never goes stale relative to the manifest.

---

## Phase 5 — Update the three pointer files (closes Phase 0)

- `docs/rules/lazy-loading.md` rule 3 → replace "use `governance/SYSTEM_MAP.md`" with "call the `getSkills` MCP tool with the task's `task`/`language`/`framework`/`layer`".
- `cognition/context/CONTEXT_HIERARCHY.md` P2 row → same correction, plus a note that mandatory skills also arrive pre-attached to `getBriefing` (Phase 3).
- `docs/AGENTS.md` Passo 1 → same correction.
- `docs/opencode-context.md` → redefine `lite` profile to include mandatory context (Phase 4's generated file), keep `full` for on-demand contextual skills.

---

## Acceptance criteria (end to end)

1. A skill marked `mandatory: true` with a matching `when` in `skill-manifest.yaml` is returned, in full, by `getSkills` when called with matching task metadata — without the caller needing to know the skill's name in advance.
2. `getBriefing`'s output includes those same mandatory skills without a second tool call.
3. An opencode session (no MCP mid-session calls) still receives the unconditionally-mandatory subset automatically via `instructions`, generated from the same manifest — not hand-maintained separately.
4. `docs/rules/lazy-loading.md`, `CONTEXT_HIERARCHY.md`, and `docs/AGENTS.md` no longer point at `SYSTEM_MAP.md` for skill resolution.
5. Re-running the exact scenario that surfaced this gap (a session's `context_buffer.yaml` `documents_loaded` log) — a TDD-relevant task should show the TDD skill present in the resolved/injected set, not absent by default.
