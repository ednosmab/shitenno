import { describe, it, expect } from "vitest";
import { createEventPayload } from "../domain/types/event-payloads.js";

// ── createEventPayload ─────────────────────────────────────────────────────

describe("createEventPayload", () => {
  it("creates payload with timestamp and traceId", () => {
    const payload = createEventPayload<"session.start">({
      sessionId: "s1",
      projectRoot: "/project",
    });

    expect(payload.timestamp).toBeDefined();
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.traceId).toBeDefined();
    expect(typeof payload.traceId).toBe("string");
    expect(payload.sessionId).toBe("s1");
    expect(payload.projectRoot).toBe("/project");
  });

  it("uses provided traceId when given", () => {
    const payload = createEventPayload<"session.start">(
      { sessionId: "s1", projectRoot: "/project" },
      { traceId: "custom-trace-123" }
    );

    expect(payload.traceId).toBe("custom-trace-123");
  });

  it("uses provided correlationId when given", () => {
    const payload = createEventPayload<"session.start">(
      { sessionId: "s1", projectRoot: "/project" },
      { correlationId: "corr-456" }
    );

    expect(payload.correlationId).toBe("corr-456");
  });

  it("creates valid ISO timestamp", () => {
    const payload = createEventPayload<"session.start">({
      sessionId: "s1",
      projectRoot: "/project",
    });

    const date = new Date(payload.timestamp);
    expect(date.toISOString()).toBe(payload.timestamp);
  });

  it("generates unique traceIds for different calls", () => {
    const p1 = createEventPayload<"session.start">({ sessionId: "s1", projectRoot: "/" });
    const p2 = createEventPayload<"session.start">({ sessionId: "s2", projectRoot: "/" });

    expect(p1.traceId).not.toBe(p2.traceId);
  });

  it("creates analysis.complete payload", () => {
    const payload = createEventPayload<"analysis.complete">({
      projectId: "proj-1",
      maturityScore: 75,
      dimensions: { security: 80, testing: 60 },
      recommendations: ["Add tests"],
    });

    expect(payload.projectId).toBe("proj-1");
    expect(payload.maturityScore).toBe(75);
    expect(payload.dimensions.security).toBe(80);
  });

  it("creates task.completed payload with gates", () => {
    const payload = createEventPayload<"task.completed">({
      taskId: "TASK-001",
      source: "plan",
      affectedFiles: ["src/a.ts"],
      gates: [
        { name: "build", passed: true },
        { name: "test", passed: true },
      ],
    });

    expect((payload as any).gates).toHaveLength(2);
    expect((payload as any).gates[0].name).toBe("build");
    expect((payload as any).gates[0].passed).toBe(true);
  });

  it("creates pipeline.complete payload", () => {
    const payload = createEventPayload<"pipeline.complete">({
      pipelineId: "pipe-1",
      stages: ["analyze", "score"],
      totalDuration: 1500,
      success: true,
    });

    expect(payload.stages).toEqual(["analyze", "score"]);
    expect(payload.success).toBe(true);
  });

  it("creates health.checked payload", () => {
    const payload = createEventPayload<"health.checked">({
      status: "degraded",
      issues: ["Missing tests"],
      checksRun: 10,
    });

    expect(payload.status).toBe("degraded");
    expect(payload.issues).toContain("Missing tests");
  });

  it("creates knowledge_debt.detected payload with gaps array", () => {
    const payload = createEventPayload<"knowledge_debt.detected">({
      gapCount: 2,
      gaps: [
        { source: "src/a.ts", gap: "No tests", severity: "high" },
        { source: "src/b.ts", gap: "Missing docs", severity: "low" },
      ],
    });

    expect((payload as any).gapCount).toBe(2);
    expect((payload as any).gaps[0].severity).toBe("high");
  });
});
