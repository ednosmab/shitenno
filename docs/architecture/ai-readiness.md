---
category: architecture
lifecycle: Active
---

# 10 — AI READINESS

> What does it mean for a project to be "ready for AI"?

## Definition

**AI Readiness** is the measure of how well a project can support AI agents working on its codebase. It answers: "If an AI agent starts working on this project today, will it follow our governance rules?"

## The AI Readiness Spectrum

```
Level 0: No governance
  → AI agents operate without rules
  → Risk: agents make arbitrary decisions

Level 1: Basic governance
  → AGENTS.md defines rules
  → AI agents can read rules but may not follow them

Level 2: Contracted governance
  → Agent contracts define permissions
  → AI agents are bound by allowed/restricted actions

Level 3: Contextual governance
  → Context hierarchy (P0-P4) controls what agents read
  → AI agents receive governed, hierarchical context

Level 4: Autonomous governance
  → Rule engine enforces governance automatically
  → AI agents are governed without human intervention
```

## The Five Pillars of AI Readiness

### 1. Governance Rules

Without rules, agents have no constraints.

**Required:**
- `docs/AGENTS.md` — Engineering rules for AI teams
- `src/templates/base/docs/FORBIDDEN_OPERATIONS.md` — Absolute binding rules

**Ideal:**
- `governance/rules/` — Declarative rules for the rule engine

### 2. Agent Contracts

Without contracts, agents don't know their role.

**Required:**
- At least one agent contract (planner, executor, reviewer, or orchestrator)

**Ideal:**
- All 4 contracts: planner, executor, reviewer, orchestrator
- `governance/contracts/CONTRACTS_INDEX.md`

### 3. Context Hierarchy

Without context control, agents read everything (expensive) or nothing (blind).

**Required:**
- `cognition/context/CONTEXT_HIERARCHY.md` — P0-P4 loading rules

**Ideal:**
- Context buffer with current session state
- Loading profiles (minimal/lite/full)

### 4. Workflow Definition

Without workflows, agents don't know the process.

**Required:**
- `governance/WORKFLOW.md` — The 5-step flow

**Ideal:**
- Operation-specific flows (FEATURE, BUG, REFACTOR, etc.)
- Handoff templates

### 5. Feedback Mechanism

Without feedback, agents can't learn from mistakes.

**Required:**
- `docs/feedback/` directory for session feedback

**Ideal:**
- Structured feedback format
- Feedback-to-rule pipeline

## Measuring AI Readiness

Shugo detects AI readiness by checking filesystem presence:

```typescript
function assessAIReadiness(shitennoDir: string): AIReadinessReport {
  return {
    governanceRules: checkGovernanceRules(shitennoDir),
    agentContracts: checkAgentContracts(shitennoDir),
    contextHierarchy: checkContextHierarchy(shitennoDir),
    workflowDefinition: checkWorkflowDefinition(shitennoDir),
    feedbackMechanism: checkFeedbackMechanism(shitennoDir),
    overallScore: calculateScore(...),
  };
}
```

## The AI Capability

The `ai` capability installs:
- 4 agent contracts (planner, executor, reviewer, orchestrator)
- CONTRACTS_INDEX.md
- Handoff template
- Context hierarchy
- Operational memory
- Prompt READMEs for each role

**Dependencies:** Requires `governance` capability.

## Why AI Readiness Matters

As AI agents become more common in engineering teams, the projects that are ready for them will have a significant advantage:

| Without AI Readiness | With AI Readiness |
|---------------------|-------------------|
| Agents make arbitrary decisions | Agents follow governance rules |
| Agents read everything (slow, expensive) | Agents read only what they need |
| Agents don't know their role | Agents have clear contracts |
| Agents can't explain their actions | Agents produce auditable trails |
| Governance breaks down with AI | Governance scales with AI |

## Implementation

- **Detection:** `detectInstalledCapabilities()` in `src/maturity-profile.ts`
- **AI dimension:** Part of maturity profile calculation
- **Capability installation:** `src/commands/upgrade.ts`
- **Agent contracts:** `src/templates/base/governance/agents/`
