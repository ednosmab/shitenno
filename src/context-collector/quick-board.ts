/**
 * context-collector/quick-board.ts — Quick Board loading from context_buffer.yaml
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { logger } from "../shared/logger.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import type { Reminder, ReminderPriority, ReminderCategory } from "../application/briefing.js";

export interface QuickBoardResult {
  currentTask: string;
  nextP0: string;
  p1Debts: string;
  impediments: string;
  lastSessionStatus: string;
  reminders: Reminder[];
}

export function parseSessionStatus(status: string | undefined): string {
  if (status === "completed") return "Concluída";
  if (status === "in_progress" || status === "active") return "Em curso";
  return "Desconhecido";
}

export function extractImpediments(data: Record<string, unknown>): string {
  const impediments = data?.impediments as Array<{ description: string }> | undefined;
  if (!impediments || impediments.length === 0) return "Nenhum";
  return impediments.map((i) => i.description).join(", ");
}

export function extractP1Debts(data: Record<string, unknown>): string {
  const debts = data?.technical_debt as Array<{ priority?: string; severity?: string; description: string }> | undefined;
  if (!debts || debts.length === 0) return "Nenhuma";
  const p1Debts = debts.filter((d) => d.priority === "P1" || d.severity === "high");
  return p1Debts.length > 0 ? p1Debts.map((d) => d.description).join(", ") : "Nenhuma";
}

export function findInProgressItems(backlog: string): string[] {
  const items: string[] = [];
  const sections = backlog.split(/^### /m).slice(1);
  for (const item of sections) {
    const title = item.split("\n")[0]?.trim();
    if (title && item.includes("| **Status** | In Progress")) {
      items.push(`${title} (In Progress)`);
    }
  }
  return items;
}

export function normalizeReminders(data: Record<string, unknown>): Reminder[] {
  if (!Array.isArray(data?.reminders)) return [];
  return data.reminders.map((r: string | Reminder) => {
    if (typeof r === "string") {
      return {
        message: r,
        priority: "medium" as ReminderPriority,
        category: "feature" as ReminderCategory,
        createdAt: new Date().toISOString(),
      };
    }
    return {
      message: r.message || "",
      priority: (r.priority as ReminderPriority) || "medium",
      category: (r.category as ReminderCategory) || "feature",
      createdAt: r.createdAt || new Date().toISOString(),
    };
  });
}

export function publishP4LoadedEvent(): void {
  try {
    const bus = getEventBus();
    bus.publish("context.p4_loaded", {
      docPath: "governance/context/context_buffer.yaml",
      taskType: "loadQuickBoard",
      tierDeclared: "P4",
    });
  } catch {
    logger.debug("context-collector", "Failed to publish quick-board event — best-effort");
  }
}

export function readContextBuffer(shitennoDir: string): Record<string, unknown> | null {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return null;
  const content = readFileSync(bufferPath, "utf-8");
  return parseYaml(content) as Record<string, unknown>;
}

export function resolveWithContext(
  shitennoDir: string,
  fallbackNextP0: string,
  currentTaskData: { description?: string; status?: string } | undefined,
  baseCurrentTask: string,
): { nextP0: string; currentTask: string } {
  let nextP0 = fallbackNextP0;
  let currentTaskVal = baseCurrentTask;
  const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return { nextP0, currentTask: currentTaskVal };

  try {
    const backlog = readFileSync(backlogPath, "utf-8");
    const p0Section = backlog.split(/^## P0 /m)?.[1]?.split(/^## P1 /m)?.[0] ?? "";
    const p0Items = findInProgressItems(p0Section);
    if (p0Items.length > 0) nextP0 = p0Items[0]!;
    if (currentTaskData?.status === "completed" || !currentTaskData?.description) {
      const allItems = findInProgressItems(backlog);
      if (allItems.length > 0) currentTaskVal = allItems[0]!;
    }
  } catch {
    logger.debug("context-collector", "Failed to read supplemental context — using buffer values");
  }
  return { nextP0, currentTask: currentTaskVal };
}

export function loadQuickBoard(shitennoDir: string): QuickBoardResult {
  const defaultQuickBoard: QuickBoardResult = {
    currentTask: "Nenhuma",
    nextP0: "Definir novo P0 no BACKLOG.md",
    p1Debts: "Nenhuma",
    impediments: "Nenhum",
    lastSessionStatus: "Desconhecido",
    reminders: [],
  };

  try {
    const data = readContextBuffer(shitennoDir);
    if (!data) return defaultQuickBoard;
    publishP4LoadedEvent();

    const session = data?.session as { status?: string } | undefined;
    const currentTaskData = data?.current_task as { description?: string; status?: string } | undefined;
    const currentTask = currentTaskData?.description
      ? `${currentTaskData.description} (${currentTaskData.status})`
      : "Nenhuma";
    const fallbackNextP0 = (data?.next_p0 as string) ?? "Verificar BACKLOG.md para próximo P0";
    const resolved = resolveWithContext(shitennoDir, fallbackNextP0, currentTaskData, currentTask);

    return {
      currentTask: resolved.currentTask,
      nextP0: resolved.nextP0,
      p1Debts: extractP1Debts(data),
      impediments: extractImpediments(data),
      lastSessionStatus: parseSessionStatus(session?.status),
      reminders: normalizeReminders(data),
    };
  } catch (err) {
    logger.debug("loadQuickBoard", "Failed to load context buffer:", err instanceof Error ? err.message : err);
    return defaultQuickBoard;
  }
}
