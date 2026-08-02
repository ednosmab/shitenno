/**
 * backlog-types.ts — Types, state definitions, and state helpers
 *
 * Shared types and state machine logic used by all backlog modules.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type BacklogState =
  | "planeado"
  | "em investigação"
  | "em implementação"
  | "em validação"
  | "pausado"
  | "adiado"
  | "concluído"
  | "encerrado";

export type BacklogPriority = "P0" | "P1" | "P2" | "P3" | "";
export type BacklogSeverity = "Critico" | "Alto" | "Medio" | "Baixo" | "";

export interface BacklogItem {
  id: string;
  title: string;
  state: BacklogState;
  priority: BacklogPriority;
  severity: BacklogSeverity;
  owner: string;
  description: string;
  source: string;
  date: string;
  line: number;
  filePath: string;
  format: "modular" | "legacy";
  /** Optional: modules affected (used by audit backlog items) */
  modules?: string[];
  /** Optional: suggested correction (used by audit backlog items) */
  correction?: string;
}

export interface TransitionResult {
  success: boolean;
  message: string;
  previousState?: BacklogState;
  newState?: BacklogState;
}

export interface BacklogSummary {
  total: number;
  byState: Record<BacklogState, number>;
  byPriority: Record<string, number>;
  p0Count: number;
  p1Count: number;
  blockers: BacklogItem[];
  inProgress: BacklogItem[];
  recentlyCompleted: BacklogItem[];
}

export interface AddItemInput {
  id: string;
  title: string;
  state?: BacklogState;
  priority?: BacklogPriority;
  severity?: BacklogSeverity;
  owner?: string;
  description?: string;
  source?: string;
}

// ── State Definitions ──────────────────────────────────────────────────────

export const VALID_TRANSITIONS: Record<BacklogState, BacklogState[]> = {
  "planeado": ["em investigação", "em implementação", "encerrado"],
  "em investigação": ["em implementação", "encerrado"],
  "em implementação": ["em validação", "pausado"],
  "em validação": ["concluído", "em implementação"],
  "pausado": ["em investigação", "em implementação"],
  "adiado": ["planeado"],
  "concluído": [],
  "encerrado": [],
};

const STATE_ALIASES: Record<string, BacklogState> = {
  "planeado": "planeado",
  "planned": "planeado",
  "backlog": "planeado",
  "em investigação": "em investigação",
  "em investigacao": "em investigação",
  "in research": "em investigação",
  "em implementação": "em implementação",
  "em implementacao": "em implementação",
  "in progress": "em implementação",
  "doing": "em implementação",
  "em validação": "em validação",
  "em validacao": "em validação",
  "in review": "em validação",
  "review": "em validação",
  "pausado": "pausado",
  "paused": "pausado",
  "stopped": "pausado",
  "blocked": "pausado",
  "adiado": "adiado",
  "deferred": "adiado",
  "postponed": "adiado",
  "concluído": "concluído",
  "concluido": "concluído",
  "done": "concluído",
  "completed": "concluído",
  "encerrado": "encerrado",
  "closed": "encerrado",
  "cancelled": "encerrado",
  "canceled": "encerrado",
  "obsolet": "encerrado",
};

// ── State Helpers ──────────────────────────────────────────────────────────

export function normalizeState(raw: string): BacklogState | null {
  const lower = raw.toLowerCase().trim();
  return STATE_ALIASES[lower] || null;
}

export function getAllowedTransitions(state: BacklogState): BacklogState[] {
  return VALID_TRANSITIONS[state] || [];
}

export function isValidTransition(from: BacklogState, to: BacklogState): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * BFS shortest path from `from` to `to` using VALID_TRANSITIONS.
 * Returns array of states to visit (excluding `from`), or null if unreachable.
 */
export function findShortestPath(
  from: BacklogState,
  to: BacklogState,
): BacklogState[] | null {
  if (from === to) return [];

  const visited = new Set<BacklogState>();
  const queue: { state: BacklogState; path: BacklogState[] }[] = [
    { state: from, path: [] },
  ];
  visited.add(from);

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of VALID_TRANSITIONS[current.state] || []) {
      if (visited.has(next)) continue;
      const newPath = [...current.path, next];
      if (next === to) return newPath;
      visited.add(next);
      queue.push({ state: next, path: newPath });
    }
  }
  return null;
}
