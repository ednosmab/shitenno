/**
 * Tests for context-tier-detectors.ts
 *
 * getRecentEvents calls readPersistedEvents 7 times (once per day).
 * The mock returns events only for the first call (today) and empty for
 * the remaining 6 days. This matches real-world behavior where events
 * are only found on the date they were persisted.
 *
 * For detectMisclassifiedTier: events are grouped by document and counted,
 * so even 1 event today = 1 load, which is below the threshold of 3.
 * We add enough events to exceed the threshold.
 *

 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;

type MockEvent = { type: string; payload: Record<string, unknown>; timestamp: string };
const mockEvents: MockEvent[] = [];

const { readPersistedEventsMock } = vi.hoisted(() => ({
  readPersistedEventsMock: vi.fn((): MockEvent[] => []),
}));

vi.mock("../infrastructure/event-bus.js", () => ({
  readPersistedEvents: readPersistedEventsMock,
}));

vi.mock("../shared/logger.js", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { detectMisclassifiedTier } from "../audit/context-tier-detectors.js";

const makeEvent = (type: string, payload: Record<string, unknown>): MockEvent => ({
  type,
  payload,
  timestamp: new Date().toISOString(),
});

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "tier-detector-test-"));
  mockEvents.length = 0;
  // Return events only for the first call (today), empty for the other 6 days.
  // This matches real-world behavior: readPersistedEvents(dir, dateStr)
  // only returns events from that specific date.
  // Uses mockImplementationOnce so it captures mockEvents at call time, not setup time.
  readPersistedEventsMock
    .mockImplementationOnce((): MockEvent[] => [...mockEvents])
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce([])
    .mockReturnValueOnce([]);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("detectMisclassifiedTier", () => {
  it("returns empty array when no events exist", () => {
    expect(detectMisclassifiedTier(tempDir)).toEqual([]);
  });

  it("returns empty array when no p4_loaded events exist", () => {
    mockEvents.push(makeEvent("backlog.updated", { source: "sync" }));
    expect(detectMisclassifiedTier(tempDir)).toEqual([]);
  });

  it("flags document loaded >= threshold", () => {
    // 4 events for the same doc → 4 loads > threshold of 3
    for (let i = 0; i < 4; i++) {
      mockEvents.push(makeEvent("context.p4_loaded", { docPath: "ADR-001.md", tierDeclared: "P4" }));
    }
    const issues = detectMisclassifiedTier(tempDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("tier_promotion_candidate");
    expect(issues[0]!.description).toContain("ADR-001.md");
  });

  it("flags multiple documents above threshold", () => {
    // Both docs have 4 events each → 4 loads > threshold of 3
    for (let i = 0; i < 4; i++) {
      mockEvents.push(makeEvent("context.p4_loaded", { docPath: "doc-a.md" }));
      mockEvents.push(makeEvent("context.p4_loaded", { docPath: "doc-b.md" }));
    }
    const issues = detectMisclassifiedTier(tempDir);
    expect(issues.length).toBe(2);
  });

  it("handles events with missing docPath", () => {
    mockEvents.push(makeEvent("context.p4_loaded", { taskType: "on-demand" }));
    expect(detectMisclassifiedTier(tempDir)).toEqual([]);
  });
});


