import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, appendFileSync as fsAppendFileSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "../../infrastructure/event-bus.js";
import { logger } from "../../shared/logger.js";
import { BoundedQueue } from "../../domain/types/daemon-resources.js";
import { MAX_STATE_EVENTS, type StateEvent } from "./types.js";

export class EventSourcedState {
  private events: BoundedQueue<StateEvent> = new BoundedQueue<StateEvent>(MAX_STATE_EVENTS);
  private eventsDir: string;

  constructor(shitennoDir: string) {
    this.eventsDir = join(shitennoDir, "governance", "state-events");
    if (!existsSync(this.eventsDir)) {
      mkdirSync(this.eventsDir, { recursive: true });
    }
    this.loadEvents();
  }

  record(event: Omit<StateEvent, "id" | "timestamp">): StateEvent {
    const fullEvent: StateEvent = {
      ...event,
      id: `EVT-${randomUUID().slice(0, 8).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    this.events.push(fullEvent);
    this.persistEvent(fullEvent);

    const bus = getEventBus();
    bus.publish("engineering_state.updated", {
      eventType: fullEvent.type,
      entityPath: fullEvent.entityPath,
      source: fullEvent.source,
      timestamp: fullEvent.timestamp,
    });

    return fullEvent;
  }

  getEvents(): StateEvent[] {
    return this.events.toArray();
  }

  getEventsForEntity(entityPath: string): StateEvent[] {
    return this.events.filter((e) => e.entityPath === entityPath);
  }

  getEventsSince(timestamp: string): StateEvent[] {
    return this.events.filter((e) => e.timestamp >= timestamp);
  }

  replay(): Map<string, unknown> {
    const state = new Map<string, unknown>();
    for (const event of this.events) {
      state.set(event.entityPath, event.newState);
    }
    return state;
  }

  private loadEvents(): void {
    if (!existsSync(this.eventsDir)) return;

    const files = readdirSync(this.eventsDir).filter((f) => f.endsWith(".jsonl")).sort();
    const allLoaded: StateEvent[] = [];
    for (const file of files) {
      try {
        const content = readFileSync(join(this.eventsDir, file), "utf-8").trim();
        if (!content) continue;
        const lines = content.split("\n");
        for (const line of lines) {
          allLoaded.push(JSON.parse(line) as StateEvent);
        }
      } catch (error) {
        logger.debug("engineering-state-evolved", "Suppressed error", { error });
      }
    }
    this.events.load(allLoaded);
  }

  private persistEvent(event: StateEvent): void {
    try {
      const date = event.timestamp.slice(0, 10);
      const filePath = join(this.eventsDir, `state-events-${date}.jsonl`);
      fsAppendFileSync(filePath, JSON.stringify(event) + "\n", "utf-8");
    } catch (error) {
      logger.debug("engineering-state-evolved", "Suppressed error", { error });
    }
  }
}
