import { describe, it, expect } from "vitest";
import { extractKeywords, detectDrift, detectDriftBatch, scanCodebase, type CodebaseFacts } from "../infrastructure/semantic-drift-detector.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_FACTS: CodebaseFacts = {
  dependencies: ["react", "typescript", "vitest", "express"],
  imports: ["react", "express", "node:fs"],
  cliCommands: ["serve", "build", "test", "lint"],
  configKeys: ["PORT", "HOST", "DATABASE_URL", "NODE_ENV"],
};

function extractDependencies(content: string): { dependencies: string[] } {
  const deps = content.match(/(?:"|')(?:@?[\w-]+\/)?[\w-]+(?:"|')/g) ?? [];
  return { dependencies: deps.map(d => d.replace(/["']/g, "")) };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("extractKeywords", () => {
  it("extracts technical keywords from content", () => {
    const result = extractKeywords("We use React and TypeScript for the frontend");
    expect(result.technical).toContain("react");
    expect(result.technical).toContain("typescript");
  });

  it("extracts command references", () => {
    const result = extractKeywords("Run `shugo serve` to start the server");
    expect(result.commands).toContain("shugo serve");
  });

  it("extracts dependency references in quotes", () => {
    const result = extractDependencies('Install "express" or "fastify"');
    expect(result.dependencies).toContain("express");
    expect(result.dependencies).toContain("fastify");
  });

  it("extracts config keys (UPPERCASE with underscore)", () => {
    const result = extractKeywords("Set DATABASE_URL and NODE_ENV in .env");
    expect(result.configRefs).toContain("DATABASE_URL");
    expect(result.configRefs).toContain("NODE_ENV");
  });

  it("handles empty content gracefully", () => {
    const result = extractKeywords("");
    expect(result.technical).toHaveLength(0);
    expect(result.commands).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
    expect(result.configRefs).toHaveLength(0);
  });
});

describe("detectDrift", () => {
  it("detects drift when dependency is missing from codebase", () => {
    const result = detectDrift(
      { content: 'Install "postgresql" for the database', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.missingKeywords.length).toBeGreaterThan(0);
  });

  it("does not flag drift when dependency exists", () => {
    const result = detectDrift(
      { content: 'We use React for the UI', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBe(0);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("detects drift when CLI command is missing", () => {
    const result = detectDrift(
      { content: 'Run `shugo deploy` to deploy', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("does not flag existing CLI command", () => {
    const result = detectDrift(
      { content: 'Run `shugo serve` to start', type: "doc" },
      MOCK_FACTS
    );
    expect(result.confidence).toBe(0);
  });

  it("boosts confidence for runbooks", () => {
    const runbook = detectDrift(
      { content: 'Deploy using `shugo deploy`', type: "runbook" },
      MOCK_FACTS
    );
    const doc = detectDrift(
      { content: 'Deploy using `shugo deploy`', type: "doc" },
      MOCK_FACTS
    );
    expect(runbook.confidence).toBeGreaterThan(doc.confidence);
  });

  it("reduces confidence for old ADRs (historical)", () => {
    const oldAdr = detectDrift(
      { content: 'Install "postgresql" for the database', type: "adr", age: 400 },
      MOCK_FACTS
    );
    const newAdr = detectDrift(
      { content: 'Install "postgresql" for the database', type: "adr", age: 30 },
      MOCK_FACTS
    );
    expect(oldAdr.confidence).toBeLessThan(newAdr.confidence);
  });

  it("clamps confidence between 0 and 1", () => {
    const result = detectDrift(
      {
        content: 'We use PostgreSQL, MongoDB, Redis, Docker, Kubernetes, and many other things',
        type: "runbook",
        age: 10
      },
      { dependencies: [], imports: [], cliCommands: [], configKeys: [] }
    );
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });
});

describe("detectDriftBatch", () => {
  it("returns only documents with confidence > 0.8", () => {
    const docs = [
      { path: "docs/adr-001.md", content: "We use React", type: "adr", age: 30 },
      { path: "docs/runbook.md", content: 'Install with "mongodb" and "redis" and "docker" and run `shugo deploy`', type: "runbook" },
    ];
    const results = detectDriftBatch(docs, MOCK_FACTS);
    expect(results.length).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      expect(r.confidence).toBeGreaterThan(0.8);
    }
  });

  it("returns empty array when no significant drift", () => {
    const docs = [
      { path: "docs/adr-001.md", content: "We use React for UI", type: "adr", age: 30 },
    ];
    const results = detectDriftBatch(docs, MOCK_FACTS);
    expect(results).toHaveLength(0);
  });
});

describe("scanCodebase", () => {
  it("returns a CodebaseFacts object", () => {
    const facts = scanCodebase("/media/edson-ubuntu/Data2/projeto-formação_tech/shitenno-cli");
    expect(facts).toHaveProperty("dependencies");
    expect(facts).toHaveProperty("imports");
    expect(facts).toHaveProperty("cliCommands");
    expect(facts).toHaveProperty("configKeys");
    expect(Array.isArray(facts.dependencies)).toBe(true);
  });
});

// ── Golden set: known FPs must NOT generate drift ────────────────────────────

describe("golden set — false positives", () => {
  const FP_CASES = [
    { label: "ADR status words", content: 'Status: Done, Backlog, proposed' },
    { label: "Portuguese placeholders", content: 'Tarefa: Nenhuma. Proximo: Definir. Impedimentos: Nenhum' },
    { label: "Generic English terms", content: 'Focus on quality, automation, governance, documentation' },
    { label: "Template placeholders", content: 'projectName: my-project, areas: src/components' },
    { label: "UPPERCASE headings", content: '## COMMIT_PERMISSION\n## SYSTEM_MAP\n## FORBIDDEN_OPERATIONS' },
    { label: "Package-like refs", content: 'See shitenno-governance and shitenno packages' },
    { label: "Portuguese error words", content: 'Se erro, bug, corrigi, falhou, fazer rollback' },
    { label: "Config field names", content: 'churnWindowDays, weights, churn, violationRate, sensitiveSurface' },
    { label: "Formatted strings", content: 'Run pnpm management for setup' },
    { label: "Path-like refs", content: 'See src/services and docs/handbook for details' },
  ];

  for (const tc of FP_CASES) {
    it(`suppresses FP: ${tc.label}`, () => {
      const result = detectDrift(
        { content: tc.content, type: "doc" },
        { dependencies: [], imports: [], cliCommands: [], configKeys: [] }
      );
      expect(result.confidence).toBe(0);
      expect(result.missingKeywords).toHaveLength(0);
    });
  }
});

// ── Golden set: known drift must BE detected ─────────────────────────────────

describe("golden set — true drift", () => {
  const DRIFT_CASES = [
    {
      label: "missing npm dependency",
      content: 'Install "mongodb" for the database',
      facts: { dependencies: ["react"], imports: [], cliCommands: [], configKeys: [] },
    },
    {
      label: "missing CLI command",
      content: 'Run `shugo deploy` to deploy',
      facts: { dependencies: [], imports: [], cliCommands: ["status", "init"], configKeys: [] },
    },
    {
      label: "missing CLI command (shugo cli)",
      content: 'Run `shugo cli` for setup',
      facts: { dependencies: [], imports: [], cliCommands: ["status", "init"], configKeys: [] },
    },
    {
      label: "missing env var",
      content: 'Set DATABASE_URL in your .env file',
      facts: { dependencies: [], imports: [], cliCommands: [], configKeys: ["PORT"] },
    },
  ];

  for (const tc of DRIFT_CASES) {
    it(`detects drift: ${tc.label}`, () => {
      const result = detectDrift(
        { content: tc.content, type: "doc" },
        tc.facts
      );
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.missingKeywords.length).toBeGreaterThan(0);
    });
  }
});
