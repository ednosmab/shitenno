import { describe, it, expect } from "vitest";
import { recordOutcome, computeFeedbackSummary, type SessionFeedbackRecord } from "../infrastructure/session-feedback.js";

describe("feedback command (session-feedback module)", () => {
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

    it("records failure with areas and notes", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
      };

      const result = recordOutcome(storage, {
        outcome: "failure",
        briefingHash: "def456",
        briefingTimestamp: "2024-01-02T00:00:00Z",
        modifiedAreas: ["src/auth", "src/payments"],
        notes: "Type error in auth module",
      });

      expect(result.outcome).toBe("failure");
      expect(result.modifiedAreas).toEqual(["src/auth", "src/payments"]);
      expect(result.notes).toBe("Type error in auth module");
    });

    it("records partial outcome with duration", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
      };

      const result = recordOutcome(storage, {
        outcome: "partial",
        briefingHash: "ghi789",
        briefingTimestamp: "2024-01-03T00:00:00Z",
        durationMinutes: 25,
        modifiedAreas: ["src/utils"],
      });

      expect(result.outcome).toBe("partial");
      expect(result.durationMinutes).toBe(25);
      expect(result.modifiedAreas).toEqual(["src/utils"]);
    });

    it("generates unique IDs for each record", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
      };

      const r1 = recordOutcome(storage, { outcome: "success", briefingHash: "a", briefingTimestamp: "t1" });
      const r2 = recordOutcome(storage, { outcome: "success", briefingHash: "b", briefingTimestamp: "t2" });

      expect(r1.id).not.toBe(r2.id);
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
        { id: "4", timestamp: "2024-01-04", outcome: "partial", briefingHash: "d", briefingTimestamp: "t4" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.totalSessions).toBe(4);
      expect(summary.successRate).toBeCloseTo(2 / 4);
      expect(summary.byOutcome.success).toBe(2);
      expect(summary.byOutcome.failure).toBe(1);
      expect(summary.byOutcome.partial).toBe(1);
    });

    it("computes average success duration", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", durationMinutes: 10 },
        { id: "2", timestamp: "2024-01-02", outcome: "success", briefingHash: "b", briefingTimestamp: "t2", durationMinutes: 20 },
        { id: "3", timestamp: "2024-01-03", outcome: "failure", briefingHash: "c", briefingTimestamp: "t3", durationMinutes: 30 },
      ];

      const summary = computeFeedbackSummary(records);
      // Only success records count: (10 + 20) / 2 = 15
      expect(summary.avgSuccessDuration).toBe(15);
    });

    it("returns null avgSuccessDuration when no success records have duration", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "success", briefingHash: "a", briefingTimestamp: "t1" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.avgSuccessDuration).toBeNull();
    });

    it("identifies failure hotspots sorted by frequency", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "failure", briefingHash: "a", briefingTimestamp: "t1", modifiedAreas: ["src/auth", "src/payments"] },
        { id: "2", timestamp: "2024-01-02", outcome: "failure", briefingHash: "b", briefingTimestamp: "t2", modifiedAreas: ["src/auth"] },
        { id: "3", timestamp: "2024-01-03", outcome: "failure", briefingHash: "c", briefingTimestamp: "t3", modifiedAreas: ["src/auth", "src/db"] },
      ];

      const summary = computeFeedbackSummary(records);
      // src/auth: 3, src/payments: 1, src/db: 1
      expect(summary.failureHotspots[0]).toBe("src/auth");
      expect(summary.failureHotspots.length).toBeLessThanOrEqual(5);
    });

    it("handles records without modifiedAreas gracefully", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "2024-01-01", outcome: "failure", briefingHash: "a", briefingTimestamp: "t1" },
        { id: "2", timestamp: "2024-01-02", outcome: "success", briefingHash: "b", briefingTimestamp: "t2" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.failureHotspots).toEqual([]);
      expect(summary.successRate).toBeCloseTo(0.5);
    });
  });
});
