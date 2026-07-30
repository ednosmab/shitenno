/**
 * context-buffer-writer.test.ts — Tests for context buffer writer
 *
 * Validates section-aware YAML buffer updates.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  replaceSectionField,
  updateSession,
  updateCurrentTask,
  updateNextP0,
  addCompletedTask,
  updateSessionLifecycle,
  addReminder,
  clearRemindersByCategory,
  recordSkillResolution,
} from "../context-buffer-writer.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

const SAMPLE_BUFFER = `session:
  id: session-001
  status: active

current_task:
  id: task-001
  description: "Test task"
  status: "in_progress"

next_p0: "Some P0"

completed_tasks:
  - id: "old-task"
    description: "Old task"
    completed_at: "2026-07-01T00:00:00Z"
`;

function createTmpShitenno(): string {
  const dir = join(tmpdir(), `shitenno-test-${Date.now()}`);
  const governanceDir = join(dir, "governance", "context");
  mkdirSync(governanceDir, { recursive: true });
  writeFileSync(join(governanceDir, "context_buffer.yaml"), SAMPLE_BUFFER, "utf-8");
  return dir;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("replaceSectionField", () => {
  it("replaces flat key", () => {
    const result = replaceSectionField('name: "old"', "name", "new");
    expect(result.updated).toBe(true);
    expect(result.content).toBe('name: "new"');
  });

  it("replaces nested key within section", () => {
    const content = `session:\n  id: "s1"\n  status: "active"\n\ncurrent_task:\n  id: "t1"\n  status: "pending"`;
    const result = replaceSectionField(content, "current_task.status", "done");
    expect(result.updated).toBe(true);
    expect(result.content).toContain(`current_task:\n  id: "t1"\n  status: "done"`);
    expect(result.content).toContain(`session:\n  id: "s1"\n  status: "active"`);
  });

  it("returns updated=false when field not found", () => {
    const result = replaceSectionField('name: "old"', "missing", "value");
    expect(result.updated).toBe(false);
  });
});

describe("updateSession", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates session status", () => {
    const result = updateSession(tmpDir, { status: "completed" });
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/status:\s*"?completed"?/);
  });

  it("returns error when buffer not found", () => {
    const result = updateSession("/nonexistent", { status: "active" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});

describe("updateCurrentTask", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates task status without touching session", () => {
    const result = updateCurrentTask(tmpDir, { status: "completed" });
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    const lines = content.split("\n");
    const sessionStatusLine = lines.find(l => l.includes("status:") && lines.indexOf(l) < lines.findIndex(l => l.includes("current_task")));
    expect(sessionStatusLine).toContain("active");
  });
});

describe("updateNextP0", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates existing next_p0", () => {
    const result = updateNextP0(tmpDir, "New P0");
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/next_p0:\s*"?New P0"?/);
  });
});

describe("addCompletedTask", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("appends task to completed_tasks", () => {
    const result = addCompletedTask(tmpDir, {
      id: "new-task",
      description: "New task",
      completed_at: "2026-07-10T00:00:00Z",
    });
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/id:\s*"?new-task"?/);
    expect(content).toMatch(/description:\s*"?New task"?/);
  });
});

describe("updateSessionLifecycle", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("updates both session and task in one write", () => {
    const result = updateSessionLifecycle(
      tmpDir,
      { status: "completed" },
      { status: "completed" }
    );
    expect(result.success).toBe(true);
    expect(result.message).toContain("session.status");
    expect(result.message).toContain("current_task.status");
  });
});

// ── Reminders ─────────────────────────────────────────────────────────────

describe("addReminder", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a reminder to buffer", () => {
    const result = addReminder(tmpDir, {
      message: "Doc desatualizada: daemon.md",
      priority: "high",
      category: "docs",
      createdAt: "2026-07-13T00:00:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/message:\s*"?Doc desatualizada: daemon.md"?/);
    expect(content).toMatch(/priority:\s*"?high"?/);
    expect(content).toMatch(/category:\s*"?docs"?/);
  });

  it("deduplicates by message text", () => {
    addReminder(tmpDir, {
      message: "Duplicate reminder",
      priority: "medium",
      category: "docs",
      createdAt: "2026-07-13T00:00:00Z",
    });
    const result = addReminder(tmpDir, {
      message: "Duplicate reminder",
      priority: "high",
      category: "bug",
      createdAt: "2026-07-14T00:00:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("creates reminders section if not present", () => {
    const noReminders = `session:
  id: session-001
  status: active
`;
    const governanceDir = join(tmpDir, "governance", "context");
    writeFileSync(join(governanceDir, "context_buffer.yaml"), noReminders, "utf-8");

    const result = addReminder(tmpDir, {
      message: "First reminder",
      priority: "low",
      category: "infra",
      createdAt: "2026-07-13T00:00:00Z",
    });
    expect(result.success).toBe(true);
    const content = readFileSync(join(governanceDir, "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/reminders:/);
    expect(content).toMatch(/message:\s*"?First reminder"?/);
  });

  it("returns error when buffer not found", () => {
    const result = addReminder("/nonexistent", {
      message: "test",
      priority: "low",
      category: "docs",
      createdAt: "2026-07-13T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });
});

describe("clearRemindersByCategory", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("removes reminders matching category", () => {
    const bufferWithReminders = `session:
  id: session-001
  status: active

reminders:
  - message: "Doc drift daemon"
    priority: "high"
    category: "docs"
    createdAt: "2026-07-13T00:00:00Z"
  - message: "Bug fix pending"
    priority: "medium"
    category: "bug"
    createdAt: "2026-07-13T00:00:00Z"
  - message: "Doc drift watch"
    priority: "low"
    category: "docs"
    createdAt: "2026-07-13T00:00:00Z"
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), bufferWithReminders, "utf-8");

    const result = clearRemindersByCategory(tmpDir, "docs");
    expect(result.success).toBe(true);
    expect(result.removed).toBe(2);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/category:\s*"?bug"?/);
    expect(content).not.toMatch(/category:\s*"?docs"?/);
  });

  it("returns 0 when no matching reminders", () => {
    const bufferWithReminders = `reminders:
  - message: "Only bug"
    priority: "high"
    category: "bug"
    createdAt: "2026-07-13T00:00:00Z"
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), bufferWithReminders, "utf-8");

    const result = clearRemindersByCategory(tmpDir, "docs");
    expect(result.success).toBe(true);
    expect(result.removed).toBe(0);
  });

  it("handles empty reminders section", () => {
    const result = clearRemindersByCategory(tmpDir, "docs");
    expect(result.success).toBe(true);
    expect(result.removed).toBe(0);
  });
});

// ── Skill Resolution Evidence ───────────────────────────────────────────────

describe("recordSkillResolution", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpShitenno();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("records a skill resolution entry into existing skills_resolved section", () => {
    const bufferWithSection = `session:
  id: session-001
  status: active

skills_resolved:
  - skillId: "tdd_workflow"
    taskMeta: "task=impl"
    reason: "mandatory"
    resolvedAt: "2026-07-22T00:00:00Z"
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), bufferWithSection, "utf-8");

    const result = recordSkillResolution(tmpDir, {
      skillId: "clean_code_standards",
      reason: "mandatory",
      taskMeta: "task=impl",
      resolvedAt: "2026-07-22T01:00:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/skillId:\s*"?clean_code_standards"?/);
    expect(content).toMatch(/taskMeta:\s*"?task=impl"?/);
    // Original entry still present
    expect(content).toMatch(/skillId:\s*"?tdd_workflow"?/);
  });

  it("deduplicates by skillId + taskMeta within the same task", () => {
    const bufferWithSection = `session:
  id: session-001
  status: active

skills_resolved:
  - skillId: "tdd_workflow"
    taskMeta: "task=impl"
    reason: "mandatory"
    resolvedAt: "2026-07-22T00:00:00Z"
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), bufferWithSection, "utf-8");

    const result = recordSkillResolution(tmpDir, {
      skillId: "tdd_workflow",
      reason: "mandatory",
      taskMeta: "task=impl",
      resolvedAt: "2026-07-22T02:00:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  it("allows same skillId with different taskMeta (different tasks)", () => {
    const bufferWithSection = `session:
  id: session-001
  status: active

skills_resolved:
  - skillId: "tdd_workflow"
    taskMeta: "task=impl"
    reason: "mandatory"
    resolvedAt: "2026-07-22T00:00:00Z"
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), bufferWithSection, "utf-8");

    const result = recordSkillResolution(tmpDir, {
      skillId: "tdd_workflow",
      reason: "contextual",
      taskMeta: "task=refactor",
      resolvedAt: "2026-07-22T03:00:00Z",
    });
    expect(result.success).toBe(true);
    expect(result.skipped).toBeUndefined();
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/taskMeta:\s*"?task=refactor"?/);
  });

  it("creates skills_resolved section if not present", () => {
    const noSection = `session:
  id: session-001
  status: active
`;
    writeFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), noSection, "utf-8");

    const result = recordSkillResolution(tmpDir, {
      skillId: "solid_principles",
      reason: "mandatory",
      taskMeta: "task=impl+typescript",
      resolvedAt: "2026-07-22T04:00:00Z",
    });
    expect(result.success).toBe(true);
    const content = readFileSync(join(tmpDir, "governance", "context", "context_buffer.yaml"), "utf-8");
    expect(content).toMatch(/skills_resolved:/);
    expect(content).toMatch(/skillId:\s*"?solid_principles"?/);
  });

  it("returns error when buffer not found", () => {
    const result = recordSkillResolution("/nonexistent", {
      skillId: "test",
      reason: "mandatory",
      taskMeta: "task=test",
      resolvedAt: "2026-07-22T00:00:00Z",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });
});
