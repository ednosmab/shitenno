/**
 * state-manager.ts — Pilar 7: Separação dos Estados
 *
 * Distingue claramente diferentes naturezas de informação:
 * - Knowledge: Conhecimento permanente (ADRs, skills, docs)
 * - State: Estado actual do projecto (maturidade, capacidades)
 * - Memory: Estado temporário da sessão (context buffer)
 *
 * PRINCÍPIO: Separação reduce acoplamento e facilita integrações com IA.
 */

// ── Re-exports from split modules ───────────────────────────────────────────

export type {
  KnowledgeState,
  ProjectState,
  SessionMemory,
  ShitennoState,
} from "../state-manager/types.js";

export { readKnowledgeState } from "../state-manager/knowledge-reader.js";
export { readProjectState } from "../state-manager/project-state-reader.js";
export { readSessionMemory } from "../state-manager/session-memory-reader.js";

// ── Import from split modules ───────────────────────────────────────────────

import { readKnowledgeState } from "../state-manager/knowledge-reader.js";
import { readProjectState } from "../state-manager/project-state-reader.js";
import { readSessionMemory } from "../state-manager/session-memory-reader.js";
import type { ShitennoState } from "../state-manager/types.js";

// ── Consolidation ───────────────────────────────────────────────────────────

/**
 * Consolida todos os estados num único objecto.
 * @deprecated Use consolidateEngineeringState() from engineering-state.ts instead.
 * This function will be removed in a future version.
 */
export function consolidateState(
  projectRoot: string,
  shitennoDir: string
): ShitennoState {
  return {
    knowledge: readKnowledgeState(shitennoDir),
    project: readProjectState(projectRoot, shitennoDir),
    memory: readSessionMemory(shitennoDir),
    consolidatedAt: new Date().toISOString(),
  };
}

// ── Report ──────────────────────────────────────────────────────────────────

/** Gera relatório textual do estado consolidado. */
export function stateToText(state: ShitennoState): string {
  const lines: string[] = [];
  lines.push("# Shugo State Report");
  lines.push(`Consolidated at: ${state.consolidatedAt}`);
  lines.push("");

  lines.push("## Knowledge (Permanent)");
  lines.push(`  ADRs: ${state.knowledge.adrs.length}`);
  lines.push(`  Skills: ${state.knowledge.skills.length}`);
  lines.push(`  Contracts: ${state.knowledge.contracts.length}`);
  lines.push(`  Governance docs: ${state.knowledge.governanceDocs.length}`);
  lines.push(`  Scripts: ${state.knowledge.scripts.length}`);
  lines.push(`  Runbooks: ${state.knowledge.runbooks.length}`);
  lines.push("");

  lines.push("## Project State (Current)");
  if (state.project.maturity) {
    lines.push(`  Maturity: ${state.project.maturity.overallScore}/100`);
    lines.push(`  Capabilities: ${state.project.installedCapabilities.join(", ")}`);
  }
  if (state.project.knowledgeDebt) {
    lines.push(`  Knowledge debt: ${state.project.knowledgeDebt.totalGaps} gap(s), score ${state.project.knowledgeDebt.healthScore}/100`);
  }
  lines.push(`  Stack: ${state.project.projectInfo.stack.join(", ") || "none detected"}`);
  lines.push("");

  lines.push("## Session Memory (Temporary)");
  lines.push(`  Session: ${state.memory.sessionId || "none"}`);
  lines.push(`  Branch: ${state.memory.branch || "none"}`);
  lines.push(`  Current task: ${state.memory.currentTask.description || "none"}`);
  lines.push(`  Reminders: ${state.memory.reminders.length}`);
  lines.push(`  Next steps: ${state.memory.nextSteps.length}`);
  lines.push(`  Blockers: ${state.memory.blockers.length}`);
  lines.push("");

  return lines.join("\n");
}
