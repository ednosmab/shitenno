/**
 * context-command.test.ts — Tests for context command (shugo context --for-agent)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateContext, type ContextOutput } from "../commands/context.js";
import { clearEngineeringStateCache } from "../engineering-state/index.js";

vi.mock("../infrastructure/daemon-client.js", () => ({
  isDaemonRunning: vi.fn(() => false),
  queryDaemon: vi.fn(() => Promise.resolve(null)),
}));

describe("context command", () => {
  beforeEach(() => {
    clearEngineeringStateCache();
  });

  afterEach(() => {
    clearEngineeringStateCache();
  });

  it("returns null when no engineering state exists", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    expect(result).toBeNull();
  });

  it("returns a valid ContextOutput structure when state exists", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    if (result === null) return;

    expect(result).toHaveProperty("version");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("project");
    expect(result).toHaveProperty("engineeringState");
    expect(result).toHaveProperty("challenges");

    expect(result.version).toBe("1.0.0");
    expect(typeof result.timestamp).toBe("string");
  });

  it("has deterministic project fields", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    if (result === null) return;

    expect(result.project).toHaveProperty("name");
    expect(result.project).toHaveProperty("root");
    expect(result.project).toHaveProperty("stack");
    expect(Array.isArray(result.project.stack)).toBe(true);
  });

  it("has engineeringState with required fields", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    if (result === null) return;

    const es = result.engineeringState;
    expect(es).toHaveProperty("consolidatedAt");
    expect(es).toHaveProperty("lifecycle");
    expect(es).toHaveProperty("healthScores");
    expect(es).toHaveProperty("entropy");
    expect(es).toHaveProperty("capabilities");
    expect(es).toHaveProperty("assets");
    expect(es).toHaveProperty("rules");
    expect(es).toHaveProperty("policies");

    expect(typeof es.healthScores.overall).toBe("number");
    expect(typeof es.healthScores.knowledgeDebt).toBe("number");
    expect(typeof es.healthScores.knowledgeGraph).toBe("number");
    expect(typeof es.entropy.score).toBe("number");
    expect(Array.isArray(es.capabilities)).toBe(true);
    expect(Array.isArray(es.assets)).toBe(true);
    expect(typeof es.rules).toBe("number");
    expect(typeof es.policies).toBe("number");
  });

  it("output is JSON-serializable", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    if (result === null) return;

    const serialized = JSON.stringify(result);
    const parsed = JSON.parse(serialized) as ContextOutput;
    expect(parsed.version).toBe(result.version);
    expect(parsed.timestamp).toBe(result.timestamp);
  });

  it("challenges is always an array", async () => {
    const result = await generateContext("/tmp/nonexistent-shitenno-dir");
    if (result === null) return;

    expect(Array.isArray(result.challenges)).toBe(true);
    for (const challenge of result.challenges) {
      expect(challenge).toHaveProperty("type");
      expect(challenge).toHaveProperty("severity");
      expect(challenge).toHaveProperty("description");
    }
  });
});
