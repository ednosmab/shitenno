import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectStatusMarkers,
  detectSupersession,
  classifyDocument,
  auditDocLifecycle,
  applyMoves,
  type DocumentInfo,
  type DetectionSignals,
} from "../application/doc-lifecycle-auditor.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-doc-lifecycle-"));
  shitennoDir = join(tempDir, ".shitenno");
  mkdirSync(shitennoDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("detectStatusMarkers", () => {
  it("detects completed status from 'Status: Concluído'", () => {
    const content = "# Plan\n\n### 1.1 Feature\n- **Status:** Concluído\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("completed");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("detects completed status from 'Status: Accepted' (ADR)", () => {
    const content = "# ADR-001: Use PostgreSQL\n\n**Status:** Accepted\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("completed");
  });

  it("detects planned status from 'Status: Proposed' (ADR)", () => {
    const content = "# ADR-001: Use PostgreSQL\n\n**Status:** Proposed\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("planned");
  });

  it("detects superseded status from 'Status: Superseded'", () => {
    const content = "# ADR-001: Use PostgreSQL\n\n**Status:** Superseded\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("superseded");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects in_progress status from 'Status: In Progress'", () => {
    const content = "# Plan\n\n### 1.1 Feature\n- **Status:** In Progress\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("in_progress");
  });

  it("returns null when no status markers found", () => {
    const content = "# Plan\n\nThis is a simple document without status markers.\n";
    const result = detectStatusMarkers(content);
    expect(result.status).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("detects mixed status with majority completed", () => {
    const content = `# Plan

### 1.1 Feature
- **Status:** Concluído

### 1.2 Feature
- **Status:** Concluído

### 1.3 Feature
- **Status:** Pendente
`;
    const result = detectStatusMarkers(content);
    expect(result.status).toBe("completed");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });
});

describe("detectSupersession", () => {
  it("detects supersession keywords in ADR content", () => {
    const adr: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-001.md",
      relativePath: "shitenno/docs/adrs/ADR-001.md",
      title: "ADR-001: Use PostgreSQL",
      content: "# ADR-001: Use PostgreSQL\n\nSuperseded by ADR-002.\n",
      docType: "adr",
    };
    const allAdrs: DocumentInfo[] = [adr];

    const result = detectSupersession(adr, allAdrs);
    expect(result.keywordsFound.length).toBeGreaterThan(0);
  });

  it("detects when another ADR references this one as superseded", () => {
    const adrOld: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-001.md",
      relativePath: "shitenno/docs/adrs/ADR-001.md",
      title: "ADR-001: Use PostgreSQL",
      content: "# ADR-001: Use PostgreSQL\n\n**Status:** Accepted\n",
      docType: "adr",
    };
    const adrNew: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-002.md",
      relativePath: "shitenno/docs/adrs/ADR-002.md",
      title: "ADR-002: Use MySQL",
      content: "# ADR-002: Use MySQL\n\nThis supersedes ADR-001.\n",
      docType: "adr",
    };

    const result = detectSupersession(adrOld, [adrOld, adrNew]);
    expect(result.supersededBy).toContain("ADR-002");
  });

  it("calculates topic similarity between ADRs", () => {
    const adr1: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-001.md",
      relativePath: "shitenno/docs/adrs/ADR-001.md",
      title: "ADR-001: Use PostgreSQL for Database",
      content: "# ADR-001: Use PostgreSQL for Database\n",
      docType: "adr",
    };
    const adr2: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-002.md",
      relativePath: "shitenno/docs/adrs/ADR-002.md",
      title: "ADR-002: Use MySQL for Database",
      content: "# ADR-002: Use MySQL for Database\n",
      docType: "adr",
    };

    const result = detectSupersession(adr1, [adr1, adr2]);
    expect(result.topicSimilarity).toBeGreaterThan(0);
  });

  it("returns low confidence when no supersession signals", () => {
    const adr: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-001.md",
      relativePath: "shitenno/docs/adrs/ADR-001.md",
      title: "ADR-001: Use TypeScript",
      content: "# ADR-001: Use TypeScript\n\n**Status:** Accepted\n",
      docType: "adr",
    };

    const result = detectSupersession(adr, [adr]);
    expect(result.confidence).toBeLessThan(0.5);
  });
});

describe("classifyDocument", () => {
  it("classifies plan as completed when all items marked done", () => {
    const doc: DocumentInfo = {
      path: "plans/plan.md",
      relativePath: "plans/plan.md",
      title: "Plan",
      content: "# Plan\n\n### 1.1\n- **Status:** Concluído\n\n### 1.2\n- **Status:** Concluído\n",
      docType: "plan",
    };
    const signals: DetectionSignals = {
      statusMarkers: { status: "completed", confidence: 0.9, evidence: ["Status: Concluído"] },
      crossReferences: [],
      gitCorrelation: { lastModified: new Date().toISOString(), referencedFilesExist: true, recentCommits: true },
      staleness: { ageInDays: 5, referencedByOtherDocs: true, recentCommits: true },
    };
    const classification = classifyDocument(doc, signals);
    expect(classification.status).toBe("completed");
    expect(classification.docType).toBe("plan");
    expect(classification.suggestedDestination).toContain("_archive/completed");
  });

  it("classifies ADR as superseded when supersession signals are strong", () => {
    const doc: DocumentInfo = {
      path: "shitenno/docs/adrs/ADR-001.md",
      relativePath: "shitenno/docs/adrs/ADR-001.md",
      title: "ADR-001: Use PostgreSQL",
      content: "# ADR-001: Use PostgreSQL\n",
      docType: "adr",
    };
    const signals: DetectionSignals = {
      statusMarkers: { status: null, confidence: 0, evidence: [] },
      crossReferences: [],
      gitCorrelation: { lastModified: new Date().toISOString(), referencedFilesExist: false, recentCommits: false },
      staleness: { ageInDays: 10, referencedByOtherDocs: false, recentCommits: false },
      supersessionSignals: {
        keywordsFound: [],
        topicSimilarity: 0.8,
        supersededBy: ["ADR-002"],
        confidence: 0.8,
      },
    };
    const classification = classifyDocument(doc, signals);
    expect(classification.status).toBe("superseded");
    expect(classification.docType).toBe("adr");
    expect(classification.suggestedDestination).toContain("_archive/superseded");
  });

  it("classifies plan as stale when no references and old", () => {
    const doc: DocumentInfo = {
      path: "plans/old-plan.md",
      relativePath: "plans/old-plan.md",
      title: "Old Plan",
      content: "# Old Plan\n\nSome content without status markers.\n",
      docType: "plan",
    };
    const signals: DetectionSignals = {
      statusMarkers: { status: null, confidence: 0, evidence: [] },
      crossReferences: [],
      gitCorrelation: { lastModified: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), referencedFilesExist: false, recentCommits: false },
      staleness: { ageInDays: 100, referencedByOtherDocs: false, recentCommits: false },
    };
    const classification = classifyDocument(doc, signals);
    expect(classification.status).toBe("stale");
    expect(classification.docType).toBe("plan");
  });

  it("returns high confidence when multiple signals agree", () => {
    const doc: DocumentInfo = {
      path: "plans/plan.md",
      relativePath: "plans/plan.md",
      title: "Plan",
      content: "# Plan\n\n### 1.1\n- **Status:** Concluído\n",
      docType: "plan",
    };
    const signals: DetectionSignals = {
      statusMarkers: { status: "completed", confidence: 0.9, evidence: ["Status: Concluído"] },
      crossReferences: [{ target: "src/feature.ts", exists: true }],
      gitCorrelation: { lastModified: new Date().toISOString(), referencedFilesExist: true, recentCommits: true },
      staleness: { ageInDays: 5, referencedByOtherDocs: true, recentCommits: true },
    };
    const classification = classifyDocument(doc, signals);
    expect(classification.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

describe("auditDocLifecycle", () => {
  it("returns empty report for empty project", () => {
    const report = auditDocLifecycle(tempDir, shitennoDir);
    expect(report.totalPlans).toBe(0);
    expect(report.totalAdrs).toBe(0);
    expect(report.classifications).toHaveLength(0);
    expect(report.proposedMoves).toHaveLength(0);
  });

  it("classifies plans correctly", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );
    writeFileSync(
      join(shitennoDir, "plans", "pending-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Pendente\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    expect(report.totalPlans).toBe(2);
    expect(report.totalAdrs).toBe(0);

    const completed = report.classifications.find(
      (c) => c.status === "completed" && c.docType === "plan"
    );
    expect(completed).toBeDefined();

    const planned = report.classifications.find(
      (c) => c.status === "planned" && c.docType === "plan"
    );
    expect(planned).toBeDefined();
  });

  it("classifies ADRs correctly", () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "docs", "adrs", "ADR-001.md"),
      "# ADR-001: Use PostgreSQL\n\n**Status:** Accepted\n"
    );
    writeFileSync(
      join(shitennoDir, "docs", "adrs", "ADR-002.md"),
      "# ADR-002: Use MySQL\n\n**Status:** Proposed\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    expect(report.totalPlans).toBe(0);
    expect(report.totalAdrs).toBe(2);

    const accepted = report.classifications.find(
      (c) => c.status === "completed" && c.docType === "adr"
    );
    expect(accepted).toBeDefined();

    const proposed = report.classifications.find(
      (c) => c.status === "planned" && c.docType === "adr"
    );
    expect(proposed).toBeDefined();
  });

  it("detects superseded ADRs via keyword detection", () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "docs", "adrs", "ADR-001.md"),
      "# ADR-001: Use PostgreSQL\n\nThis is the old decision.\n"
    );
    writeFileSync(
      join(shitennoDir, "docs", "adrs", "ADR-002.md"),
      "# ADR-002: Use MySQL\n\nThis supersedes ADR-001.\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    expect(report.totalAdrs).toBe(2);

    const superseded = report.classifications.find(
      (c) => c.status === "superseded" && c.docType === "adr"
    );
    expect(superseded).toBeDefined();
  });

  it("proposes correct moves for each status", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );
    writeFileSync(
      join(shitennoDir, "plans", "old-plan.md"),
      "# Old Plan\n\nSome content without status.\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    expect(report.proposedMoves.length).toBeGreaterThanOrEqual(1);

    const completedMove = report.proposedMoves.find(
      (m) => m.status === "completed" && m.docType === "plan"
    );
    expect(completedMove).toBeDefined();
    expect(completedMove!.destination).toContain("_archive/completed");
  });

  it("does not scan skills or governance directories", () => {
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "docs", "skills", "tdd.md"),
      "# TDD Workflow\n\n**Status:** Concluído\n"
    );
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\n\n**Status:** Concluído\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    // Should not include skills or governance docs
    expect(report.classifications.length).toBe(0);
  });
});

describe("applyMoves", () => {
  it("moves files to correct destinations", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "_archive", "completed"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    const result = applyMoves(report, shitennoDir, false);

    expect(result.movesApplied).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(shitennoDir, "docs", "_archive", "completed", "completed-plan.md"))).toBe(true);
  });

  it("creates destination directories if needed", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    const result = applyMoves(report, shitennoDir, false);

    expect(result.movesApplied).toBeGreaterThanOrEqual(1);
    expect(existsSync(join(shitennoDir, "docs", "_archive", "completed"))).toBe(true);
  });

  it("writes CHANGELOG entry for each move", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs", "_archive"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    applyMoves(report, shitennoDir, false);

    const changelogPath = join(shitennoDir, "docs", "_archive", "CHANGELOG.md");
    expect(existsSync(changelogPath)).toBe(true);

    const changelog = readFileSync(changelogPath, "utf-8");
    expect(changelog).toContain("completed-plan.md");
    expect(changelog).toContain("plan");
  });

  it("does not move files when dry-run mode", () => {
    mkdirSync(join(shitennoDir, "plans"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "plans", "completed-plan.md"),
      "# Plan\n\n### 1.1\n- **Status:** Concluído\n"
    );

    const report = auditDocLifecycle(tempDir, shitennoDir);
    const result = applyMoves(report, shitennoDir, true);

    expect(result.movesApplied).toBe(0);
    expect(existsSync(join(shitennoDir, "plans", "completed-plan.md"))).toBe(true);
  });
});
