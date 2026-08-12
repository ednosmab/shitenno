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
