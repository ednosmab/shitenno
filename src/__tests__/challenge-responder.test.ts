import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getPendingChallenges,
  markChallengeResolved,
} from "../challenge-responder.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-challenge-responder-"));
  shitennoDir = join(tempDir, ".shitenno");
  mkdirSync(join(shitennoDir, "daemon"), { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeDaemonState(state: Record<string, unknown>): void {
  writeFileSync(
    join(shitennoDir, "daemon", "daemon-state.json"),
    JSON.stringify(state, null, 2),
    "utf-8",
  );
}

describe("Challenge Responder", () => {
  describe("getPendingChallenges", () => {
    it("returns empty array when state file missing", () => {
      const challenges = getPendingChallenges("/nonexistent/path");
      expect(challenges).toEqual([]);
    });

    it("returns empty array when no challenges", () => {
      writeDaemonState({ challenges: [] });
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges).toEqual([]);
    });

    it("returns empty array when challenges field is missing", () => {
      writeDaemonState({});
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges).toEqual([]);
    });

    it("returns only unresolved challenges", () => {
      writeDaemonState({
        challenges: [
          { type: "next_step", severity: "low", message: "pending", generatedAt: "2026-07-20T00:00:00.000Z" },
          { type: "next_step", severity: "low", message: "resolved", generatedAt: "2026-07-20T00:00:00.000Z", resolved: true },
        ],
      });
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges).toHaveLength(1);
      expect(challenges[0]!.message).toBe("pending");
    });

    it("generates correct challenge IDs", () => {
      writeDaemonState({
        challenges: [
          { type: "next_step", severity: "low", message: "a", generatedAt: "2026-07-20T03:16:00.631Z" },
          { type: "health_dip", severity: "medium", message: "b", generatedAt: "2026-07-20T04:02:00.000Z" },
        ],
      });
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges[0]!.id).toBe("CHL-20260720-0");
      expect(challenges[1]!.id).toBe("CHL-20260720-1");
    });

    it("assigns suggested actions based on type", () => {
      writeDaemonState({
        challenges: [
          { type: "plan_completed", severity: "high", message: "", generatedAt: "2026-07-20T00:00:00.000Z" },
          { type: "drift_detected", severity: "medium", message: "", generatedAt: "2026-07-20T00:00:00.000Z" },
          { type: "health_dip", severity: "low", message: "", generatedAt: "2026-07-20T00:00:00.000Z" },
        ],
      });
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges[0]!.suggestedActions).toContain("Take action now");
      expect(challenges[0]!.suggestedActions).toContain("Run health audit");
      expect(challenges[1]!.suggestedActions).toContain("Review changes");
      expect(challenges[2]!.suggestedActions).toContain("Run doctor");
    });

    it("normalizes unknown challenge types", () => {
      writeDaemonState({
        challenges: [
          { type: "some_unknown_type", severity: "high", message: "", generatedAt: "2026-07-20T00:00:00.000Z" },
        ],
      });
      const challenges = getPendingChallenges(shitennoDir);
      expect(challenges[0]!.type).toBe("unknown");
      expect(challenges[0]!.suggestedActions).toContain("Acknowledge");
    });
  });

  describe("markChallengeResolved", () => {
    it("returns null when state file missing", () => {
      const result = markChallengeResolved("/nonexistent/path", 0, "dismiss");
      expect(result).toBeNull();
    });

    it("returns null when challenge index is out of bounds", () => {
      writeDaemonState({ challenges: [] });
      const result = markChallengeResolved(shitennoDir, 0, "dismiss");
      expect(result).toBeNull();
    });

    it("marks challenge as resolved in state file", () => {
      writeDaemonState({
        challenges: [
          { type: "next_step", severity: "low", message: "test", generatedAt: "2026-07-20T00:00:00.000Z" },
        ],
      });
      markChallengeResolved(shitennoDir, 0, "dismiss");

      const stateRaw = require("node:fs").readFileSync(
        join(shitennoDir, "daemon", "daemon-state.json"),
        "utf-8",
      );
      const state = JSON.parse(stateRaw);
      expect(state.challenges[0].resolved).toBe(true);
      expect(state.challenges[0].resolutionAction).toBe("dismiss");
      expect(state.challenges[0].resolvedAt).toBeDefined();
    });

    it("returns resolution record", () => {
      writeDaemonState({
        challenges: [
          { type: "health_dip", severity: "medium", message: "dip", generatedAt: "2026-07-20T00:00:00.000Z" },
        ],
      });
      const result = markChallengeResolved(shitennoDir, 0, "Run doctor");
      expect(result).not.toBeNull();
      expect(result!.action).toBe("Run doctor");
      expect(result!.resolvedAt).toBeDefined();
    });

    it("records feedback in session-feedback", () => {
      writeDaemonState({
        challenges: [
          { type: "next_step", severity: "low", message: "test", generatedAt: "2026-07-20T00:00:00.000Z" },
        ],
      });
      markChallengeResolved(shitennoDir, 0, "dismiss");

      const feedbackDir = join(shitennoDir, "session-feedback");
      const recordsPath = join(feedbackDir, "records.jsonl");
      const { existsSync, readFileSync } = require("node:fs");
      expect(existsSync(recordsPath)).toBe(true);
      const content = readFileSync(recordsPath, "utf-8").trim();
      const record = JSON.parse(content);
      expect(record.outcome).toBe("success");
      expect(record.notes).toContain("Challenge resolved");
    });
  });
});
