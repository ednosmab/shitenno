/**
 * executors.ts — Built-in executors + FileExecutionRepository.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { safeJsonParseValidated } from "../validation.js";
import type { ActionExecutor, ExecutionRecord, ActionFilter, ExecutionRepository } from "./types.js";

/**
 * LogEventExecutor — Logs an event to history.
 */
export class LogEventExecutor implements ActionExecutor {
  name = "log_event";

  async execute(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const event = params.event as string ?? "unknown";
    const message = params.message as string ?? "";
    logger.info("action-engine", `[Event] ${event}: ${message}`);
    return { logged: true, event, message };
  }
}

/**
 * NotifyExecutor — Sends a notification (console output for now).
 */
export class NotifyExecutor implements ActionExecutor {
  name = "notify";

  async execute(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const message = params.message as string ?? "Notification";
    const level = params.level as string ?? "info";
    logger.info("action-engine", `[${level.toUpperCase()}] ${message}`);
    return { notified: true, message, level };
  }
}

export class FileExecutionRepository implements ExecutionRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, "governance", "executions");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(record: ExecutionRecord): void {
    const filepath = join(this.dir, `${record.executionId}.json`);
    writeFileSync(filepath, JSON.stringify(record, null, 2), "utf-8");
  }

  findById(executionId: string): ExecutionRecord | undefined {
    const filepath = join(this.dir, `${executionId}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      const raw = readFileSync(filepath, "utf-8");
      return safeJsonParseValidated(
        raw,
        (v: unknown): v is ExecutionRecord => typeof v === "object" && v !== null && "executionId" in v && "request" in v && "status" in v,
        "action-engine:findById"
      ) ?? undefined;
    } catch {
      return undefined;
    }
  }

  findByActionId(actionId: string): ExecutionRecord | undefined {
    const all = this.findAll();
    return all.find((r) => r.request.id === actionId);
  }

  findByHash(hash: string): ExecutionRecord | undefined {
    const all = this.findAll();
    return all.find((r) => r.executionHash === hash);
  }

  findAll(filter?: ActionFilter): ExecutionRecord[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".json"));
    const records: ExecutionRecord[] = [];

    for (const file of files) {
      try {
        const raw = readFileSync(join(this.dir, file), "utf-8");
        const record = safeJsonParseValidated(
          raw,
          (v: unknown): v is ExecutionRecord => typeof v === "object" && v !== null && "executionId" in v && "request" in v && "status" in v,
          `action-engine:findAll:${file}`
        );
        if (record && this.matchesFilter(record, filter)) {
          records.push(record);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return records;
  }

  count(filter?: ActionFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(record: ExecutionRecord, filter?: ActionFilter): boolean {
    if (!filter) return true;
    if (filter.status && record.status !== filter.status) return false;
    if (filter.type && record.request.type !== filter.type) return false;
    if (filter.correlationId && record.request.correlationId !== filter.correlationId) return false;
    return true;
  }
}
