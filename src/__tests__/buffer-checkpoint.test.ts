/**
 * Tests for buffer-checkpoint.ts
 *
 * Tests the checkpoint mechanism for context_buffer.yaml.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "buffer-checkpoint-test-"));
  shitennoDir = join(tempDir, "shitenno");
  mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
  writeFileSync(
    join(shitennoDir, "governance", "context", "context_buffer.yaml"),
    "session:\n  status: active\ncurrent_task:\n  id: test\n"
  );
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

vi.mock("../shared/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  checkpointBuffer,
  listCheckpoints,
  getLatestCheckpoint,
  restoreCheckpoint,
} from "../infrastructure/buffer-checkpoint.js";

describe("checkpointBuffer", () => {
  it("creates a checkpoint successfully", () => {
    const result = checkpointBuffer(shitennoDir);

    expect(result.success).toBe(true);
    expect(result.checkpointPath).toBeDefined();
    expect(result.checkpointPath).toContain("checkpoints");
    expect(result.message).toContain("Checkpoint created");
  });

  it("creates checkpoint directory if it does not exist", () => {
    const newShitennoDir = join(tempDir, "new-shitenno");
    mkdirSync(join(newShitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(newShitennoDir, "governance", "context", "context_buffer.yaml"),
      "test: data"
    );

    const result = checkpointBuffer(newShitennoDir);
    expect(result.success).toBe(true);
    expect(existsSync(join(newShitennoDir, "governance", "context", "checkpoints"))).toBe(true);
  });

  it("returns error when context_buffer.yaml does not exist", () => {
    const emptyDir = join(tempDir, "empty");
    mkdirSync(join(emptyDir, "governance", "context", "checkpoints"), { recursive: true });

    const result = checkpointBuffer(emptyDir);
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("checkpoint file contains the buffer content", () => {
    const result = checkpointBuffer(shitennoDir);
    expect(result.success).toBe(true);

    const checkpointContent = readFileSync(result.checkpointPath!, "utf-8");
    expect(checkpointContent).toContain("status: active");
    expect(checkpointContent).toContain("current_task");
  });

  it("cleans up old checkpoints beyond MAX_CHECKPOINTS (50)", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });

    // Create 52 existing checkpoints
    for (let i = 0; i < 52; i++) {
      writeFileSync(join(checkpointsDir, `2026-07-${String(i + 1).padStart(2, "0")}T00-00-00.yaml`), "old data");
    }

    const result = checkpointBuffer(shitennoDir);
    expect(result.success).toBe(true);
    expect(result.removedCount).toBeGreaterThan(0);

    const remaining = readdirSync(checkpointsDir).filter((f) => f.endsWith(".yaml"));
    expect(remaining.length).toBeLessThanOrEqual(51); // 50 old + 1 new
  });
});

describe("listCheckpoints", () => {
  it("returns empty array when no checkpoints exist", () => {
    const checkpoints = listCheckpoints(shitennoDir);
    expect(checkpoints).toEqual([]);
  });

  it("returns checkpoints sorted newest first", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });

    writeFileSync(join(checkpointsDir, "2026-07-01.yaml"), "data1");
    writeFileSync(join(checkpointsDir, "2026-07-03.yaml"), "data3");
    writeFileSync(join(checkpointsDir, "2026-07-02.yaml"), "data2");

    const checkpoints = listCheckpoints(shitennoDir);
    expect(checkpoints.length).toBe(3);
    expect(checkpoints[0]).toBe("2026-07-03.yaml");
    expect(checkpoints[1]).toBe("2026-07-02.yaml");
    expect(checkpoints[2]).toBe("2026-07-01.yaml");
  });

  it("ignores non-yaml files", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });

    writeFileSync(join(checkpointsDir, "2026-07-01.yaml"), "data");
    writeFileSync(join(checkpointsDir, "readme.txt"), "not a checkpoint");

    const checkpoints = listCheckpoints(shitennoDir);
    expect(checkpoints.length).toBe(1);
  });

  it("returns empty array when checkpoints directory does not exist", () => {
    const checkpoints = listCheckpoints(join(tempDir, "nonexistent"));
    expect(checkpoints).toEqual([]);
  });
});

describe("getLatestCheckpoint", () => {
  it("returns null when no checkpoints exist", () => {
    expect(getLatestCheckpoint(shitennoDir)).toBeNull();
  });

  it("returns the most recent checkpoint", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });

    writeFileSync(join(checkpointsDir, "2026-07-01.yaml"), "data1");
    writeFileSync(join(checkpointsDir, "2026-07-03.yaml"), "data3");

    expect(getLatestCheckpoint(shitennoDir)).toBe("2026-07-03.yaml");
  });
});

describe("restoreCheckpoint", () => {
  it("restores a checkpoint to context_buffer.yaml", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });
    writeFileSync(join(checkpointsDir, "old-state.yaml"), "session:\n  status: completed\n");

    const result = restoreCheckpoint(shitennoDir, "old-state.yaml");
    expect(result.success).toBe(true);
    expect(result.message).toContain("Restored");

    const restored = readFileSync(
      join(shitennoDir, "governance", "context", "context_buffer.yaml"),
      "utf-8"
    );
    expect(restored).toContain("status: completed");
  });

  it("returns error when checkpoint does not exist", () => {
    const result = restoreCheckpoint(shitennoDir, "nonexistent.yaml");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("creates a pre-restore checkpoint before overwriting", () => {
    const checkpointsDir = join(shitennoDir, "governance", "context", "checkpoints");
    mkdirSync(checkpointsDir, { recursive: true });
    writeFileSync(join(checkpointsDir, "backup.yaml"), "session:\n  status: done\n");

    // Count checkpoints before restore
    const before = readdirSync(checkpointsDir).filter((f) => f.endsWith(".yaml")).length;

    restoreCheckpoint(shitennoDir, "backup.yaml");

    // Should have 1 more checkpoint (the pre-restore backup)
    const after = readdirSync(checkpointsDir).filter((f) => f.endsWith(".yaml")).length;
    expect(after).toBe(before + 1);
  });
});
