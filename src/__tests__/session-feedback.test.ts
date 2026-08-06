import { describe, it, expect } from "vitest";
import { recordOutcome, computeFeedbackSummary } from "../infrastructure/session-feedback.js";
import type { SessionFeedbackRecord } from "../infrastructure/session-feedback.js";

describe("session-feedback", () => {
  describe("recordOutcome", () => {
    it("creates a record with id and timestamp", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "abc123",
        briefingTimestamp: "2024-01-01T00:00:00Z",
      });

      expect(result.id).toMatch(/^SF-/);
      expect(result.timestamp).toBeDefined();
      expect(result.outcome).toBe("success");
      expect(result.briefingHash).toBe("abc123");
    });

    it("stores the record", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
      };

      recordOutcome(storage, {
        outcome: "failure",
        briefingHash: "def456",
        briefingTimestamp: "2024-01-02T00:00:00Z",
        modifiedAreas: ["src/auth"],
      });

      expect(appended).toHaveLength(1);
      expect(appended[0]!.outcome).toBe("failure");
      expect(appended[0]!.modifiedAreas).toEqual(["src/auth"]);
    });
  });

  describe("computeFeedbackSummary", () => {
    it("computes summary for empty records", () => {
      const summary = computeFeedbackSummary([]);
      expect(summary.totalSessions).toBe(0);
      expect(summary.successRate).toBe(0);
      expect(summary.byOutcome).toEqual({ success: 0, failure: 0, partial: 0, "session-start": 0, "session-end": 0 });
    });

    it("computes correct success rate", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "success", briefingHash: "a", briefingTimestamp: "t1" },
        { id: "2", timestamp: "2024-01-02", outcome: "success", briefingHash: "b", briefingTimestamp: "t2" },
        { id: "3", timestamp: "2024-01-03", outcome: "failure", briefingHash: "c", briefingTimestamp: "t3" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.totalSessions).toBe(3);
      expect(summary.successRate).toBeCloseTo(2 / 3);
      expect(summary.byOutcome.success).toBe(2);
      expect(summary.byOutcome.failure).toBe(1);
    });

    it("computes average success duration", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", durationMinutes: 10 },
        { id: "2", timestamp: "2024-01-02", outcome: "success", briefingHash: "b", briefingTimestamp: "t2", durationMinutes: 20 },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.avgSuccessDuration).toBe(15);
    });

    it("identifies failure hotspots", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "failure", briefingHash: "a", briefingTimestamp: "t1", modifiedAreas: ["src/auth", "src/payments"] },
        { id: "2", timestamp: "2024-01-02", outcome: "failure", briefingHash: "b", briefingTimestamp: "t2", modifiedAreas: ["src/auth"] },
      ];

      const summary = computeFeedbackSummary(records);
      // src/auth appears in 2 records, src/payments in 1 — both under top 5
      expect(summary.failureHotspots).toContain("src/auth");
      expect(summary.failureHotspots).toContain("src/payments");
    });
  });
});
