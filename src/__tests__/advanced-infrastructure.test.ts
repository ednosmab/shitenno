/**
 * advanced-infrastructure.test.ts — Tests for Advanced Infrastructure
 *
 * Validates dead-letter queue, event replay, and event versioning.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  DeadLetterQueue,
  EventReplayer,
  createVersionedEvent,
  migrateEvent,
  getEventVersion,
} from "../infrastructure/advanced-infrastructure.js";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";

// ── DeadLetterQueue Tests ──────────────────────────────────────────────────

describe("DeadLetterQueue", () => {
  let tmpDir: string;
  let queue: DeadLetterQueue;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-dlq-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    queue = new DeadLetterQueue(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("enqueues dead-letter events", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    const dl = queue.enqueue(event, "Handler failed", "test-handler");

    expect(dl.event.id).toBe(event.id);
    expect(dl.error).toBe("Handler failed");
    expect(dl.handlerName).toBe("test-handler");
    expect(dl.retries).toBe(0);
    expect(queue.size()).toBe(1);
  });

  it("gets all dead-letter events", () => {
    const e1 = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    const e2 = createVersionedEvent("session.end", { sessionId: "s1", duration: 1000, outcome: "success" });

    queue.enqueue(e1, "Error 1", "handler1");
    queue.enqueue(e2, "Error 2", "handler2");

    expect(queue.getAll()).toHaveLength(2);
  });

  it("filters by event type", () => {
    const e1 = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    const e2 = createVersionedEvent("session.end", { sessionId: "s1", duration: 1000, outcome: "success" });

    queue.enqueue(e1, "Error 1", "handler1");
    queue.enqueue(e2, "Error 2", "handler2");

    expect(queue.getByType("session.start")).toHaveLength(1);
    expect(queue.getByType("session.end")).toHaveLength(1);
    expect(queue.getByType("score.calculated")).toHaveLength(0);
  });

  it("retry re-publishes event", () => {
    resetEventBus();
    const bus = getEventBus();
    let received = false;
    bus.subscribe("session.start", () => { received = true; });

    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    queue.enqueue(event, "Error", "handler");

    const retried = queue.retry(event.id, bus);
    expect(retried).toBe(true);
    expect(received).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it("retry returns false for non-existent event", () => {
    const bus = getEventBus();
    expect(queue.retry("non-existent-id", bus)).toBe(false);
  });

  it("clear empties the queue", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    queue.enqueue(event, "Error", "handler");
    expect(queue.size()).toBe(1);

    queue.clear();
    expect(queue.size()).toBe(0);
  });

  it("loads from disk on construction", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    queue.enqueue(event, "Error", "handler");

    // Create new instance
    const queue2 = new DeadLetterQueue(tmpDir);
    expect(queue2.size()).toBe(1);
  });
});

// ── EventReplayer Tests ────────────────────────────────────────────────────

describe("EventReplayer", () => {
  let tmpDir: string;
  let queue: DeadLetterQueue;
  let replayer: EventReplayer;

  beforeEach(() => {
    resetEventBus();
    tmpDir = join(tmpdir(), `shitenno-replay-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    queue = new DeadLetterQueue(tmpDir);
    replayer = new EventReplayer(getEventBus(), queue);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("replays events successfully", async () => {
    const events = [
      createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" }),
      createVersionedEvent("session.end", { sessionId: "s1", duration: 1000, outcome: "success" }),
    ];

    const result = await replayer.replay(events, () => {});
    expect(result.total).toBe(2);
    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("sends failed events to dead-letter queue", async () => {
    const events = [
      createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" }),
    ];

    const result = await replayer.replay(events, () => {
      throw new Error("Handler failed");
    });

    expect(result.failed).toBe(1);
    expect(queue.size()).toBe(1);
  });

  it("skips duplicate events", async () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });

    await replayer.replay([event], () => {});
    const result = await replayer.replay([event], () => {});

    expect(result.skipped).toBe(1);
    expect(result.success).toBe(0);
  });

  it("replays from event bus history", async () => {
    const bus = getEventBus();
    bus.publish("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    bus.publish("session.end", { sessionId: "s1", duration: 1000, outcome: "success" });

    let count = 0;
    const result = await replayer.replayFromBus(() => { count++; });

    expect(result.total).toBe(2);
    expect(count).toBe(2);
  });

  it("tracks processed events", async () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    await replayer.replay([event], () => {});

    expect(replayer.getProcessed().has(event.id)).toBe(true);
  });

  it("clearProcessed resets tracking", async () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    await replayer.replay([event], () => {});

    replayer.clearProcessed();
    expect(replayer.getProcessed().size).toBe(0);
  });
});

// ── Versioned Event Tests ──────────────────────────────────────────────────

describe("Versioned Events", () => {
  it("createVersionedEvent sets version from registry", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    expect(event.version).toBe(1);
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it("createVersionedEvent uses custom version", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" }, { version: 2 });
    expect(event.version).toBe(2);
  });

  it("migrateEvent returns same event if already latest", () => {
    const event = createVersionedEvent("session.start", { sessionId: "s1", projectRoot: "/tmp" });
    const migrated = migrateEvent(event);
    expect(migrated).toEqual(event);
  });

  it("getEventVersion returns version for event type", () => {
    expect(getEventVersion("session.start")).toBe(1);
    expect(getEventVersion("session.end")).toBe(1);
  });

  it("events include correlation and trace IDs", () => {
    const event = createVersionedEvent(
      "session.start",
      { sessionId: "s1", projectRoot: "/tmp" },
      { correlationId: "corr-123", traceId: "trace-456" }
    );

    expect(event.correlationId).toBe("corr-123");
    expect(event.traceId).toBe("trace-456");
  });
});
