/**
 * action-engine.test.ts — Tests for Action Engine
 *
 * Validates idempotent execution, rollback, executor registration, and repository operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  ActionEngine,
  FileExecutionRepository,
  computeExecutionHash,
  LogEventExecutor,
  NotifyExecutor,
  type ActionRequest,
  type ExecutionRecord,
  type ActionFilter,
  type ActionExecutor,
} from "../application/action-engine.js";

// ── In-Memory Repository ───────────────────────────────────────────────────

class InMemoryExecutionRepository {
  private records = new Map<string, ExecutionRecord>();

  save(record: ExecutionRecord): void {
    this.records.set(record.executionId, { ...record });
  }

  findById(executionId: string): ExecutionRecord | undefined {
    const r = this.records.get(executionId);
    return r ? { ...r } : undefined;
  }

  findByActionId(actionId: string): ExecutionRecord | undefined {
    return Array.from(this.records.values()).find((r) => r.request.id === actionId);
  }

  findByHash(hash: string): ExecutionRecord | undefined {
    return Array.from(this.records.values()).find((r) => r.executionHash === hash);
  }

  findAll(filter?: ActionFilter): ExecutionRecord[] {
    let records = Array.from(this.records.values());
    if (filter) {
      records = records.filter((r) => {
        if (filter.status && r.status !== filter.status) return false;
        if (filter.type && r.request.type !== filter.type) return false;
        if (filter.correlationId && r.request.correlationId !== filter.correlationId) return false;
        return true;
      });
    }
    return records;
  }

  count(filter?: ActionFilter): number {
    return this.findAll(filter).length;
  }
}

// ── File Repository Tests ──────────────────────────────────────────────────

describe("FileExecutionRepository", () => {
  let tmpDir: string;
  let repo: FileExecutionRepository;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `shitenno-exec-repo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    repo = new FileExecutionRepository(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and loads an execution record", () => {
    const record: ExecutionRecord = {
      executionId: "EXE-TEST-001",
      request: { id: "act-1", type: "log_event", params: {} },
      executionHash: "abc123",
      status: "completed",
      result: "success",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      duration: 100,
    };

    repo.save(record);
    const loaded = repo.findById("EXE-TEST-001");
    expect(loaded).toBeDefined();
    expect(loaded?.status).toBe("completed");
  });

  it("returns undefined for non-existent record", () => {
    expect(repo.findById("EXE-NONEXISTENT")).toBeUndefined();
  });

  it("finds by action ID", () => {
    const record: ExecutionRecord = {
      executionId: "EXE-001",
      request: { id: "act-unique", type: "log_event", params: {} },
      executionHash: "hash1",
      status: "completed",
      startedAt: new Date().toISOString(),
    };

    repo.save(record);
    expect(repo.findByActionId("act-unique")).toBeDefined();
    expect(repo.findByActionId("act-other")).toBeUndefined();
  });

  it("finds by execution hash", () => {
    const record: ExecutionRecord = {
      executionId: "EXE-001",
      request: { id: "act-1", type: "log_event", params: {} },
      executionHash: "hash-unique",
      status: "completed",
      startedAt: new Date().toISOString(),
    };

    repo.save(record);
    expect(repo.findByHash("hash-unique")).toBeDefined();
    expect(repo.findByHash("hash-other")).toBeUndefined();
  });

  it("filters by status", () => {
    const r1: ExecutionRecord = {
      executionId: "EXE-001",
      request: { id: "a1", type: "log_event", params: {} },
      executionHash: "h1", status: "completed", startedAt: new Date().toISOString(),
    };
    const r2: ExecutionRecord = {
      executionId: "EXE-002",
      request: { id: "a2", type: "notify", params: {} },
      executionHash: "h2", status: "failed", startedAt: new Date().toISOString(),
    };

    repo.save(r1);
    repo.save(r2);
    expect(repo.findAll({ status: "completed" })).toHaveLength(1);
    expect(repo.findAll({ status: "failed" })).toHaveLength(1);
  });
});

// ── Hash Utility Tests ─────────────────────────────────────────────────────

describe("computeExecutionHash", () => {
  it("produces consistent hash for same inputs", () => {
    const h1 = computeExecutionHash("log_event", { event: "test" });
    const h2 = computeExecutionHash("log_event", { event: "test" });
    expect(h1).toBe(h2);
  });

  it("produces different hash for different inputs", () => {
    const h1 = computeExecutionHash("log_event", { event: "test1" });
    const h2 = computeExecutionHash("log_event", { event: "test2" });
    expect(h1).not.toBe(h2);
  });

  it("produces different hash for different types", () => {
    const h1 = computeExecutionHash("log_event", { event: "test" });
    const h2 = computeExecutionHash("notify", { event: "test" });
    expect(h1).not.toBe(h2);
  });

  it("returns 16-char hex string", () => {
    const hash = computeExecutionHash("test", {});
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

// ── Executor Tests ─────────────────────────────────────────────────────────

describe("Built-in Executors", () => {
  it("LogEventExecutor executes", async () => {
    const executor = new LogEventExecutor();
    const result = await executor.execute({ event: "test", message: "Hello" });
    expect(result.logged).toBe(true);
    expect(result.event).toBe("test");
  });

  it("NotifyExecutor executes", async () => {
    const executor = new NotifyExecutor();
    const result = await executor.execute({ message: "Build complete", level: "info" });
    expect(result.notified).toBe(true);
  });
});

// ── ActionEngine Tests ─────────────────────────────────────────────────────

describe("ActionEngine", () => {
  let repo: InMemoryExecutionRepository;
  let engine: ActionEngine;

  beforeEach(() => {
    repo = new InMemoryExecutionRepository();
    engine = new ActionEngine(repo as unknown as any, "");
  });

  it("executes an action successfully", async () => {
    const request: ActionRequest = {
      id: "act-001",
      type: "log_event",
      params: { event: "test", message: "Hello" },
    };

    const record = await engine.execute(request);
    expect(record.status).toBe("completed");
    expect(record.result).toBe("success");
    expect(record.output?.logged).toBe(true);
    expect(record.duration).toBeGreaterThanOrEqual(0);
  });

  it("returns failure for unknown action type", async () => {
    const request: ActionRequest = {
      id: "act-unknown",
      type: "unknown_type",
      params: {},
    };

    const record = await engine.execute(request);
    expect(record.status).toBe("failed");
    expect(record.error).toContain("No executor registered");
  });

  it("is idempotent by action ID", async () => {
    const request: ActionRequest = {
      id: "act-idempotent",
      type: "log_event",
      params: { event: "test" },
    };

    const r1 = await engine.execute(request);
    const r2 = await engine.execute(request);
    expect(r1.executionId).toBe(r2.executionId);
    expect(r2.status).toBe("completed");
  });

  it("is idempotent by execution hash", async () => {
    const r1 = await engine.execute({
      id: "act-hash-1",
      type: "log_event",
      params: { event: "test" },
    });

    const r2 = await engine.execute({
      id: "act-hash-2",
      type: "log_event",
      params: { event: "test" },
    });

    // Different action IDs but same hash → should return existing
    expect(r1.executionId).toBe(r2.executionId);
  });

  it("tracks correlation ID", async () => {
    const record = await engine.execute({
      id: "act-corr",
      type: "log_event",
      params: { event: "test" },
      correlationId: "corr-123",
    });

    expect(record.request.correlationId).toBe("corr-123");
  });

  it("registers custom executor", async () => {
    const customExecutor: ActionExecutor = {
      name: "custom_action",
      execute: async (params) => ({ custom: true, ...params }),
    };

    engine.registerExecutor(customExecutor);

    const record = await engine.execute({
      id: "act-custom",
      type: "custom_action",
      params: { data: "test" },
    });

    expect(record.status).toBe("completed");
    expect(record.output?.custom).toBe(true);
  });

  it("get() retrieves execution record", async () => {
    const record = await engine.execute({
      id: "act-get",
      type: "log_event",
      params: { event: "test" },
    });

    const found = engine.get(record.executionId);
    expect(found?.executionId).toBe(record.executionId);
  });

  it("getByActionId() retrieves by action ID", async () => {
    await engine.execute({
      id: "act-lookup",
      type: "log_event",
      params: { event: "test" },
    });

    const found = engine.getByActionId("act-lookup");
    expect(found).toBeDefined();
    expect(found?.request.id).toBe("act-lookup");
  });

  it("list() returns all executions", async () => {
    await engine.execute({ id: "a1", type: "log_event", params: {} });
    await engine.execute({ id: "a2", type: "notify", params: {} });

    expect(engine.list()).toHaveLength(2);
  });

  it("count() returns correct count", async () => {
    await engine.execute({ id: "a1", type: "log_event", params: {} });
    expect(engine.count()).toBe(1);
  });

  it("stats() returns correct statistics", async () => {
    await engine.execute({ id: "a1", type: "log_event", params: {} });
    await engine.execute({ id: "a2", type: "notify", params: {} });

    const stats = engine.stats();
    expect(stats.total).toBe(2);
    expect(stats.byStatus.completed).toBe(2);
    expect(stats.successRate).toBe(100);
  });

  it("rollback() marks as rolled back", async () => {
    // Custom executor with rollback
    const rollbackExecutor: ActionExecutor = {
      name: "rollbackable",
      execute: async () => ({ done: true }),
      rollback: async () => { /* noop */ },
    };
    engine.registerExecutor(rollbackExecutor);

    const record = await engine.execute({
      id: "act-rb",
      type: "rollbackable",
      params: {},
    });

    const rolledBack = await engine.rollback(record.executionId);
    expect(rolledBack?.status).toBe("rolled_back");
    expect(rolledBack?.rollback?.status).toBe("completed");
  });

  it("rollback() fails for non-existent record", async () => {
    const result = await engine.rollback("EXE-NONEXISTENT");
    expect(result).toBeUndefined();
  });

  it("rollback() fails for non-completed record", async () => {
    const record = await engine.execute({
      id: "act-fail-rb",
      type: "unknown_type",
      params: {},
    });

    // Record is failed, not completed
    const result = await engine.rollback(record.executionId);
    expect(result).toBeUndefined();
  });

  it("policy-blocked action produces status: failed with Blocked by policy message", async () => {
    const policyDir = join(tmpdir(), `shitenno-policy-test-${Date.now()}`);
    try {
      mkdirSync(join(policyDir, ".shitenno", "governance", "policies"), { recursive: true });

      writeFileSync(
        join(policyDir, ".shitenno", "governance", "policies", "POL-BLOCK001.json"),
        JSON.stringify({
          id: "POL-BLOCK001",
          name: "block-log-event",
          description: "Block log_event actions",
          mode: "enforce",
          effect: "deny",
          conditions: [
            { field: "actionType", operator: "equals", value: "log_event" },
          ],
          actions: [],
          enabled: true,
          priority: 1,
        }, null, 2)
      );

      const policyRepo = new FileExecutionRepository(join(policyDir, ".shitenno"));
      const restrictedEngine = new ActionEngine(policyRepo, join(policyDir, ".shitenno"));

      const request: ActionRequest = {
        id: "act-policy-blocked",
        type: "log_event",
        params: { event: "test" },
      };

      const record = await restrictedEngine.execute(request);
      expect(record.status).toBe("failed");
      expect(record.result).toBe("failure");
      expect(record.error).toContain("Blocked by policy");
    } finally {
      rmSync(policyDir, { recursive: true, force: true });
    }
  });
});
