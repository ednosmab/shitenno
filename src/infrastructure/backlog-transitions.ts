import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type BacklogStatus =
  | "planeado"
  | "em investigação"
  | "em implementação"
  | "em validação"
  | "concluído"
  | "encerrado"
  | "pausado"
  | "adiado";

export const BACKLOG_STATUSES: BacklogStatus[] = [
  "planeado",
  "em investigação",
  "em implementação",
  "em validação",
  "concluído",
  "encerrado",
  "pausado",
  "adiado",
];

const VALID_TRANSITIONS: Record<BacklogStatus, BacklogStatus[]> = {
  planeado: ["em investigação", "em implementação"],
  "em investigação": ["em implementação", "encerrado"],
  "em implementação": ["em validação"],
  "em validação": ["concluído", "em implementação"],
  pausado: ["em investigação", "em implementação"],
  adiado: [],
  concluído: [],
  encerrado: [],
};

export interface TransitionResult {
  success: boolean;
  itemId: string;
  previousStatus: BacklogStatus | null;
  newStatus: BacklogStatus;
  message: string;
}

export function isValidTransition(
  from: BacklogStatus | null,
  to: BacklogStatus
): boolean {
  if (from === null) return true;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

function matchStatusFromRaw(raw: string): BacklogStatus | null {
  for (const s of BACKLOG_STATUSES) {
    if (raw.includes(s)) return s;
  }
  if (raw.includes("Done")) return "concluído";
  if (raw.includes("Backlog")) return "planeado";
  return null;
}

export function getCurrentStatus(
  backlogPath: string,
  itemId: string
): BacklogStatus | null {
  if (!existsSync(backlogPath)) return null;

  const content = readFileSync(backlogPath, "utf-8");
  const lines = content.split("\n");
  let currentStatus: BacklogStatus | null = null;
  let inTargetItem = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith(`### ${itemId}`)) {
      inTargetItem = true;
      continue;
    }

    if (inTargetItem && trimmed.startsWith("### ")) {
      break;
    }

    if (!inTargetItem) continue;

    const statusMatch = trimmed.match(
      /^\|?\s*\*\*Status\*\*\s*\|\s*(.+?)\s*\|?\s*$/
    );
    if (statusMatch && statusMatch[1]) {
      currentStatus = matchStatusFromRaw(statusMatch[1].trim());
      break;
    }
  }

  return currentStatus;
}

function updateStatusLine(lines: string[], itemId: string, newStatus: BacklogStatus, date: string): boolean {
  let inTargetItem = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (line.trim().startsWith(`### ${itemId}`)) { inTargetItem = true; continue; }
    if (inTargetItem && line.trim().startsWith("### ")) break;

    if (inTargetItem) {
      const statusMatch = line.match(/^(\s*\|\s*\*\*Status\*\*\s*\|\s*).+?(\s*)$/);
      if (statusMatch) {
        const statusLabel = newStatus === "concluído" ? `Done — ${date}` : newStatus;
        lines[i] = `${statusMatch[1]}${statusLabel}${statusMatch[2] ?? ""}`;
        return true;
      }
    }
  }
  return false;
}

export function transitionBacklogStatus(
  backlogPath: string,
  itemId: string,
  newStatus: BacklogStatus,
  options?: { date?: string }
): TransitionResult {
  if (!existsSync(backlogPath)) {
    return { success: false, itemId, previousStatus: null, newStatus, message: `Backlog file not found: ${backlogPath}` };
  }

  const currentStatus = getCurrentStatus(backlogPath, itemId);

  if (!isValidTransition(currentStatus, newStatus)) {
    return {
      success: false, itemId, previousStatus: currentStatus, newStatus,
      message: currentStatus ? `Invalid transition: ${currentStatus} → ${newStatus}` : `Item not found: ${itemId}`,
    };
  }

  const date = options?.date ?? new Date().toISOString().slice(0, 10);

  try {
    const lines = readFileSync(backlogPath, "utf-8").split("\n");
    if (!updateStatusLine(lines, itemId, newStatus, date)) {
      return { success: false, itemId, previousStatus: currentStatus, newStatus, message: `Could not find status field for item: ${itemId}` };
    }
    writeFileSync(backlogPath, lines.join("\n"), "utf-8");
    return { success: true, itemId, previousStatus: currentStatus, newStatus, message: `Transitioned ${currentStatus ?? "unknown"} → ${newStatus}` };
  } catch (error) {
    return { success: false, itemId, previousStatus: currentStatus, newStatus, message: `Failed to update: ${error instanceof Error ? error.message : String(error)}` };
  }
}
