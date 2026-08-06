/**
 * infrastructure/dead-letter.ts — Dead-Letter Queue for Failed Events
 *
 * Captures events that failed processing, with persistence and retry support.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { ShitennoEventType, EventBus } from "./event-bus.js";
import { logger } from "../shared/logger.js";
import { BoundedQueue } from "../domain/types/daemon-resources.js";
import type { VersionedEvent } from "./versioning.js";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_DLQ_SIZE = 500;

// ── Types ──────────────────────────────────────────────────────────────────

/** Dead-letter event (failed processing). */
export interface DeadLetterEvent {
  /** Original event. */
  event: VersionedEvent;
  /** Error that caused failure. */
  error: string;
  /** Number of retry attempts. */
  retries: number;
  /** ISO timestamp of failure. */
  failedAt: string;
  /** Handler that failed. */
  handlerName: string;
}

// ── Dead-Letter Queue ──────────────────────────────────────────────────────

export class DeadLetterQueue {
  private queue: BoundedQueue<DeadLetterEvent>;
  private dir: string;

  constructor(shitennoDir: string) {
    this.queue = new BoundedQueue<DeadLetterEvent>(MAX_DLQ_SIZE);
    this.dir = join(shitennoDir, "telemetry", "dead-letter");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
    this.load();
  }

  /** Add an event to the dead-letter queue. */
  enqueue(
    event: VersionedEvent,
    error: string,
    handlerName: string,
    retries = 0
  ): DeadLetterEvent {
    const deadLetter: DeadLetterEvent = {
      event,
      error,
      retries,
      failedAt: new Date().toISOString(),
      handlerName,
    };

    this.queue.push(deadLetter);
    this.persist(deadLetter);

    return deadLetter;
  }

  /** Get all dead-letter events. */
  getAll(): DeadLetterEvent[] {
    return this.queue.toArray();
  }

  /** Get dead-letter events for a specific event type. */
  getByType(type: ShitennoEventType): DeadLetterEvent[] {
    return this.queue.filter((dl) => dl.event.type === type);
  }

  /** Retry a dead-letter event (re-publish to bus). */
  retry(deadLetterId: string, bus: EventBus): boolean {
    const index = this.queue.toArray().findIndex((dl) => dl.event.id === deadLetterId);
    if (index === -1) return false;

    const all = this.queue.toArray();
    const dl = all[index]!;

    try {
      bus.publish(dl.event.type as ShitennoEventType, dl.event.payload as Record<string, unknown>, {
        correlationId: dl.event.correlationId,
        traceId: dl.event.traceId,
      });

      this.queue.clear();
      all.filter((_, i) => i !== index).forEach((item) => this.queue.push(item));
      this.saveAll();
      return true;
    } catch {
      return false;
    }
  }

  /** Clear all dead-letter events. */
  clear(): void {
    this.queue.clear();
    this.saveAll();
  }

  /** Get queue size. */
  size(): number {
    return this.queue.size();
  }

  private persist(dl: DeadLetterEvent): void {
    try {
      const date = dl.failedAt.slice(0, 10);
      const filePath = join(this.dir, `dead-letter-${date}.jsonl`);
      appendFileSync(filePath, JSON.stringify(dl) + "\n", "utf-8");
    } catch (error) {
      logger.debug("advanced-infrastructure", "Suppressed error", { error });
    }
  }

  private load(): void {
    if (!existsSync(this.dir)) return;

    const files = readdirSync(this.dir).filter((f) => f.endsWith(".jsonl"));
    const allItems: DeadLetterEvent[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(this.dir, file), "utf-8").trim();
        if (!content) continue;
        const lines = content.split("\n");
        for (const line of lines) {
          allItems.push(JSON.parse(line) as DeadLetterEvent);
        }
      } catch (error) {
        logger.debug("advanced-infrastructure", "Suppressed error", { error });
      }
    }
    this.queue.load(allItems);
  }

  private saveAll(): void {
    try {
      const filePath = join(this.dir, "dead-letter-current.json");
      writeFileSync(filePath, JSON.stringify(this.queue.toArray(), null, 2), "utf-8");
    } catch (error) {
      logger.debug("advanced-infrastructure", "Suppressed error", { error });
    }
  }
}
