/**
 * infrastructure/event-replayer.ts — Event Replayer
 *
 * Re-processes events from history with duplicate detection and dead-letter routing.
 */

import { randomUUID } from "node:crypto";
import type { EventBus } from "../event-bus.js";
import { LRUCache } from "../daemon-resources.js";
import type { VersionedEvent } from "./versioning.js";
import { EVENT_VERSIONS } from "./versioning.js";
import { DeadLetterQueue } from "./dead-letter.js";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_REPLAYER_PROCESSED = 10_000;

// ── Types ──────────────────────────────────────────────────────────────────

/** Replay result. */
export interface ReplayResult {
  /** Total events replayed. */
  total: number;
  /** Successfully processed. */
  success: number;
  /** Failed (sent to dead-letter). */
  failed: number;
  /** Skipped (already processed). */
  skipped: number;
  /** Duration in milliseconds. */
  duration: number;
}

// ── Event Replayer ─────────────────────────────────────────────────────────

export class EventReplayer {
  /** LRU cache prevents Set from growing unboundedly during long daemon sessions. */
  private processed = new LRUCache<string, true>(MAX_REPLAYER_PROCESSED);

  constructor(
    private bus: EventBus,
    private deadLetterQueue: DeadLetterQueue
  ) {}

  /** Replay events from history. */
  replay(
    events: VersionedEvent[],
    handler: (event: VersionedEvent) => void | Promise<void>,
    options?: { skipDuplicates?: boolean }
  ): Promise<ReplayResult> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    let skipped = 0;
    const skipDuplicates = options?.skipDuplicates ?? true;

    const promises = events.map(async (event) => {
      if (skipDuplicates && this.processed.has(event.id)) {
        skipped++;
        return;
      }

      try {
        await handler(event);
        this.processed.set(event.id, true);
        success++;
      } catch (error) {
        failed++;
        this.deadLetterQueue.enqueue(
          event,
          error instanceof Error ? error.message : String(error),
          "replay-handler"
        );
      }
    });

    return Promise.all(promises).then(() => ({
      total: events.length,
      success,
      failed,
      skipped,
      duration: Date.now() - startTime,
    }));
  }

  /** Replay all events from event bus history. */
  replayFromBus(
    handler: (event: VersionedEvent) => void | Promise<void>
  ): Promise<ReplayResult> {
    const history = this.bus.getHistory();
    const events: VersionedEvent[] = history.map((entry) => ({
      id: randomUUID(),
      type: entry.type as import("../event-bus.js").ShitennoEventType,
      payload: entry.payload,
      version: EVENT_VERSIONS[entry.type as import("../event-bus.js").ShitennoEventType] ?? 1,
      timestamp: entry.timestamp,
    }));

    return this.replay(events, handler);
  }

  /** Get processed event IDs (snapshot). */
  getProcessed(): Set<string> {
    return new Set(this.processed.keys());
  }

  /** Clear processed set. */
  clearProcessed(): void {
    this.processed.clear();
  }
}
