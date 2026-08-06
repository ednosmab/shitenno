/**
 * state-manager/session-memory-reader.ts — Reads temporary session memory
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { logger } from "../shared/logger.js";
import type { SessionMemory } from "./types.js";

function parseContextBuffer(bufferPath: string): Record<string, unknown> | null {
  if (!existsSync(bufferPath)) return null;
  try {
    const content = readFileSync(bufferPath, "utf-8");
    const parsed = YAML.parse(content);
    return (parsed && typeof parsed === "object") ? parsed : null;
  } catch {
    logger.debug("state-manager", "Failed to read session memory");
    return null;
  }
}

function extractStringArray(parsed: Record<string, unknown>, key: string): string[] {
  return Array.isArray(parsed[key]) ? (parsed[key] as unknown[]).map(String) : [];
}

function extractSession(parsed: Record<string, unknown>): Pick<SessionMemory, "sessionId" | "branch" | "operationType"> {
  const session = (parsed.session && typeof parsed.session === "object") ? parsed.session as Record<string, unknown> : {};
  return {
    sessionId: (session.id as string) || null,
    branch: (session.branch as string) || null,
    operationType: (session.operation_type as string) || null,
  };
}

function extractCurrentTask(parsed: Record<string, unknown>): SessionMemory["currentTask"] {
  const task = (parsed.current_task && typeof parsed.current_task === "object") ? parsed.current_task as Record<string, unknown> : {};
  return {
    id: (task.id as string) || null,
    type: (task.type as string) || null,
    description: (task.description as string) || null,
    status: (task.status as string) || null,
  };
}

export function readSessionMemory(shitennoDir: string): SessionMemory {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  const parsed = parseContextBuffer(bufferPath);
  if (!parsed) {
    return {
      sessionId: null, branch: null, operationType: null,
      currentTask: { id: null, type: null, description: null, status: null },
      quickBoard: { emCurso: null, parado: [], proximo: [] },
      reminders: [], nextSteps: [], blockers: [], documentsLoaded: [],
    };
  }

  const session = extractSession(parsed);
  return {
    ...session,
    currentTask: extractCurrentTask(parsed),
    quickBoard: { emCurso: null, parado: [], proximo: [] },
    reminders: extractStringArray(parsed, "reminders"),
    nextSteps: extractStringArray(parsed, "next_steps"),
    blockers: extractStringArray(parsed, "blockers"),
    documentsLoaded: extractStringArray(parsed, "documents_loaded"),
  };
}
