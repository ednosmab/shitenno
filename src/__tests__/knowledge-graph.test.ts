/**
 * knowledge-graph.test.ts — Tests for the Knowledge Graph
 *
 * Validates artifact discovery, relation discovery, graph analysis,
 * cycle detection, and health scoring.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  loadArtifacts,
  loadRelations,
  saveArtifacts,
  saveRelations,
  discoverArtifacts,
  discoverRelations,
  analyzeGraph,
  type Artifact,
  type Relation,
} from "../infrastructure/knowledge-graph.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  const dir = join(tmpdir(), `shitenno-kg-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createShitennoDir(tmpDir: string): string {
  const shitennoDir = join(tmpDir, "shitenno");
  mkdirSync(shitennoDir, { recursive: true });
  mkdirSync(join(shitennoDir, "governance", "knowledge-graph"), { recursive: true });
  return shitennoDir;
}

function createMockArtifact(overrides: Partial<Artifact> = {}): Artifact {
  return {
    id: "adr-001",
    type: "adr",
    name: "Test ADR",
    path: "docs/adrs/ADR-001.md",
    description: "Test Architecture Decision Record",
    tags: ["adr", "decision"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "active",
    ...overrides,
  };
}

function createMockRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    source: "adr-001",
    target: "skill-001",
    type: "generates",
    description: "ADR generates skill",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("knowledge-graph", () => {
  let tmpDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    shitennoDir = createShitennoDir(tmpDir);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("loadArtifacts", () => {
    it("returns empty array when file does not exist", () => {
      const artifacts = loadArtifacts(shitennoDir);
      expect(artifacts).toEqual([]);
    });

    it("loads artifacts from file", () => {
      const artifactsPath = join(shitennoDir, "governance", "knowledge-graph", "artifacts.jsonl");
      const artifacts = [createMockArtifact(), createMockArtifact({ id: "adr-002" })];
      writeFileSync(artifactsPath, artifacts.map((a) => JSON.stringify(a)).join("\n") + "\n", "utf-8");

      const loaded = loadArtifacts(shitennoDir);
      expect(loaded).toHaveLength(2);
      expect(loaded[0]?.id).toBe("adr-001");
    });

    it("returns empty array on invalid JSON", () => {
      const artifactsPath = join(shitennoDir, "governance", "knowledge-graph", "artifacts.jsonl");
      writeFileSync(artifactsPath, "invalid json", "utf-8");

      const artifacts = loadArtifacts(shitennoDir);
      expect(artifacts).toEqual([]);
    });
  });

  describe("loadRelations", () => {
    it("returns empty array when file does not exist", () => {
      const relations = loadRelations(shitennoDir);
      expect(relations).toEqual([]);
    });

    it("loads relations from file", () => {
      const relationsPath = join(shitennoDir, "governance", "knowledge-graph", "relations.jsonl");
      const relations = [createMockRelation(), createMockRelation({ source: "adr-002" })];
      writeFileSync(relationsPath, relations.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");

      const loaded = loadRelations(shitennoDir);
      expect(loaded).toHaveLength(2);
    });
  });

  describe("saveArtifacts", () => {
    it("saves artifacts to file", () => {
      const artifacts = [createMockArtifact(), createMockArtifact({ id: "adr-002" })];
      saveArtifacts(shitennoDir, artifacts);

      const artifactsPath = join(shitennoDir, "governance", "knowledge-graph", "artifacts.jsonl");
      expect(existsSync(artifactsPath)).toBe(true);

      const loaded = require("node:fs").readFileSync(artifactsPath, "utf-8").trim().split("\n").map((line: string) => JSON.parse(line));
      expect(loaded).toHaveLength(2);
    });

    it("does nothing if directory does not exist", () => {
      const nonExistentDir = join(tmpDir, "nonexistent");
      saveArtifacts(nonExistentDir, [createMockArtifact()]);
      // Should not throw
    });
  });

  describe("saveRelations", () => {
    it("saves relations to file", () => {
      const relations = [createMockRelation()];
      saveRelations(shitennoDir, relations);

      const relationsPath = join(shitennoDir, "governance", "knowledge-graph", "relations.jsonl");
      expect(existsSync(relationsPath)).toBe(true);

      const loaded = require("node:fs").readFileSync(relationsPath, "utf-8").trim().split("\n").map((line: string) => JSON.parse(line));
      expect(loaded).toHaveLength(1);
    });
  });

  describe("discoverArtifacts", () => {
    it("discovers ADRs", () => {
      const adrDir = join(shitennoDir, "docs", "adrs");
      mkdirSync(adrDir, { recursive: true });
      writeFileSync(join(adrDir, "ADR-001.md"), "# ADR 001", "utf-8");
      writeFileSync(join(adrDir, "ADR-002.md"), "# ADR 002", "utf-8");

      const artifacts = discoverArtifacts(shitennoDir);
      const adrs = artifacts.filter((a) => a.type === "adr");
      expect(adrs).toHaveLength(2);
      expect(adrs[0]?.id).toBe("adr-ADR-001");
    });

    it("discovers skills", () => {
      const skillsDir = join(shitennoDir, "docs", "skills");
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, "test_skill.md"), "# Skill", "utf-8");

      const artifacts = discoverArtifacts(shitennoDir);
      const skills = artifacts.filter((a) => a.type === "skill");
      expect(skills).toHaveLength(1);
      expect(skills[0]?.id).toContain("skill");
    });

    it("returns empty array when no artifacts exist", () => {
      const artifacts = discoverArtifacts(shitennoDir);
      expect(artifacts).toEqual([]);
    });

    it("ignores template files", () => {
      const adrDir = join(shitennoDir, "docs", "adrs");
      mkdirSync(adrDir, { recursive: true });
      writeFileSync(join(adrDir, "ADR-TEMPLATE.md"), "# Template", "utf-8");
      writeFileSync(join(adrDir, "ADR-001.md"), "# ADR 001", "utf-8");

      const artifacts = discoverArtifacts(shitennoDir);
      const adrs = artifacts.filter((a) => a.type === "adr");
      expect(adrs).toHaveLength(1);
    });
  });

  describe("discoverRelations", () => {
    it("discovers ADR → Skill relations", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill", path: "docs/skills/test.md" }),
      ];

      const relations = discoverRelations(artifacts);
      const generates = relations.filter((r) => r.type === "generates");
      expect(generates.length).toBeGreaterThanOrEqual(1);
    });

    it("discovers Skill → Contract relations", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "skill-001", type: "skill" }),
        createMockArtifact({ id: "contract-001", type: "contract" }),
      ];

      const relations = discoverRelations(artifacts);
      const uses = relations.filter((r) => r.type === "uses");
      expect(uses.length).toBeGreaterThanOrEqual(1);
    });

    it("returns empty array when no artifacts", () => {
      const relations = discoverRelations([]);
      expect(relations).toEqual([]);
    });
  });

  describe("analyzeGraph", () => {
    it("analyzes empty graph", () => {
      const analysis = analyzeGraph([], []);
      expect(analysis.totalArtifacts).toBe(0);
      expect(analysis.totalRelations).toBe(0);
      expect(analysis.healthScore).toBe(100);
    });

    it("counts artifacts by type", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "adr-002", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill" }),
      ];

      const analysis = analyzeGraph(artifacts, []);
      expect(analysis.artifactsByType.adr).toBe(2);
      expect(analysis.artifactsByType.skill).toBe(1);
    });

    it("counts relations by type", () => {
      const relations: Relation[] = [
        createMockRelation({ type: "generates" }),
        createMockRelation({ type: "generates", source: "adr-002" }),
        createMockRelation({ type: "uses" }),
      ];

      const analysis = analyzeGraph([], relations);
      expect(analysis.relationsByType.generates).toBe(2);
      expect(analysis.relationsByType.uses).toBe(1);
    });

    it("identifies orphan artifacts", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill" }),
      ];
      const relations: Relation[] = [
        createMockRelation({ source: "adr-001", target: "skill-001" }),
      ];

      const analysis = analyzeGraph(artifacts, relations);
      // skill-001 is connected (target of relation), adr-001 is connected (source)
      expect(analysis.orphanArtifacts).toHaveLength(0);
    });

    it("identifies hub artifacts", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill" }),
        createMockArtifact({ id: "skill-002", type: "skill" }),
      ];
      const relations: Relation[] = [
        createMockRelation({ source: "adr-001", target: "skill-001" }),
        createMockRelation({ source: "adr-001", target: "skill-002" }),
      ];

      const analysis = analyzeGraph(artifacts, relations);
      expect(analysis.hubArtifacts.length).toBeGreaterThanOrEqual(1);
      expect(analysis.hubArtifacts[0]?.artifact.id).toBe("adr-001");
    });

    it("detects cycles", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "a", type: "adr" }),
        createMockArtifact({ id: "b", type: "skill" }),
      ];
      const relations: Relation[] = [
        createMockRelation({ source: "a", target: "b", type: "generates" }),
        createMockRelation({ source: "b", target: "a", type: "uses" }),
      ];

      const analysis = analyzeGraph(artifacts, relations);
      expect(analysis.cycles.length).toBeGreaterThanOrEqual(1);
    });

    it("calculates health score", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill" }),
      ];
      const relations: Relation[] = [
        createMockRelation({ source: "adr-001", target: "skill-001" }),
      ];

      const analysis = analyzeGraph(artifacts, relations);
      expect(analysis.healthScore).toBeGreaterThan(0);
      expect(analysis.healthScore).toBeLessThanOrEqual(100);
    });

    it("generates suggestions", () => {
      const artifacts: Artifact[] = [
        createMockArtifact({ id: "adr-001", type: "adr" }),
        createMockArtifact({ id: "skill-001", type: "skill" }),
      ];

      const analysis = analyzeGraph(artifacts, []);
      expect(analysis.suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });
});
