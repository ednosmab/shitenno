# Plan — Single Source of Truth for Identity & Domain Documentation

**Status:** Done

> Execution document for the agent. This plan **extends** the existing `docs/engineering/DOCUMENTATION_GOVERNANCE.md` — it does not replace it. Governance structure (domains, lifecycle states, quality gates) already exists; what's missing is the identity entry and enforcement.
>
> Companion plan (separate, do not merge): `PLAN_quality_gates_tooling.md` — covers making the existing but unenforced `category`/`lifecycle` quality gate real.

## Diagnosis (validated end-to-end, not surface-level)

The identity of the project is defined in parallel, with conflict, in at least 5 places:

| File | Claims the project is | Problem |
|---|---|---|
| `package.json` (`description`) | "AI governance framework" | Uses "framework" |
| `README.md` (before this session) | "A CLI tool" | Reduces the project to the CLI |
| `docs/handbook/01-fundamentals/what-is-shitenno.md` | "Um framework de governança" | Uses "framework" again; missing daemon, MCP, and the LLM bridge; also in Portuguese, contradicting the stated canonical-language policy |
| `docs/handbook/philosophy/engineering-manifesto.md` | "Shugo" etymology = "a connection" | 守護 (shugo) means "guardian/protection", not "connection" — factual error in the symbolic foundation |
| `docs/domain/problem-statement.md` | Correct, precise definition | Correct, but not cited as the source by anything else |

Root cause: not a lack of documentation — a lack of **one canonical entry for identity** inside the governance structure that already exists.

**Validated system boundaries** (confirmed against code, not assumed):
- **Shugo** = the CLI binary, single entry point (~35 commands).
- **`.shitenno/`** = per-project generated artifact.
- **Daemon** = one process per project (`shitennoDir` is always resolved from `projectRoot`, confirmed in `src/shared.ts` / `constants.ts` — no global/shared daemon). It has no independent entry point; it's always spawned by the CLI (`cli-middleware.ts` auto-start, or `shugo daemon start`). Once spawned it runs `detached`/`unref()` — autonomous, but the CLI never depends on it (`daemon-client.ts`: *"The daemon is opt-in. The CLI always works without it."*, disk fallback everywhere).
- **MCP server** (`shugo mcp`) = the human↔LLM bridge, confirmed via `mcp-server-handlers.ts`, including a literal `// ── Knowledge Bridge` comment in the code. Tools: `getBriefing`, `getRiskMap`, `getRules`, `getEngineeringState`, `getBacklog`, `getADRs`, `getSkills`. Feedback loop: `handleSubmitFeedback` records outcome tied to the briefing's hash.
- **CLI TUI dashboard** (`shugo dashboard` → `ShitennoConsole`) genuinely operates the system: `use-command.ts` executes real `shugo` subcommands via `exec()`, categorized `read-only / management / destructive`, with `requiresConfirmation` gating.
- **Web dashboard** (`apps/shitenno-dashboard/`) is read-only today: static Vite/React app reading files directly off disk via a hardcoded relative path, no backend, no write path. (Out of scope for this plan — deferred per your call; noted here only so the identity doc doesn't overstate it.)
- **`shugo handbook`** is not static docs — it's a CLI command that renders `docs/handbook/` interactively (`findHandbookRoot` walks up looking for a `docs/handbook` directory by name). **Any restructuring that moves or renames `docs/handbook/` breaks this command** — must be updated in lockstep.
- **`src/templates/base/`** is a **third, distinct documentation domain**: not documentation *about* Shitenno, but the product artifact Shitenno *generates inside third-party projects* on `shugo init` (includes its own `docs/AGENTS.md`, skills, governance files, workflow rules for the AI agents operating in the end user's project). `DOCUMENTATION_GOVERNANCE.md` already anticipated this — it lists a `product` domain ("Scaffolded template docs") — it's just never been used. **This domain must never be merged with or confused with the identity docs describing Shitenno itself.**

---

## Phase 1 — Create the canonical identity entry

**New file:** `docs/domain/identity.md`

Content:
1. The validated definition above, expanded.
2. The three components (Shugo / `.shitenno/` / daemon), with the exact dependency relationship: daemon needs the CLI to be born, but runs isolated after; CLI never depends on the daemon.
3. The MCP bridge, with the tool list and the feedback loop.
4. Explicit "What it is not" section.
5. "Current state vs. design direction" section, linking to `docs/evolution/`.
6. A note on terminology decisions: why "framework" and "platform" were rejected (framework = imported into application code; platform = hosted/multi-tenant — neither applies), and why "ecosystem" is design intent (plugin system, capability model) rather than current state (no third-party contributors yet).
7. Explicit boundary statement: this document describes **Shitenno the system**; it does **not** describe `src/templates/base/` (the product output shipped into end-user projects) — that belongs to the `product` domain, already defined in `DOCUMENTATION_GOVERNANCE.md`.

**Update `docs/engineering/DOCUMENTATION_GOVERNANCE.md` — Canonical Sources table:**

```markdown
| Subject | Canonical Document |
|---------|-------------------|
| Domain glossary | docs/domain/ubiquitous-language.md |
| Engineering principles | docs/handbook/philosophy/principles.md |
| Module validation | docs/architecture/validation-matrix.md |
| Active work | shitenno/docs/BACKLOG.md |
| Project identity ("what is Shitenno") | docs/domain/identity.md |
| Problem it solves | docs/domain/problem-statement.md |
```

**Acceptance criteria:** any other document in the project that needs to explain "what is Shitenno" can replace its own text with a link to this file without losing information.

---

## Phase 2 — Fix the identified conflicts

- **`package.json`** → `description` field: remove "framework", align with `identity.md`.
- **`docs/handbook/01-fundamentals/what-is-shitenno.md`** → add a section citing `identity.md`, add daemon and MCP (currently missing), remove "framework" from the line `O **Shitenno** é um framework de governança...`. Translate to English per the language decision below, or explicitly mark as legacy Portuguese content per policy — see note.
- **`docs/handbook/philosophy/engineering-manifesto.md`** → fix "Shugo" definition: means guardian/protection (consistent with "Shitenno" = the Four Heavenly Kings, guardian deities), not "connection". Review whether the narrative built on the wrong etymology needs adjustment.
- **`README.md`** → ✅ done this session, in English per the canonical-language policy (attached).

**Language note:** the project's own governance states English is canonical and Portuguese is legacy-only, valid until modified. Several files that define identity (`what-is-shitenno.md`, parts of `history/`, `feedback/`) are in Portuguese. Decision needed per-file as each is touched in this plan: translate to English (aligns with stated policy) or formally revise the policy to allow Portuguese for handbook/onboarding content specifically. Recommend resolving this once, in `DOCUMENTATION_GOVERNANCE.md` itself, rather than file by file.

**Acceptance criteria:** searching `docs/` and `package.json` for "framework" and for the etymology error — zero occurrences describing the project's core identity incorrectly.

---

## Phase 3 — Separate "current state" from "design direction"

`docs/evolution/` has 35+ files mixing current architecture with unimplemented roadmap. This already caused a real misreading of the project's depth earlier in this review.

Action: reuse the existing ADR convention already in the codebase (`ADR-001-single-agent-architecture.md` uses `⚠️ Retroactive ADR — documented [date], decision made earlier`) rather than inventing a new format. Add to the top of every file in `docs/evolution/` (except `00-EXECUTIVE-SUMMARY.md` and `01-CURRENT-STATE-ASSESSMENT.md`, which are already state-of-the-art descriptive by nature):

```markdown
> ⚠️ **Design direction — not implemented.** This document describes target architecture, not current code state. See `docs/evolution/01-CURRENT-STATE-ASSESSMENT.md` for what already exists.
```

**Acceptance criteria:** every file under `docs/evolution/domain/`, `docs/evolution/platform/`, `docs/evolution/quality/`, `docs/evolution/roadmap/`, `docs/evolution/ai/` carries the notice.

---

## Phase 4 — Navigation index by semantic layer

**File:** `docs/INDEX.md`

Add an intent-first section above the current flat listing:

```markdown
## Start here, depending on what you're looking for

- **What is the project?** → [`docs/domain/identity.md`](domain/identity.md)
- **Why does it exist?** → [`docs/domain/problem-statement.md`](domain/problem-statement.md)
- **Where is it going?** → [`docs/evolution/00-EXECUTIVE-SUMMARY.md`](evolution/00-EXECUTIVE-SUMMARY.md)
- **How do I use it?** → [`docs/handbook/01-fundamentals/quick-start.md`](handbook/01-fundamentals/quick-start.md)
- **How do I contribute?** → [`docs/engineering/CONTRIBUTING.md`](engineering/CONTRIBUTING.md)
- **What does Shitenno generate inside my project?** → `src/templates/base/` (product domain — distinct from the docs above, which describe Shitenno itself)
- **Project vocabulary?** → [`docs/domain/ubiquitous-language.md`](domain/ubiquitous-language.md)
```

**Acceptance criteria:** a new reader reaches the right answer in one click from `docs/INDEX.md`, without scanning ~120 files.

---

## Phase 5 — Single glossary

**Canonical file:** `docs/domain/ubiquitous-language.md` (already exists, keep its structure)

Action: review `docs/architecture/knowledge-debt.md` and `docs/domain/knowledge.md` — both define terms that also appear in `ubiquitous-language.md`. Wherever there's redefinition (even subtle), replace with the glossary's definition + link, not a rewritten concept.

Specific term to resolve: **"kernel"** — mentioned in conversation/intent but does not exist today as a named module in the code (the CLI↔daemon orchestration is done by `cli-middleware.ts` + `daemon-client.ts` + `daemon/index.ts`). Pending decision: either (a) formally adopt "kernel" and document/rename these three files under that concept, or (b) drop the term and keep current naming. **Do not document "kernel" as if it already exists until this decision is made.**

**Acceptance criteria:** each domain term (Knowledge Debt, Engineering State, Capability, etc.) has exactly one canonical definition; every other occurrence links to it.

---

## Explicit non-goals of this plan

- Does not touch `src/templates/base/` content — that's product-domain documentation, tracked separately if/when needed.
- Does not touch the web dashboard (`apps/shitenno-dashboard/`) — deferred per your decision; too much active technical debt to prioritize now.
- Does not implement the `category`/`lifecycle` quality gate enforcement — see the companion plan `PLAN_quality_gates_tooling.md`.

## Recommended execution order

1. Phase 1 (canonical entry) — blocks everything else.
2. Phase 2 (fix conflicts) — depends on Phase 1 existing to link to.
3. Phase 4 (index) — fast, can run in parallel with Phase 2.
4. Phase 3 (roadmap notices) — mechanical, batchable.
5. Phase 5 (glossary) — last, depends on the pending "kernel" decision.

---

## Execution Record

**Executed:** 2026-07-22

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Canonical identity entry | ✅ Done | Created `docs/domain/identity.md`, updated `DOCUMENTATION_GOVERNANCE.md` |
| Phase 2 — Fix conflicts | ✅ Done | Fixed `package.json`, translated `what-is-shitenno.md` to English, corrected Shugo etymology in `engineering-manifesto.md` |
| Phase 3 — Design direction banners | ✅ Done | Added banners to all 31 evolution files (except `00-EXECUTIVE-SUMMARY.md` and `01-CURRENT-STATE-ASSESSMENT.md`) |
| Phase 4 — Navigation index | ✅ Done | Added intent-first section to `docs/INDEX.md` |
| Phase 5 — Glossary cross-links | ✅ Done | Added cross-links to `ubiquitous-language.md` in `knowledge-debt.md` and `knowledge.md` |
| Typecheck | ✅ Passed | `tsc --noEmit` — zero errors |

**Deferred (per plan):** "kernel" terminology decision — plan notes this as pending, not blocking. The term is not documented as existing until formally adopted.
