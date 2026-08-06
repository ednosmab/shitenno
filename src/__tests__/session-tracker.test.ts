import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  startSession,
  trackCommand,
  trackFeedback,
  endSession,
  getSessions,
  getSessionMetrics,
} from "../infrastructure/session-tracker.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shugo-session-"));
  shitennoDir = join(tempDir, "shitenno");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Session Tracker", () => {
  it("startSession creates a session with correct shape", () => {
    const session = startSession(shitennoDir);

    expect(session.id).toMatch(/^SES-\d{17}-\d{4}$/);
    expect(session.startedAt).toBeDefined();
    expect(session.commands).toEqual([]);
    expect(session.feedbackGiven).toBe(0);
    expect(session.recommendationsAccepted).toBe(0);
    expect(session.recommendationsRejected).toBe(0);
    expect(session.pathChoices).toEqual({ comfortable: 0, challenging: 0 });
    expect(session.endedAt).toBeUndefined();
    expect(session.duration).toBeUndefined();
  });

  it("startSession persists to sessions.jsonl", () => {
    const session = startSession(shitennoDir);
    const content = readFileSync(join(shitennoDir, "telemetry", "sessions.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).id).toBe(session.id);
  });

  it("startSession creates telemetry directory", () => {
    startSession(shitennoDir);
    expect(existsSync(join(shitennoDir, "telemetry"))).toBe(true);
  });

  it("trackCommand adds command to session", () => {
    const session = startSession(shitennoDir);
    trackCommand(shitennoDir, session.id, "report");
    trackCommand(shitennoDir, session.id, "doctor");

    const sessions = getSessions(shitennoDir);
    expect(sessions[0]!.commands).toEqual(["report", "doctor"]);
  });

  it("trackCommand ignores unknown session", () => {
    trackCommand(shitennoDir, "SES-FAKE", "report");
    const sessions = getSessions(shitennoDir);
    expect(sessions).toHaveLength(0);
  });

  it("trackFeedback increments feedback counters", () => {
    const session = startSession(shitennoDir);
    trackFeedback(shitennoDir, session.id, "accepted", "challenging");
    trackFeedback(shitennoDir, session.id, "rejected", "comfortable");
    trackFeedback(shitennoDir, session.id, "accepted", "challenging");

    const sessions = getSessions(shitennoDir);
    expect(sessions[0]!.feedbackGiven).toBe(3);
    expect(sessions[0]!.recommendationsAccepted).toBe(2);
    expect(sessions[0]!.recommendationsRejected).toBe(1);
    expect(sessions[0]!.pathChoices.challenging).toBe(2);
    expect(sessions[0]!.pathChoices.comfortable).toBe(1);
  });

  it("trackFeedback ignores unknown session", () => {
    trackFeedback(shitennoDir, "SES-FAKE", "accepted");
    const sessions = getSessions(shitennoDir);
    expect(sessions).toHaveLength(0);
  });

  it("endSession sets endedAt and calculates duration", () => {
    const session = startSession(shitennoDir);
    const ended = endSession(shitennoDir, session.id);

    expect(ended).not.toBeNull();
    expect(ended!.endedAt).toBeDefined();
    expect(ended!.duration).toBeGreaterThanOrEqual(0);
  });

  it("endSession returns null for unknown session", () => {
    const result = endSession(shitennoDir, "SES-FAKE");
    expect(result).toBeNull();
  });

  it("getSessions returns all sessions", () => {
    startSession(shitennoDir);
    startSession(shitennoDir);
    startSession(shitennoDir);

    const sessions = getSessions(shitennoDir);
    expect(sessions).toHaveLength(3);
  });

  it("getSessions filters by since", () => {
    startSession(shitennoDir);
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const sessions = getSessions(shitennoDir, { since: oldDate });
    expect(sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("getSessions filters by limit", () => {
    startSession(shitennoDir);
    startSession(shitennoDir);
    startSession(shitennoDir);

    const sessions = getSessions(shitennoDir, { limit: 2 });
    expect(sessions).toHaveLength(2);
  });

  it("getSessionMetrics returns correct metrics", () => {
    const s1 = startSession(shitennoDir);
    trackCommand(shitennoDir, s1.id, "report");
    trackCommand(shitennoDir, s1.id, "report");
    trackFeedback(shitennoDir, s1.id, "accepted", "challenging");
    endSession(shitennoDir, s1.id);

    const s2 = startSession(shitennoDir);
    trackCommand(shitennoDir, s2.id, "doctor");
    trackFeedback(shitennoDir, s2.id, "rejected", "comfortable");
    endSession(shitennoDir, s2.id);

    const metrics = getSessionMetrics(shitennoDir);
    expect(metrics.totalSessions).toBe(2);
    expect(metrics.totalCommands).toBe(3);
    expect(metrics.commandFrequency).toEqual({ report: 2, doctor: 1 });
    expect(metrics.totalAccepts).toBe(1);
    expect(metrics.totalRejects).toBe(1);
    expect(metrics.challengingRatio).toBeCloseTo(0.5);
  });

  it("getSessionMetrics returns empty metrics for no sessions", () => {
    const metrics = getSessionMetrics(shitennoDir);
    expect(metrics.totalSessions).toBe(0);
    expect(metrics.avgDuration).toBe(0);
    expect(metrics.totalCommands).toBe(0);
    expect(metrics.challengingRatio).toBe(0.5);
  });

  it("getSessionMetrics filters by days", () => {
    startSession(shitennoDir);
    const metrics = getSessionMetrics(shitennoDir, 1);
    expect(metrics.totalSessions).toBe(1);
  });

  it("getSessions returns empty for non-existent shugo dir", () => {
    const sessions = getSessions("/tmp/nonexistent-shitenno-dir-test");
    expect(sessions).toEqual([]);
  });

  it("handles multiple sessions with interleaved commands", () => {
    const s1 = startSession(shitennoDir);
    const s2 = startSession(shitennoDir);
    trackCommand(shitennoDir, s1.id, "report");
    trackCommand(shitennoDir, s2.id, "doctor");
    trackCommand(shitennoDir, s1.id, "validate");
    trackCommand(shitennoDir, s2.id, "detect");

    const sessions = getSessions(shitennoDir);
    expect(sessions).toHaveLength(2);
    const s1Sessions = sessions.find((s) => s.id === s1.id);
    const s2Sessions = sessions.find((s) => s.id === s2.id);
    expect(s1Sessions!.commands).toEqual(["report", "validate"]);
    expect(s2Sessions!.commands).toEqual(["doctor", "detect"]);
  });
});
