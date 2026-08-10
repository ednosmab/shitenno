/**
 * capability-mapping.ts — Shared Capability → File Mapping
 *
 * Fonte única de verdade para o mapeamento capacidade→ficheiros.
 * Usado tanto pelo scaffolder (init) como pelo upgrade (add capability).
 *
 * PRINCÍPIO: Um único sítio de definição — zero divergência.
 */

import { SHITENNO_DIR_NAME } from "./constants.js";
import type { Capability } from "../../application/maturity-profile.js";

export interface CapabilityFile {
  src: string;
  dest: string;
  customize?: boolean;
}

export interface CapabilityMapping {
  directories: string[];
  files: CapabilityFile[];
}

/**
 * Mapeamento completo de capacidades para diretórios e arquivos.
 * Cada capacidade define exactamente o que instala.
 */
const CAPABILITY_MAPPINGS: Record<Capability, CapabilityMapping> = {
  core: {
    directories: [
      SHITENNO_DIR_NAME,
      `${SHITENNO_DIR_NAME}/docs`,
      `${SHITENNO_DIR_NAME}/scripts`,
      `${SHITENNO_DIR_NAME}/core`,
      `${SHITENNO_DIR_NAME}/core/complexity`,
      `${SHITENNO_DIR_NAME}/governance`,
      `${SHITENNO_DIR_NAME}/governance/agents`,
      `${SHITENNO_DIR_NAME}/governance/context`,
      `${SHITENNO_DIR_NAME}/profile`,
      `${SHITENNO_DIR_NAME}/docs/feedback`,
    ],
    files: [
      { src: "docs/AGENTS.md", dest: `${SHITENNO_DIR_NAME}/docs/AGENTS.md`, customize: true },
      { src: "docs/opencode-context.md", dest: `${SHITENNO_DIR_NAME}/docs/opencode-context.md`, customize: true },
      { src: "docs/Shitenno_GUIDE.md", dest: `${SHITENNO_DIR_NAME}/docs/Shitenno_GUIDE.md`, customize: true },
      { src: "docs/CONCEPTUAL_MODEL.md", dest: `${SHITENNO_DIR_NAME}/docs/CONCEPTUAL_MODEL.md` },
      { src: "docs/KNOWLEDGE_LIFECYCLE.md", dest: `${SHITENNO_DIR_NAME}/docs/KNOWLEDGE_LIFECYCLE.md` },
      { src: "docs/FORBIDDEN_OPERATIONS.md", dest: `${SHITENNO_DIR_NAME}/docs/FORBIDDEN_OPERATIONS.md` },
      { src: "docs/DESDO.md", dest: `${SHITENNO_DIR_NAME}/docs/DESDO.md` },
      { src: "docs/backlog/ACTIVE.md", dest: `${SHITENNO_DIR_NAME}/docs/backlog/ACTIVE.md` },
      { src: "docs/backlog/DONE.md", dest: `${SHITENNO_DIR_NAME}/docs/backlog/DONE.md` },
      { src: "docs/capabilities.md", dest: `${SHITENNO_DIR_NAME}/docs/capabilities.md`, customize: true },
      { src: "core/complexity/types.ts", dest: `${SHITENNO_DIR_NAME}/core/complexity/types.ts` },
      { src: "docs/feedback/README.md", dest: `${SHITENNO_DIR_NAME}/docs/feedback/README.md` },
      { src: "governance/SYSTEM_MAP.md", dest: `${SHITENNO_DIR_NAME}/governance/SYSTEM_MAP.md`, customize: true },
      { src: "governance/context/context_buffer.yaml", dest: `${SHITENNO_DIR_NAME}/governance/context/context_buffer.yaml` },
    ],
  },
  knowledge: {
    directories: [
      `${SHITENNO_DIR_NAME}/docs/skills`,
    ],
    files: [], // Skills are copied separately via selectSkills
  },
  architecture: {
    directories: [
      `${SHITENNO_DIR_NAME}/docs/adrs`,
      `${SHITENNO_DIR_NAME}/docs/sdr`,
      `${SHITENNO_DIR_NAME}/governance/plans`,
      `${SHITENNO_DIR_NAME}/docs/session-template`,
      `${SHITENNO_DIR_NAME}/docs/layers`,
    ],
    files: [
      { src: "docs/adrs/ADR-TEMPLATE.md", dest: `${SHITENNO_DIR_NAME}/docs/adrs/ADR-TEMPLATE.md` },
      { src: "docs/adrs/ADR-000-exemplo.md", dest: `${SHITENNO_DIR_NAME}/docs/adrs/ADR-000-exemplo.md` },
      { src: "docs/sdr/SDR-TEMPLATE.md", dest: `${SHITENNO_DIR_NAME}/docs/sdr/SDR-TEMPLATE.md` },
      { src: "governance/plans/TEMPLATE.md", dest: `${SHITENNO_DIR_NAME}/governance/plans/TEMPLATE.md` },
      { src: "docs/session-template.md", dest: `${SHITENNO_DIR_NAME}/docs/session-template.md` },
    ],
  },
  governance: {
    directories: [
      `${SHITENNO_DIR_NAME}/governance/context`,
      `${SHITENNO_DIR_NAME}/docs/rules`,
    ],
    files: [
      { src: "governance/WORKFLOW.md", dest: `${SHITENNO_DIR_NAME}/governance/WORKFLOW.md`, customize: true },
      { src: "governance/context/context_buffer.yaml", dest: `${SHITENNO_DIR_NAME}/governance/context/context_buffer.yaml` },
      { src: "docs/rules/agent-modes.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/agent-modes.md` },
      { src: "docs/rules/branch-policy.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/branch-policy.md` },
      { src: "docs/rules/context-algorithm.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/context-algorithm.md` },
      { src: "docs/rules/dependency-graph.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/dependency-graph.md` },
      { src: "docs/rules/feedback-protocol.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/feedback-protocol.md` },
      { src: "docs/rules/lazy-loading.md", dest: `${SHITENNO_DIR_NAME}/docs/rules/lazy-loading.md` },
    ],
  },
  ai: {
    directories: [
      `${SHITENNO_DIR_NAME}/governance/contracts`,
      `${SHITENNO_DIR_NAME}/governance/handoffs`,
      `${SHITENNO_DIR_NAME}/governance/policies`,
      `${SHITENNO_DIR_NAME}/governance/rules`,
      `${SHITENNO_DIR_NAME}/cognition`,
      `${SHITENNO_DIR_NAME}/cognition/context`,
      `${SHITENNO_DIR_NAME}/cognition/memory`,
      `${SHITENNO_DIR_NAME}/cognition/prompts`,
      `.opencode/plugin`,
      `${SHITENNO_DIR_NAME}/cognition/prompts/executor`,
      `${SHITENNO_DIR_NAME}/cognition/prompts/planner`,
      `${SHITENNO_DIR_NAME}/cognition/prompts/reviewer`,
      `${SHITENNO_DIR_NAME}/plugins`,
      `${SHITENNO_DIR_NAME}/plugins/event-logger`,
      `${SHITENNO_DIR_NAME}/plugins/health-monitor`,
      `${SHITENNO_DIR_NAME}/plugins/health-check`,
      `${SHITENNO_DIR_NAME}/governance/knowledge-graph`,
    ],
    files: [
      { src: "governance/agents/AI-CONTRACT-planner-v1.yaml", dest: `${SHITENNO_DIR_NAME}/governance/agents/AI-CONTRACT-planner-v1.yaml` },
      { src: "governance/agents/AI-CONTRACT-executor-v1.yaml", dest: `${SHITENNO_DIR_NAME}/governance/agents/AI-CONTRACT-executor-v1.yaml` },
      { src: "governance/agents/AI-CONTRACT-reviewer-v1.yaml", dest: `${SHITENNO_DIR_NAME}/governance/agents/AI-CONTRACT-reviewer-v1.yaml` },
      { src: "governance/agents/AI-CONTRACT-orchestrator-v1.yaml", dest: `${SHITENNO_DIR_NAME}/governance/agents/AI-CONTRACT-orchestrator-v1.yaml` },
      { src: "governance/contracts/CONTRACTS_INDEX.md", dest: `${SHITENNO_DIR_NAME}/governance/contracts/CONTRACTS_INDEX.md` },
      { src: "governance/handoffs/TEMPLATE.md", dest: `${SHITENNO_DIR_NAME}/governance/handoffs/TEMPLATE.md` },
      { src: "governance/rules/RULE-TEMPLATE.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-TEMPLATE.json` },
      { src: "governance/rules/RULE-011.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-011.json` },
      { src: "governance/rules/RULE-012.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-012.json` },
      { src: "governance/rules/RULE-013.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-013.json` },
      { src: "governance/rules/RULE-014.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-014.json` },
      { src: "governance/rules/RULE-015.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-015.json` },
      { src: "governance/rules/RULE-016.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-016.json` },
      { src: "governance/rules/RULE-017.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-017.json` },
      { src: "governance/rules/RULE-018.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-018.json` },
      { src: "governance/rules/RULE-019.json", dest: `${SHITENNO_DIR_NAME}/governance/rules/RULE-019.json` },
      { src: "governance/policies/POLICY-TEMPLATE.md", dest: `${SHITENNO_DIR_NAME}/governance/policies/POLICY-TEMPLATE.md` },
      { src: "governance/policies/BRANCH-POLICY.md", dest: `${SHITENNO_DIR_NAME}/governance/policies/BRANCH-POLICY.md` },
      { src: "governance/policies/COMMIT-POLICY.md", dest: `${SHITENNO_DIR_NAME}/governance/policies/COMMIT-POLICY.md` },
      { src: "governance/policies/REVIEW-POLICY.md", dest: `${SHITENNO_DIR_NAME}/governance/policies/REVIEW-POLICY.md` },
      { src: "opencode/plugin/shitenno-briefing.js", dest: `.opencode/plugin/shitenno-briefing.js` },
      { src: "cognition/context/CONTEXT_HIERARCHY.md", dest: `${SHITENNO_DIR_NAME}/cognition/context/CONTEXT_HIERARCHY.md` },
      { src: "cognition/memory/MEM-operational-state-v1.json", dest: `${SHITENNO_DIR_NAME}/cognition/memory/MEM-operational-state-v1.json` },
      { src: "cognition/prompts/executor/README.md", dest: `${SHITENNO_DIR_NAME}/cognition/prompts/executor/README.md` },
      { src: "cognition/prompts/planner/README.md", dest: `${SHITENNO_DIR_NAME}/cognition/prompts/planner/README.md` },
      { src: "cognition/prompts/reviewer/README.md", dest: `${SHITENNO_DIR_NAME}/cognition/prompts/reviewer/README.md` },
      { src: "plugins/README.md", dest: `${SHITENNO_DIR_NAME}/plugins/README.md` },
      { src: "plugins/event-logger/plugin.js", dest: `${SHITENNO_DIR_NAME}/plugins/event-logger/plugin.js` },
      { src: "plugins/health-monitor/plugin.js", dest: `${SHITENNO_DIR_NAME}/plugins/health-monitor/plugin.js` },
      { src: "plugins/health-check/plugin.js", dest: `${SHITENNO_DIR_NAME}/plugins/health-check/plugin.js` },
      { src: "plugins/health-check/plugin.ts", dest: `${SHITENNO_DIR_NAME}/plugins/health-check/plugin.ts` },
      { src: "governance/knowledge-graph/artifacts.jsonl", dest: `${SHITENNO_DIR_NAME}/governance/knowledge-graph/artifacts.jsonl` },
      { src: "governance/knowledge-graph/relations.jsonl", dest: `${SHITENNO_DIR_NAME}/governance/knowledge-graph/relations.jsonl` },
    ],
  },
  quality: {
    directories: [
      `${SHITENNO_DIR_NAME}/docs/pipelines`,
    ],
    files: [
      { src: "scripts/validate-session.ts", dest: `${SHITENNO_DIR_NAME}/scripts/validate-session.ts` },
      { src: "scripts/sync-docs.ts", dest: `${SHITENNO_DIR_NAME}/scripts/sync-docs.ts` },
      { src: "scripts/backlog.ts", dest: `${SHITENNO_DIR_NAME}/scripts/backlog.ts` },
      { src: "scripts/generate-changelog.ts", dest: `${SHITENNO_DIR_NAME}/scripts/generate-changelog.ts` },
      { src: "docs/pipelines/phase1-foundation.md", dest: `${SHITENNO_DIR_NAME}/docs/pipelines/phase1-foundation.md` },
      { src: "docs/pipelines/phase2-integration.md", dest: `${SHITENNO_DIR_NAME}/docs/pipelines/phase2-integration.md` },
      { src: "docs/pipelines/phase3-performance.md", dest: `${SHITENNO_DIR_NAME}/docs/pipelines/phase3-performance.md` },
    ],
  },
  metrics: {
    directories: [
      `${SHITENNO_DIR_NAME}/reports`,
      `${SHITENNO_DIR_NAME}/docs/history`,
    ],
    files: [
      { src: "docs/reports/README.md", dest: `${SHITENNO_DIR_NAME}/reports/README.md` },
    ],
  },
  operations: {
    directories: [
      `${SHITENNO_DIR_NAME}/docs/runbooks`,
    ],
    files: [
      { src: "scripts/close-session.ts", dest: `${SHITENNO_DIR_NAME}/scripts/close-session.ts` },
      { src: "scripts/premortem-check.ts", dest: `${SHITENNO_DIR_NAME}/scripts/premortem-check.ts` },
      { src: "docs/runbooks/merge.md", dest: `${SHITENNO_DIR_NAME}/docs/runbooks/merge.md` },
    ],
  },
  compliance: {
    directories: [
      `${SHITENNO_DIR_NAME}/governance/premortem`,
      `${SHITENNO_DIR_NAME}/governance/reviews`,
    ],
    files: [
      { src: "governance/premortem/PREMORTEM.md", dest: `${SHITENNO_DIR_NAME}/governance/premortem/PREMORTEM.md` },
      { src: "governance/reviews/SESSION_REVIEW.md", dest: `${SHITENNO_DIR_NAME}/governance/reviews/SESSION_REVIEW.md` },
    ],
  },
};

/** Obtém o mapeamento de uma capacidade. */
export function getCapabilityMapping(capability: Capability): CapabilityMapping {
  return CAPABILITY_MAPPINGS[capability];
}

/** Obtém os ficheiros de uma capacidade (sem directórios). */
export function getCapabilityFiles(capability: Capability): CapabilityFile[] {
  return CAPABILITY_MAPPINGS[capability].files;
}

/** Obtém os directórios de uma capacidade. */
export function getCapabilityDirectories(capability: Capability): string[] {
  return CAPABILITY_MAPPINGS[capability].directories;
}
