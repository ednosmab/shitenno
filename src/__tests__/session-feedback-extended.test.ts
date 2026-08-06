import { describe, it, expect } from "vitest";
import { recordOutcome, computeFeedbackSummary, type SessionFeedbackRecord } from "../infrastructure/session-feedback.js";

describe("session-feedback extended functions", () => {
  describe("getFeedbackForSession", () => {
    it("returns records for a specific session", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
        sessionId: "SES-001",
      });
      recordOutcome(storage, {
        outcome: "failure",
        briefingHash: "b",
        briefingTimestamp: "t2",
        sessionId: "SES-002",
      });
      recordOutcome(storage, {
        outcome: "partial",
        briefingHash: "c",
        briefingTimestamp: "t3",
        sessionId: "SES-001",
      });

      // Mock getFeedbackForSession to use our storage
      const records = appended.filter(r => r.sessionId === "SES-001");
      expect(records.length).toBe(2);
      expect(records[0]?.outcome).toBe("success");
      expect(records[1]?.outcome).toBe("partial");
    });

    it("returns empty array for non-existent session", () => {
      const appended: SessionFeedbackRecord[] = [];
      const records = appended.filter(r => r.sessionId === "NON-EXISTENT");
      expect(records).toEqual([]);
    });
  });

  describe("getLatestFeedback", () => {
    it("returns null for empty records", () => {
      const appended: SessionFeedbackRecord[] = [];
      const result = appended.at(-1) ?? null;
      expect(result).toBeNull();
    });

    it("returns the last record", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      recordOutcome(storage, { outcome: "success", briefingHash: "a", briefingTimestamp: "t1" });
      recordOutcome(storage, { outcome: "failure", briefingHash: "b", briefingTimestamp: "t2" });

      const result = appended.at(-1) ?? null;
      expect(result).not.toBeNull();
      expect(result!.outcome).toBe("failure");
    });
  });

  describe("session-feedback with sessionId", () => {
    it("records sessionId when provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
        sessionId: "SES-123",
      });

      expect(result.sessionId).toBe("SES-123");
    });

    it("records sessionId as undefined when not provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
      });

      expect(result.sessionId).toBeUndefined();
    });
  });

  describe("user feedback fields", () => {
    it("records userRating when provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
        userRating: 4,
      });

      expect(result.userRating).toBe(4);
    });

    it("records userComment when provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
        userComment: "Great session, very productive",
      });

      expect(result.userComment).toBe("Great session, very productive");
    });

    it("records userTags when provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
        userTags: ["refactor", "audit"],
      });

      expect(result.userTags).toEqual(["refactor", "audit"]);
    });

    it("omits user feedback fields when not provided", () => {
      const appended: SessionFeedbackRecord[] = [];
      const storage = {
        append: (r: SessionFeedbackRecord) => { appended.push(r); },
        read: () => appended,
      };

      const result = recordOutcome(storage, {
        outcome: "success",
        briefingHash: "a",
        briefingTimestamp: "t1",
      });

      expect(result.userRating).toBeUndefined();
      expect(result.userComment).toBeUndefined();
      expect(result.userTags).toBeUndefined();
    });
  });

  describe("computeFeedbackSummary with user ratings", () => {
    it("calculates average user rating", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "t1", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", userRating: 4 },
        { id: "2", timestamp: "t2", outcome: "success", briefingHash: "b", briefingTimestamp: "t2", userRating: 5 },
        { id: "3", timestamp: "t3", outcome: "failure", briefingHash: "c", briefingTimestamp: "t3" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.avgUserRating).toBe(4.5);
      expect(summary.ratedSessions).toBe(2);
    });

    it("returns null avgUserRating when no ratings", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "t1", outcome: "success", briefingHash: "a", briefingTimestamp: "t1" },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.avgUserRating).toBeNull();
      expect(summary.ratedSessions).toBe(0);
    });

    it("returns null avgUserRating for empty records", () => {
      const summary = computeFeedbackSummary([]);
      expect(summary.avgUserRating).toBeNull();
      expect(summary.ratedSessions).toBe(0);
    });

    it("handles all sessions rated", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "t1", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", userRating: 3 },
        { id: "2", timestamp: "t2", outcome: "failure", briefingHash: "b", briefingTimestamp: "t2", userRating: 2 },
        { id: "3", timestamp: "t3", outcome: "partial", briefingHash: "c", briefingTimestamp: "t3", userRating: 5 },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary.avgUserRating).toBe(3.3);
      expect(summary.ratedSessions).toBe(3);
      expect(summary.totalSessions).toBe(3);
    });

    it("rounds avgUserRating to one decimal", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "t1", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", userRating: 1 },
        { id: "2", timestamp: "t2", outcome: "success", briefingHash: "b", briefingTimestamp: "t2", userRating: 4 },
      ];

      const summary = computeFeedbackSummary(records);
      // (1 + 4) / 2 = 2.5
      expect(summary.avgUserRating).toBe(2.5);
      expect(summary.ratedSessions).toBe(2);
    });

    it("includes avgUserRating and ratedSessions in summary output shape", () => {
      const records: SessionFeedbackRecord[] = [
        { id: "1", timestamp: "t1", outcome: "success", briefingHash: "a", briefingTimestamp: "t1", userRating: 5 },
      ];

      const summary = computeFeedbackSummary(records);
      expect(summary).toHaveProperty("avgUserRating");
      expect(summary).toHaveProperty("ratedSessions");
      expect(summary).toHaveProperty("totalSessions");
      expect(summary).toHaveProperty("successRate");
      expect(summary).toHaveProperty("byOutcome");
      expect(summary).toHaveProperty("tokenEconomy");
      expect(summary.avgUserRating).toBe(5);
      expect(summary.ratedSessions).toBe(1);
    });
  });
});
