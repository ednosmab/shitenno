/**
 * console-data-collector.test.ts — Tests for console data collection
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { collectConsoleData, } from "../console/data-collector.js";

import { mkdtempSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("collectConsoleData", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "shitenno-console-test-"));
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return an object with all required fields", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });

    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("projectRoot");
    expect(data).toHaveProperty("shitennoDir");
    expect(data).toHaveProperty("lifecycle");
    expect(data).toHaveProperty("engineering");
    expect(data).toHaveProperty("maturity");
    expect(data).toHaveProperty("graph");
    expect(data).toHaveProperty("debt");
    expect(data).toHaveProperty("capabilities");
    expect(data).toHaveProperty("capabilityEntities");
    expect(data).toHaveProperty("goals");
    expect(data).toHaveProperty("decisions");
    expect(data).toHaveProperty("session");
    expect(data).toHaveProperty("recentEvents");
    expect(data).toHaveProperty("growth");
    expect(data).toHaveProperty("entropy");
    expect(data).toHaveProperty("health");
    expect(data).toHaveProperty("stats");
  });

  it("should return valid timestamp", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    const timestamp = new Date(data.timestamp);
    expect(timestamp.getTime()).not.toBeNaN();
  });

  it("should return correct projectRoot and shitennoDir", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.projectRoot).toBe(tempDir);
    expect(data.shitennoDir).toBe(shitennoDir);
  });

  it("should return engineering state with maturity", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.engineering).toBeDefined();
    // maturity can be null if no profile exists
    if (data.engineering.maturity) {
      expect(data.engineering.maturity.dimensions).toBeDefined();
      expect(typeof data.engineering.maturity.overallScore).toBe("number");
    }
  });

  it("should return health scores between 0 and 100", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.health.overall).toBeGreaterThanOrEqual(0);
    expect(data.health.overall).toBeLessThanOrEqual(100);
    expect(data.health.knowledgeDebt).toBeGreaterThanOrEqual(0);
    expect(data.health.knowledgeDebt).toBeLessThanOrEqual(100);
    expect(data.health.knowledgeGraph).toBeGreaterThanOrEqual(0);
    expect(data.health.knowledgeGraph).toBeLessThanOrEqual(100);
    expect(data.health.entropy).toBeGreaterThanOrEqual(0);
    expect(data.health.entropy).toBeLessThanOrEqual(100);
  });

  it("should return graph with required fields", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.graph).toBeDefined();
    expect(typeof data.graph.totalArtifacts).toBe("number");
    expect(typeof data.graph.totalRelations).toBe("number");
    expect(typeof data.graph.healthScore).toBe("number");
    expect(Array.isArray(data.graph.orphanArtifacts)).toBe(true);
    expect(Array.isArray(data.graph.hubArtifacts)).toBe(true);
    expect(Array.isArray(data.graph.cycles)).toBe(true);
  });

  it("should return session with required fields", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.session).toBeDefined();
    expect(typeof data.session.totalSessions).toBe("number");
    expect(typeof data.session.avgDuration).toBe("number");
    expect(typeof data.session.totalCommands).toBe("number");
    expect(typeof data.session.challengingRatio).toBe("number");
  });

  it("should return arrays for goals and decisions", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(Array.isArray(data.goals)).toBe(true);
    expect(Array.isArray(data.decisions)).toBe(true);
  });

  it("should return entropy with required fields", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.entropy).toBeDefined();
    expect(typeof data.entropy.orphanedAssets).toBe("number");
    expect(typeof data.entropy.staleAssets).toBe("number");
    expect(typeof data.entropy.missingDependencies).toBe("number");
    expect(typeof data.entropy.score).toBe("number");
  });

  it("should return stats with required fields", async () => {
    const shitennoDir = join(tempDir, "shitenno");
    const data = await collectConsoleData(tempDir, shitennoDir);

    expect(data.stats).toBeDefined();
    expect(typeof data.stats.totalAssets).toBe("number");
    expect(typeof data.stats.totalRules).toBe("number");
    expect(typeof data.stats.totalSkills).toBe("number");
    expect(typeof data.stats.totalAdrs).toBe("number");
  });

  it("should handle non-existent directory gracefully", async () => {
    const fakeDir = join(tempDir, "non-existent");
    const fakeShitenno = join(fakeDir, "shitenno");

    const data = await collectConsoleData(fakeDir, fakeShitenno);

    expect(data).toBeDefined();
    expect(data.projectRoot).toBe(fakeDir);
    expect(data.lifecycle).toBeDefined();
  });
});
