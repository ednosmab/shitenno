/**
 * state-manager/types.ts — Types for the State Manager
 */

/** Knowledge — Conhecimento permanente. */
export interface KnowledgeState {
  /** ADRs criados. */
  adrs: Array<{ id: string; title: string; status: string; path: string }>;
  /** Skills disponíveis. */
  skills: Array<{ id: string; name: string; path: string }>;
  /** Contratos de agentes. */
  contracts: Array<{ id: string; name: string; role: string; path: string }>;
  /** Documentos de governança. */
  governanceDocs: Array<{ name: string; path: string; critical: boolean }>;
  /** Scripts de automação. */
  scripts: Array<{ id: string; name: string; path: string }>;
  /** Runbooks. */
  runbooks: Array<{ id: string; name: string; path: string }>;
}

/** State — Estado actual do projecto. */
export interface ProjectState {
  /** Maturidade actual. */
  maturity: {
    overallScore: number;
    dimensions: Record<string, number>;
    computedAt: string;
  } | null;
  /** Capacidades instaladas. */
  installedCapabilities: string[];
  /** Capacidades recomendadas. */
  recommendedCapabilities: string[];
  /** Dívida de conhecimento. */
  knowledgeDebt: {
    totalGaps: number;
    healthScore: number;
    detectedAt: string;
  } | null;
  /** Complexidade actual. */
  complexity: {
    score: number;
    level: string;
    computedAt: string;
  } | null;
  /** Estado do projecto. */
  projectInfo: {
    name: string;
    stack: string[];
    hasGit: boolean;
    hasCI: boolean;
    hasTests: boolean;
    hasTypeScript: boolean;
    packageCount: number;
    sourceFileCount: number;
  };
}

/** Memory — Estado temporário da sessão. */
export interface SessionMemory {
  /** ID da sessão. */
  sessionId: string | null;
  /** Branch actual. */
  branch: string | null;
  /** Tipo de operação. */
  operationType: string | null;
  /** Tarefa actual. */
  currentTask: {
    id: string | null;
    type: string | null;
    description: string | null;
    status: string | null;
  };
  /** Quick board. */
  quickBoard: {
    emCurso: string | null;
    parado: string[];
    proximo: string[];
  };
  /** Lembretes. */
  reminders: string[];
  /** Passos restantes. */
  nextSteps: string[];
  /** Blockers. */
  blockers: string[];
  /** Documentos carregados. */
  documentsLoaded: string[];
}

/** Estado consolidado. */
export interface ShitennoState {
  /** Conhecimento permanente. */
  knowledge: KnowledgeState;
  /** Estado do projecto. */
  project: ProjectState;
  /** Memória da sessão. */
  memory: SessionMemory;
  /** Timestamp da consolidação. */
  consolidatedAt: string;
}
