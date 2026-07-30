---
category: implementation
lifecycle: Active
---

# 28 — VALIDATION CHECKLIST

> Validation checklist per capability.

## Core Capability

- [ ] `opencode.json` exists at project root
- [ ] `shitenno/` directory exists
- [ ] `shitenno/docs/AGENTS.md` exists
- [ ] `shitenno/docs/FORBIDDEN_OPERATIONS.md` exists (from `src/templates/base/docs/FORBIDDEN_OPERATIONS.md`)
- [ ] `shitenno/docs/DESDO.md` exists
- [ ] `shitenno/docs/CONCEPTUAL_MODEL.md` exists
- [ ] `shitenno/docs/KNOWLEDGE_LIFECYCLE.md` exists
- [ ] `shitenno/docs/backlog/ACTIVE.md` exists
- [ ] `shitenno/governance/SYSTEM_MAP.md` exists
- [ ] `shitenno/docs/opencode-context.md` exists
- [ ] `shitenno/docs/Shitenno_GUIDE.md` exists
- [ ] `shitenno/core/complexity/types.ts` exists
- [ ] `shitenno/docs/feedback/README.md` exists

## Knowledge Capability

- [ ] `shitenno/docs/skills/` directory exists
- [ ] At least 1 skill file present
- [ ] Skills match project stack

## Architecture Capability

- [ ] `shitenno/docs/adrs/` directory exists
- [ ] `shitenno/docs/adrs/ADR-TEMPLATE.md` exists
- [ ] `shitenno/docs/sdr/` directory exists
- [ ] `shitenno/docs/sdr/SDR-TEMPLATE.md` exists
- [ ] `shitenno/governance/plans/` directory exists
- [ ] `shitenno/governance/plans/TEMPLATE.md` exists

## Governance Capability

- [ ] `shitenno/governance/context/` directory exists
- [ ] `shitenno/governance/WORKFLOW.md` exists
- [ ] `shitenno/governance/context/context_buffer.yaml` exists
- [ ] Context buffer is valid YAML

## AI Capability

- [ ] `shitenno/governance/agents/` directory exists
- [ ] At least 1 agent contract exists
- [ ] Agent contracts are valid YAML
- [ ] `shitenno/governance/contracts/CONTRACTS_INDEX.md` exists
- [ ] `shitenno/governance/handoffs/TEMPLATE.md` exists
- [ ] `shitenno/cognition/context/CONTEXT_HIERARCHY.md` exists
- [ ] `shitenno/cognition/memory/MEM-operational-state-v1.json` exists

## Quality Capability

- [ ] `shitenno/scripts/validate-session.ts` exists
- [ ] Script is syntactically valid TypeScript

## Metrics Capability

- [ ] `shitenno/reports/` directory exists
- [ ] `shitenno/docs/history/` directory exists
- [ ] `shitenno/reports/README.md` exists

## Operations Capability

- [ ] `shitenno/docs/runbooks/` directory exists
- [ ] `shitenno/scripts/close-session.ts` exists
- [ ] `shitenno/scripts/premortem-check.ts` exists
- [ ] `shitenno/docs/runbooks/merge.md` exists

## Compliance Capability

- [ ] `shitenno/governance/premortem/` directory exists
- [ ] `shitenno/governance/premortem/PREMORTEM.md` exists
- [ ] `shitenno/governance/reviews/` directory exists
- [ ] `shitenno/governance/reviews/SESSION_REVIEW.md` exists

## System-Wide Checks

- [ ] `shugo status` runs without errors
- [ ] `shugo validate` passes all checks
- [ ] `shugo detect` completes successfully
- [ ] `shugo audit` completes successfully
- [ ] `shugo doctor` completes successfully
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] All tests pass (`npm test`)
