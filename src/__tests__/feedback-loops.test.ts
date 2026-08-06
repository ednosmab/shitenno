import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  recordFeedback,
  getFeedbackRecords,
  getFeedbackSummary,
  getAllFeedbackSummaries,
  adjustConfidence,
  shouldSuppress,
  detectFeedbackPatterns,
} from "../application/feedback-loops.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-feedback-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("Feedback Loops", () => {
  const defaultContext = {
    maturityScore: 50,
    installedCapabilities: ["core"],
    knowledgeDebt: 5,
  };

  it("recordFeedback creates a record file", () => {
    const record = recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });

    expect(record.id).toBeDefined();
    expect(record.recommendationId).toBe("EVO-001");
    expect(record.action).toBe("accepted");
    expect(record.timestamp).toBeDefined();
  });

  it("getFeedbackRecords returns all records", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-002",
      action: "rejected",
      context: defaultContext,
    });

    const records = getFeedbackRecords(tempDir);
    expect(records).toHaveLength(2);
  });

  it("getFeedbackSummary returns correct summary", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "rejected",
      context: defaultContext,
    });

    const summary = getFeedbackSummary(tempDir, "EVO-001");
    expect(summary).not.toBeNull();
    expect(summary!.acceptCount).toBe(2);
    expect(summary!.rejectCount).toBe(1);
    expect(summary!.totalInteractions).toBe(3);
    expect(summary!.acceptanceRate).toBeCloseTo(2 / 3);
  });

  it("getFeedbackSummary returns null for unknown recommendation", () => {
    const summary = getFeedbackSummary(tempDir, "UNKNOWN");
    expect(summary).toBeNull();
  });

  it("adjustConfidence increases on acceptance", () => {
    const result = adjustConfidence(0.5, "accepted", 0.1);
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThanOrEqual(1.0);
  });

  it("adjustConfidence decreases on rejection", () => {
    const result = adjustConfidence(0.5, "rejected", 0.1);
    expect(result).toBeLessThan(0.5);
    expect(result).toBeGreaterThanOrEqual(0.0);
  });

  it("adjustConfidence clamps to 0-1", () => {
    expect(adjustConfidence(0.99, "accepted", 0.5)).toBeLessThanOrEqual(1.0);
    expect(adjustConfidence(0.01, "rejected", 0.5)).toBeGreaterThanOrEqual(0.0);
  });

  it("shouldSuppress returns true after 5 rejections", () => {
    const summary = {
      recommendationId: "EVO-001",
      acceptCount: 0,
      rejectCount: 5,
      deferCount: 0,
      totalInteractions: 5,
      acceptanceRate: 0,
      lastAction: "rejected" as const,
      lastTimestamp: null,
    };

    expect(shouldSuppress(summary)).toBe(true);
  });

  it("shouldSuppress returns false with fewer rejections", () => {
    const summary = {
      recommendationId: "EVO-001",
      acceptCount: 2,
      rejectCount: 3,
      deferCount: 0,
      totalInteractions: 5,
      acceptanceRate: 0.4,
      lastAction: "rejected" as const,
      lastTimestamp: null,
    };

    expect(shouldSuppress(summary)).toBe(false);
  });

  it("detectFeedbackPatterns detects always-reject pattern", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "rejected",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "rejected",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "rejected",
      context: defaultContext,
    });

    const patterns = detectFeedbackPatterns(tempDir);
    const alwaysRejects = patterns.find((p) => p.type === "always_rejects");
    expect(alwaysRejects).toBeDefined();
    expect(alwaysRejects!.recommendationType).toBe("EVO-001");
  });

  it("getAllFeedbackSummaries returns all summaries", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-002",
      action: "rejected",
      context: defaultContext,
    });

    const summaries = getAllFeedbackSummaries(tempDir);
    expect(Object.keys(summaries)).toHaveLength(2);
  });

  it("recordFeedback includes pathChoice in record", () => {
    const record = recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
      pathChoice: "challenging",
    });

    expect(record.pathChoice).toBe("challenging");
  });

  it("updateSummary tracks pathChoice statistics", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
      pathChoice: "challenging",
    });
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "rejected",
      context: defaultContext,
      pathChoice: "comfortable",
    });

    const summary = getFeedbackSummary(tempDir, "EVO-001");
    expect(summary).not.toBeNull();
    expect(summary!.pathChoiceStats).toBeDefined();
    expect(summary!.pathChoiceStats!.comfortableCount).toBe(1);
    expect(summary!.pathChoiceStats!.challengingCount).toBe(1);
    expect(summary!.pathChoiceStats!.lastPathChoice).toBe("comfortable");
  });

  it("updateSummary handles feedback without pathChoice", () => {
    recordFeedback(tempDir, {
      recommendationId: "EVO-001",
      action: "accepted",
      context: defaultContext,
    });

    const summary = getFeedbackSummary(tempDir, "EVO-001");
    expect(summary).not.toBeNull();
    expect(summary!.totalInteractions).toBe(1);
  });
});
