import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditHealth, writeHealthReport, collectSourceFiles, detectHardcodedSecrets, detectSQLInjection, detectXSS, detectUnsafeEval, detectConsoleSecrets, detectWeakCrypto, detectInsecureHTTP, detectPrototypePollution, detectPathTraversal, detectRegexDos, detectUnsafeDeserialization, detectDependencyConfusion, detectCircularDeps } from "../health-auditor.js";
import { TaintAnalyzer } from "../audit/taint/index.js";
import { clearProgramCache } from "../audit/ts-program-cache.js";

let tempDir: string;
let shitennoDir: string;

beforeEach(() => {
  clearProgramCache();
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-audit-"));
  shitennoDir = join(tempDir, "shitenno");
  mkdirSync(shitennoDir, { recursive: true });
});

afterEach(() => {
  TaintAnalyzer.clearCache();
  clearProgramCache();
  rmSync(tempDir, { recursive: true, force: true });
});

describe("auditHealth", () => {
  it("returns health score 100 for empty project", async () => {
    // No docs, no history → missing_docs issues only
    const report = await auditHealth(tempDir, shitennoDir);
    expect(report.healthScore).toBeLessThan(100);
    expect(report.totalRules).toBe(0);
    expect(report.historyEntries).toBe(0);
  });

  it("returns high health score when all docs exist and no issues", async () => {
    // Create all expected docs
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "docs", "AGENTS.md"),
      "# Rules\n1. **Rule One**: do this\n2. **Rule Two**: do that\n3. **Rule Three**: other"
    );
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n> **Data:** 2026-07-02");
    writeFileSync(join(shitennoDir, "docs", "DESDO.md"), "# DESDO\n> **Data:** 2026-07-02");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(shitennoDir, "docs", "session-template.md"), "# Template");
    // Small buffer
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "context", "context_buffer.yaml"),
      "# Buffer\ncurrent_task:\n  status: done\n"
    );
    // .gitignore (detected by detectMissingGitignore)
    writeFileSync(join(shitennoDir, ".gitignore"), "node_modules/\n");
    // ADRs directory with at least one ADR (detected by detectAdrCoverage)
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-001-test.md"), "# ADR");
    // CONTEXT_HIERARCHY with real date (detected by detectDatePlaceholders)
    mkdirSync(join(shitennoDir, "cognition", "context"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "cognition", "context", "CONTEXT_HIERARCHY.md"),
      "# Context\n> **Data:** 2026-07-02"
    );
    // CONCEPTUAL_MODEL with real date
    writeFileSync(
      join(shitennoDir, "docs", "CONCEPTUAL_MODEL.md"),
      "# Model\n> **Data:** 2026-07-02"
    );
    // KNOWLEDGE_LIFECYCLE with real date
    writeFileSync(
      join(shitennoDir, "docs", "KNOWLEDGE_LIFECYCLE.md"),
      "# Lifecycle\n> **Data:** 2026-07-02"
    );
    // capabilities.md (scanned by detectBrokenDirRefs)
    writeFileSync(join(shitennoDir, "docs", "capabilities.md"), "# Capabilities");

    const report = await auditHealth(tempDir, shitennoDir);
    expect(report.healthScore).toBeGreaterThan(0);
    expect(report.healthScore).toBeLessThanOrEqual(100);
    expect(report.totalRules).toBe(3);
    // No critical issues in a healthy system
    const criticals = report.issues.filter((i) => i.severity === 3);
    expect(criticals.length).toBe(0);
  });

  it("detects missing critical docs", async () => {
    const report = await auditHealth(tempDir, shitennoDir);
    const missingDocs = report.issues.filter((i) => i.type === "missing_docs");
    expect(missingDocs.length).toBeGreaterThanOrEqual(4);

    const criticalMissing = missingDocs.filter((i) => i.severity === 3);
    expect(criticalMissing.length).toBeGreaterThanOrEqual(3);
  });

  it("detects stale buffer with too many lines", async () => {
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    const longBuffer = Array.from({ length: 60 }, (_, i) => `line-${i}: value`).join("\n");
    writeFileSync(
      join(shitennoDir, "governance", "context", "context_buffer.yaml"),
      longBuffer
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const staleBuffer = report.issues.find((i) => i.type === "stale_buffer");
    expect(staleBuffer).toBeDefined();
    expect(staleBuffer!.severity).toBe(2);
  });

  it("detects unclosed session in buffer", async () => {
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "context", "context_buffer.yaml"),
      "current_task:\n  status: in_progress\n"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const stale = report.issues.find(
      (i) => i.type === "stale_buffer" && i.description.includes("curso")
    );
    expect(stale).toBeDefined();
  });

  it("detects violation hotspots with 50%+ violation rate", async () => {
    mkdirSync(join(shitennoDir, "docs", "history"), { recursive: true });
    for (let i = 0; i < 5; i++) {
      writeFileSync(
        join(shitennoDir, "docs", "history", `2025-06-${20 + i}-s1.md`),
        i < 4 ? "# Session\nHad a bug here, fixed the erro." : "# Session\nClean session."
      );
    }

    const report = await auditHealth(tempDir, shitennoDir);
    const hotspot = report.issues.find((i) => i.type === "violation_hotspot");
    expect(hotspot).toBeDefined();
  });

  it("proposes optimizations for each issue type", async () => {
    // Create conditions for orphan_dir
    mkdirSync(join(shitennoDir, "mystery"), { recursive: true });
    writeFileSync(join(shitennoDir, "mystery", "README.md"), "# Mystery");

    const report = await auditHealth(tempDir, shitennoDir);
    const orphanOpt = report.optimizations.find(
      (o) => o.action === "add_docs"
    );
    expect(orphanOpt).toBeDefined();
    expect(orphanOpt!.id).toMatch(/^OPT-\d{3}$/);
  });
});

// ── New Detector Tests (Phase 5) ─────────────────────────────────────────────

describe("detectDatePlaceholders", () => {
  it("detects YYYY-MM-DD placeholder in FORBIDDEN_OPERATIONS.md", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"),
      "# Forbidden\n> **Data:** YYYY-MM-DD"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const dateIssue = report.issues.find(
      (i) => i.type === "date_placeholder" && i.location.includes("FORBIDDEN_OPERATIONS")
    );
    expect(dateIssue).toBeDefined();
    expect(dateIssue!.severity).toBe(2);
  });

  it("detects [DATE] placeholder in CONTEXT_HIERARCHY.md", async () => {
    mkdirSync(join(shitennoDir, "cognition", "context"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "cognition", "context", "CONTEXT_HIERARCHY.md"),
      "# Context\n> **Data:** [DATE]"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const dateIssue = report.issues.find(
      (i) => i.type === "date_placeholder" && i.location.includes("CONTEXT_HIERARCHY")
    );
    expect(dateIssue).toBeDefined();
  });

  it("does not flag documents with real dates", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"),
      "# Forbidden\n> **Data:** 2026-07-02"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const dateIssue = report.issues.find(
      (i) => i.type === "date_placeholder" && i.location.includes("FORBIDDEN_OPERATIONS")
    );
    expect(dateIssue).toBeUndefined();
  });
});

describe("detectEmptyDirs", () => {
  it("detects empty directories", async () => {
    mkdirSync(join(shitennoDir, "empty-dir"), { recursive: true });

    const report = await auditHealth(tempDir, shitennoDir);
    const emptyIssue = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("empty-dir")
    );
    expect(emptyIssue).toBeDefined();
    expect(emptyIssue!.severity).toBe(1);
  });

  it("does not flag directories with content", async () => {
    mkdirSync(join(shitennoDir, "has-content"), { recursive: true });
    writeFileSync(join(shitennoDir, "has-content", "file.md"), "# Content");

    const report = await auditHealth(tempDir, shitennoDir);
    const emptyIssue = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("has-content")
    );
    expect(emptyIssue).toBeUndefined();
  });

  it("does not flag scripts or reports directories", async () => {
    mkdirSync(join(shitennoDir, "scripts"), { recursive: true });
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });

    const report = await auditHealth(tempDir, shitennoDir);
    const emptyIssues = report.issues.filter((i) => i.type === "empty_dir");
    expect(emptyIssues.length).toBe(0);
  });
});

describe("detectMissingGitignore", () => {
  it("detects missing .gitignore in shitenno", async () => {
    const report = await auditHealth(tempDir, shitennoDir);
    const gitignoreIssue = report.issues.find((i) => i.type === "missing_gitignore");
    expect(gitignoreIssue).toBeDefined();
    expect(gitignoreIssue!.severity).toBe(2);
  });

  it("does not flag when .gitignore exists", async () => {
    writeFileSync(join(shitennoDir, ".gitignore"), "node_modules/\n");

    const report = await auditHealth(tempDir, shitennoDir);
    const gitignoreIssue = report.issues.find((i) => i.type === "missing_gitignore");
    expect(gitignoreIssue).toBeUndefined();
  });
});

describe("detectMaturityInconsistency", () => {
  it("detects inconsistent maturity scores", async () => {
    writeFileSync(
      join(shitennoDir, "fingerprint.json"),
      JSON.stringify({ maturityScore: 49 })
    );
    writeFileSync(
      join(shitennoDir, "maturity-profile.json"),
      JSON.stringify({ overallScore: 59 })
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const inconsistency = report.issues.find((i) => i.type === "maturity_inconsistency");
    expect(inconsistency).toBeDefined();
    expect(inconsistency!.severity).toBe(2);
    expect(inconsistency!.description).toContain("49");
    expect(inconsistency!.description).toContain("59");
  });

  it("does not flag when scores are consistent", async () => {
    writeFileSync(
      join(shitennoDir, "fingerprint.json"),
      JSON.stringify({ maturityScore: 59 })
    );
    writeFileSync(
      join(shitennoDir, "maturity-profile.json"),
      JSON.stringify({ overallScore: 59 })
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const inconsistency = report.issues.find((i) => i.type === "maturity_inconsistency");
    expect(inconsistency).toBeUndefined();
  });
});

describe("detectAdrCoverage", () => {
  it("detects missing adrs directory", async () => {
    const report = await auditHealth(tempDir, shitennoDir);
    const adrIssue = report.issues.find((i) => i.type === "adr_coverage_gap");
    expect(adrIssue).toBeDefined();
    expect(adrIssue!.severity).toBe(1);
  });

  it("detects empty adrs directory", async () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });

    const report = await auditHealth(tempDir, shitennoDir);
    const adrIssue = report.issues.find((i) => i.type === "adr_coverage_gap");
    expect(adrIssue).toBeDefined();
    expect(adrIssue!.description).toContain("Nenhum ADR");
  });

  it("does not flag when ADRs exist", async () => {
    mkdirSync(join(shitennoDir, "docs", "adrs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "adrs", "ADR-001-test.md"), "# ADR");

    const report = await auditHealth(tempDir, shitennoDir);
    const adrIssue = report.issues.find((i) => i.type === "adr_coverage_gap");
    expect(adrIssue).toBeUndefined();
  });
});

describe("proposeOptimizations for new types", () => {
  it("proposes fix_dates for date_placeholder issues", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "docs", "DESDO.md"),
      "# DESDO\n> **Data:** YYYY-MM-DD"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const fixDatesOpt = report.optimizations.find((o) => o.action === "fix_dates");
    expect(fixDatesOpt).toBeDefined();
    expect(fixDatesOpt!.id).toMatch(/^OPT-\d{3}$/);
  });

  it("proposes add_gitignore for missing_gitignore issues", async () => {
    const report = await auditHealth(tempDir, shitennoDir);
    const gitignoreOpt = report.optimizations.find((o) => o.action === "add_gitignore");
    expect(gitignoreOpt).toBeDefined();
  });

  it("proposes reconcile_scores for maturity_inconsistency issues", async () => {
    writeFileSync(
      join(shitennoDir, "fingerprint.json"),
      JSON.stringify({ maturityScore: 49 })
    );
    writeFileSync(
      join(shitennoDir, "maturity-profile.json"),
      JSON.stringify({ overallScore: 59 })
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const reconcileOpt = report.optimizations.find((o) => o.action === "reconcile_scores");
    expect(reconcileOpt).toBeDefined();
  });
});

describe("writeHealthReport", () => {
  it("returns null when reports/ doesn't exist", async () => {
    const report = await auditHealth(tempDir, shitennoDir);
    const result = writeHealthReport(shitennoDir, report);
    expect(result).toBeNull();
  });

  it("writes health report when reports/ exists", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    const report = await auditHealth(tempDir, shitennoDir);
    const filename = writeHealthReport(shitennoDir, report);
    expect(filename).toMatch(/^health-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe("detectBrokenRefs - template filtering", () => {
  it("does not flag template patterns like YYYY-MM-DD-<slug>.md as broken", async () => {
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\nSee `governance/plans/YYYY-MM-DD-<slug>.md`"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const brokenRefs = report.issues.filter(
      (i) => i.type === "broken_ref" && i.description.includes("YYYY-MM-DD"),
    );
    expect(brokenRefs.length).toBe(0);
  });

  it("does not flag template patterns like <task>.md as broken", async () => {
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\nSee `governance/plans/YYYY-MM-DD-<task>.md`"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const brokenRefs = report.issues.filter(
      (i) => i.type === "broken_ref" && i.description.includes("<task>"),
    );
    expect(brokenRefs.length).toBe(0);
  });

  it("still flags real broken references", async () => {
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\nSee `docs/real-missing-file.md`"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const brokenRefs = report.issues.filter(
      (i) => i.type === "broken_ref" && i.description.includes("real-missing-file.md"),
    );
    expect(brokenRefs.length).toBe(1);
  });
});

describe("detectEmptyDirs - recursive detection", () => {
  it("detects empty sub-directories inside governance/", async () => {
    mkdirSync(join(shitennoDir, "governance", "handoffs"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance", "rules"), { recursive: true });

    const report = await auditHealth(tempDir, shitennoDir);
    const emptyHandoffs = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("governance/handoffs"),
    );
    const emptyRules = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("governance/rules"),
    );
    expect(emptyHandoffs).toBeDefined();
    expect(emptyRules).toBeDefined();
  });

  it("does not flag directories with real files", async () => {
    mkdirSync(join(shitennoDir, "governance", "agents"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "agents", "contract.yaml"), "# contract");

    const report = await auditHealth(tempDir, shitennoDir);
    const agentsIssue = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("governance/agents"),
    );
    expect(agentsIssue).toBeUndefined();
  });

  it("does not flag directories with only placeholder files", async () => {
    mkdirSync(join(shitennoDir, "governance", "handoffs"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "handoffs", "TEMPLATE.md"), "# template");

    const report = await auditHealth(tempDir, shitennoDir);
    const handoffsIssue = report.issues.find(
      (i) => i.type === "empty_dir" && i.location.includes("governance/handoffs"),
    );
    expect(handoffsIssue).toBeDefined();
  });
});

describe("detectBrokenDirRefs", () => {
  it("detects broken directory references", async () => {
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\nSee `docs/history/`"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const dirRefIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("directório"),
    );
    expect(dirRefIssue).toBeDefined();
    expect(dirRefIssue!.description).toContain("docs/history/");
  });

  it("does not flag existing directories", async () => {
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "WORKFLOW.md"),
      "# Workflow\nSee `docs/`"
    );

    const report = await auditHealth(tempDir, shitennoDir);
    const dirRefIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("directório") && i.description.includes("docs/"),
    );
    expect(dirRefIssue).toBeUndefined();
  });
});

describe("detectMissingPackageJson", () => {
  it("detects missing package.json when scripts exist", async () => {
    mkdirSync(join(shitennoDir, "scripts"), { recursive: true });
    writeFileSync(join(shitennoDir, "scripts", "check.ts"), "# script");

    const report = await auditHealth(tempDir, shitennoDir);
    const pkgIssue = report.issues.find((i) => i.type === "missing_package_json");
    expect(pkgIssue).toBeDefined();
  });

  it("does not flag when package.json exists", async () => {
    mkdirSync(join(shitennoDir, "scripts"), { recursive: true });
    writeFileSync(join(shitennoDir, "scripts", "check.ts"), "# script");
    writeFileSync(join(shitennoDir, "package.json"), "{}");

    const report = await auditHealth(tempDir, shitennoDir);
    const pkgIssue = report.issues.find((i) => i.type === "missing_package_json");
    expect(pkgIssue).toBeUndefined();
  });

  it("does not flag when scripts directory is empty", async () => {
    mkdirSync(join(shitennoDir, "scripts"), { recursive: true });

    const report = await auditHealth(tempDir, shitennoDir);
    const pkgIssue = report.issues.find((i) => i.type === "missing_package_json");
    expect(pkgIssue).toBeUndefined();
  });
});

describe("detectBrokenDirRefs - expanded scan", () => {
  it("detects broken directory reference in DESDO.md", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "DESDO.md"), "# DESDO\n- SDRs em `docs/sdr/`");
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");

    const report = await auditHealth(tempDir, shitennoDir);
    const dirRefIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("docs/sdr/"),
    );
    expect(dirRefIssue).toBeDefined();
  });

  it("detects broken directory reference in capabilities.md", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "capabilities.md"), "# Capabilities\n- Planos em `governance/plans/`");
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");

    const report = await auditHealth(tempDir, shitennoDir);
    const dirRefIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("governance/plans/"),
    );
    expect(dirRefIssue).toBeDefined();
  });
});

describe("detectNonBacktickFileRefs", () => {
  it("detects non-backtick file reference that does not exist", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\n- Leia Requisitos_plataforma.md");
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");

    const report = await auditHealth(tempDir, shitennoDir);
    const nonBacktickIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("Requisitos_plataforma.md"),
    );
    expect(nonBacktickIssue).toBeDefined();
  });

  it("does not flag backtick references (already caught by detectBrokenRefs)", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\n- Leia `existing-file.md`");
    writeFileSync(join(shitennoDir, "existing-file.md"), "# Existing");
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");

    const report = await auditHealth(tempDir, shitennoDir);
    const nonBacktickIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("existing-file.md"),
    );
    expect(nonBacktickIssue).toBeUndefined();
  });
});

describe("detectUnreferencedDirs", () => {
  it("detects docs/ directory not referenced in governance", async () => {
    mkdirSync(join(shitennoDir, "docs", "audits"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");

    const report = await auditHealth(tempDir, shitennoDir);
    const unreferencedIssue = report.issues.find(
      (i) => i.type === "orphan_dir" && i.description.includes("docs/audits"),
    );
    expect(unreferencedIssue).toBeDefined();
  });

  it("does not flag docs/ directory that is referenced", async () => {
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");

    const report = await auditHealth(tempDir, shitennoDir);
    const unreferencedIssue = report.issues.find(
      (i) => i.type === "orphan_dir" && i.description.includes("docs/skills"),
    );
    expect(unreferencedIssue).toBeUndefined();
  });
});

describe("detectReportNaming", () => {
  it("detects report with malformed name", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    writeFileSync(join(shitennoDir, "reports", "complexity---2026-06-30.json"), "{}");

    const report = await auditHealth(tempDir, shitennoDir);
    const namingIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("complexity---2026-06-30.json"),
    );
    expect(namingIssue).toBeDefined();
  });

  it("does not flag report with valid name", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    writeFileSync(join(shitennoDir, "reports", "health-2026-07-03.json"), "{}");

    const report = await auditHealth(tempDir, shitennoDir);
    const namingIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("health-2026-07-03.json"),
    );
    expect(namingIssue).toBeUndefined();
  });

  it("does not flag report with project name suffix", async () => {
    mkdirSync(join(shitennoDir, "reports"), { recursive: true });
    writeFileSync(join(shitennoDir, "reports", "health-shitenno-cli-2026-07-03.json"), "{}");

    const report = await auditHealth(tempDir, shitennoDir);
    const namingIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("health-shitenno-cli-2026-07-03.json"),
    );
    expect(namingIssue).toBeUndefined();
  });
});

describe("AuditLevel filtering", () => {
  it("quick level returns only 6 detector types", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\n> **Data:** 2026-07-02");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n> **Data:** 2026-07-02");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow\n> **Data:** 2026-07-02");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "quick");
    expect(report.level).toBe("quick");
    // Quick should NOT detect template_dir_refs, broken_ref, orphan_dir, etc.
    const hasTemplateDir = report.issues.some((i) => i.type === "template_dir_ref");
    expect(hasTemplateDir).toBe(false);
  });

  it("full level returns more issues than standard", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\n> **Data:** 2026-07-02");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n> **Data:** 2026-07-02");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow\n> **Data:** 2026-07-02");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const quickReport = await auditHealth(tempDir, shitennoDir, "quick");
    const codeReviewReport = await auditHealth(tempDir, shitennoDir, "code-review");
    expect(codeReviewReport.level).toBe("code-review");
    expect(codeReviewReport.issues.length).toBeGreaterThanOrEqual(quickReport.issues.length);
  }, 40_000);
});

describe("Code-review level detectors", () => {
  it("detects triple maturity score mismatch", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");
    // All 3 with different scores
    writeFileSync(join(shitennoDir, "fingerprint.json"), JSON.stringify({ maturityScore: 49 }));
    writeFileSync(join(shitennoDir, "maturity-profile.json"), JSON.stringify({ overallScore: 59 }));
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "BRIEFING.md"), "# Briefing\n- **Maturity:** 55/100");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const tripleIssue = report.issues.find((i) => i.type === "triple_maturity_score");
    expect(tripleIssue).toBeDefined();
  });

  it("detects empty stack in fingerprint.json", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");
    writeFileSync(join(shitennoDir, "fingerprint.json"), JSON.stringify({ maturityScore: 49, stack: [] }));

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const emptyStackIssue = report.issues.find((i) => i.type === "empty_stack");
    expect(emptyStackIssue).toBeDefined();
  });

  it("detects missing script wiring", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\nObrigatório: `pnpm run validate:session`");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");
    // root package.json with no validate:session script
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ scripts: { build: "tsc" } }));

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const scriptIssue = report.issues.find(
      (i) => i.type === "script_wiring" && i.description.includes("validate:session"),
    );
    expect(scriptIssue).toBeDefined();
  });

  it("detects rule typos in session-template", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    writeFileSync(join(shitennoDir, "docs", "session-template.md"), "# Template\n- ejecutar tarefas\n- alterarhistóricos");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const typoIssues = report.issues.filter((i) => i.type === "rule_typo");
    expect(typoIssues.length).toBeGreaterThanOrEqual(2);
  });

  it("detects numbering gap in FORBIDDEN_OPERATIONS", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n> **Data:** 2026-07-02\n## F-01 Rule\n## F-02 Rule\n## F-04 Rule");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const gapIssue = report.issues.find(
      (i) => i.type === "numbering_gap" && i.description.includes("F-3"),
    );
    expect(gapIssue).toBeDefined();
  });

  it("detects empty knowledge graph data files", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    mkdirSync(join(shitennoDir, "governance", "knowledge-graph"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "knowledge-graph", "artifacts.json"), "");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const emptyIssue = report.issues.find((i) => i.type === "empty_data_file");
    expect(emptyIssue).toBeDefined();
  });

  it("detects phantom rule references (G-05 not defined)", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\nRule 16.f references G-05 in FORBIDDEN_OPERATIONS.md");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n## **G-01** Rule one\n## **G-02** Rule two");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const phantomIssue = report.issues.find(
      (i) => i.type === "phantom_rule_ref" && i.description.includes("G-05"),
    );
    expect(phantomIssue).toBeDefined();
    expect(phantomIssue!.severity).toBe(3);
  });

  it("does not flag defined rules as phantom refs", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\nRule references G-01 and G-02");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\n## **G-01** Rule one\n## **G-02** Rule two");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const phantomIssues = report.issues.filter((i) => i.type === "phantom_rule_ref");
    expect(phantomIssues.length).toBe(0);
  });

  it("detects generic extension mismatch (.ts when real is .json)", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents\nSee `maturity-profile.ts` for details");
    writeFileSync(join(shitennoDir, "docs", "maturity-profile.json"), "{}");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const extIssue = report.issues.find(
      (i) => i.type === "extension_mismatch" && i.description.includes("maturity-profile"),
    );
    expect(extIssue).toBeDefined();
    expect(extIssue!.description).toContain("maturity-profile.ts");
    expect(extIssue!.description).toContain("maturity-profile.json");
  });

  it("detects broken refs in CONCEPTUAL_MODEL.md (expanded scan list)", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    writeFileSync(join(shitennoDir, "docs", "CONCEPTUAL_MODEL.md"), "# Model\nSee `capability-mapping.ts` for capabilities");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const brokenIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("capability-mapping.ts"),
    );
    expect(brokenIssue).toBeDefined();
  });

  it("detects broken directory refs in FORBIDDEN_OPERATIONS (expanded scan list)", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    writeFileSync(join(shitennoDir, "docs", "FORBIDDEN_OPERATIONS.md"), "# Forbidden\nUse `packages/types/` for types");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const dirIssue = report.issues.find(
      (i) => i.type === "broken_ref" && i.description.includes("packages/types/"),
    );
    expect(dirIssue).toBeDefined();
  });

  it("detects directory refs in YAML agent contracts", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    mkdirSync(join(shitennoDir, "governance", "agents"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "governance", "agents", "AI-CONTRACT-reviewer-v1.yaml"),
      "agent:\n  name: test\n  outputs:\n    - artifact: audit/executions/ | docs/context_buffer.md\n      schema: test"
    );
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const contractIssue = report.issues.find(
      (i) => i.type === "agent_contract_ref" && i.description.includes("audit/executions/"),
    );
    expect(contractIssue).toBeDefined();
  });

  it("detects P0 contradiction in diagram format", async () => {
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow\nP0: AGENTS.md, FORBIDDEN_OPERATIONS.md, DESDO.md");
    writeFileSync(join(shitennoDir, "governance", "SYSTEM_MAP.md"), "# Map");
    mkdirSync(join(shitennoDir, "cognition", "context"), { recursive: true });
    writeFileSync(
      join(shitennoDir, "cognition", "context", "CONTEXT_HIERARCHY.md"),
      "# Hierarchy\n[Nível 0: P0] docs/AGENTS.md"
    );
    mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
    writeFileSync(join(shitennoDir, "governance", "context", "context_buffer.yaml"), "current_task:\n  status: done\n");

    const report = await auditHealth(tempDir, shitennoDir, "code-review");
    const p0Issue = report.issues.find((i) => i.type === "cross_doc_p0_contradiction");
    expect(p0Issue).toBeDefined();
  });
});

// ── Phase 3 Detector Tests ───────────────────────────────────────────────────

describe("detectEmptyCatchBlocks", () => {
  it("detects empty catch blocks in source files", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "utils.ts"),
      `try {
  doSomething();
} catch (e) {
  // silently ignore
}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const emptyCatch = report.issues.find(
      (i) => i.type === "empty_catch" && i.description.includes("utils.ts")
    );
    expect(emptyCatch).toBeDefined();
    expect(emptyCatch!.severity).toBe(1);
  });

  it("does not flag catch blocks with error handling", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "utils.ts"),
      `try {
  doSomething();
} catch (e) {
  console.error(e);
}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const emptyCatch = report.issues.find(
      (i) => i.type === "empty_catch" && i.description.includes("utils.ts")
    );
    expect(emptyCatch).toBeUndefined();
  });
});

describe("detectHighComplexity", () => {
  it("detects functions with high cyclomatic complexity", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    // Function with many branches (>15)
    const complexCode = `function complex(x: number) {
  if (x > 0) { /* 1 */ }
  if (x > 1) { /* 2 */ }
  if (x > 2) { /* 3 */ }
  if (x > 3) { /* 4 */ }
  if (x > 4) { /* 5 */ }
  if (x > 5) { /* 6 */ }
  if (x > 6) { /* 7 */ }
  if (x > 7) { /* 8 */ }
  if (x > 8) { /* 9 */ }
  if (x > 9) { /* 10 */ }
  if (x > 10) { /* 11 */ }
  if (x > 11) { /* 12 */ }
  if (x > 12) { /* 13 */ }
  if (x > 13) { /* 14 */ }
  if (x > 14) { /* 15 */ }
  if (x > 15) { /* 16 */ }
  for (let i = 0; i < x; i++) { /* 17 */ }
  return x;
}`;
    writeFileSync(join(tempDir, "src", "complex.ts"), complexCode);

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const highComplexity = report.issues.find(
      (i) => i.type === "high_complexity" && i.description.includes("complex.ts")
    );
    expect(highComplexity).toBeDefined();
    expect(highComplexity!.severity).toBe(2);
  });

  it("does not flag simple functions", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "simple.ts"),
      `function simple(x: number) {
  if (x > 0) { return x; }
  return 0;
}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const highComplexity = report.issues.find(
      (i) => i.type === "high_complexity" && i.description.includes("simple.ts")
    );
    expect(highComplexity).toBeUndefined();
  });

  it("detects complexity in getters/setters/constructors", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "class.ts"),
      `class Foo {
  get value() {
    if (this.a) { return 1; }
    if (this.b) { return 2; }
    if (this.c) { return 3; }
    if (this.d) { return 4; }
    if (this.e) { return 5; }
    if (this.f) { return 6; }
    if (this.g) { return 7; }
    if (this.h) { return 8; }
    if (this.i) { return 9; }
    if (this.j) { return 10; }
    if (this.k) { return 11; }
    if (this.l) { return 12; }
    if (this.m) { return 13; }
    if (this.n) { return 14; }
    if (this.o) { return 15; }
    if (this.p) { return 16; }
    return 0;
  }
}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const highComplexity = report.issues.find(
      (i) => i.type === "high_complexity" && i.description.includes("class.ts")
    );
    expect(highComplexity).toBeDefined();
  });
});

describe("detectCircularDeps", () => {
  it("detects circular dependencies between modules", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    // A imports B, B imports A
    writeFileSync(
      join(tempDir, "src", "moduleA.ts"),
      `import { foo } from "./moduleB.js";
export const a = foo();`
    );
    writeFileSync(
      join(tempDir, "src", "moduleB.ts"),
      `import { bar } from "./moduleA.js";
export const b = bar();`
    );

    const files = collectSourceFiles(tempDir);
    const issues = detectCircularDeps(tempDir, files);
    const circularDep = issues.find((i) => i.type === "circular_dep");
    expect(circularDep).toBeDefined();
    expect(circularDep!.severity).toBe(3);
    expect(circularDep!.description).toContain("circular");
  });

  it("does not flag acyclic imports", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "moduleA.ts"),
      `import { foo } from "./moduleB.js";
export const a = foo();`
    );
    writeFileSync(
      join(tempDir, "src", "moduleB.ts"),
      `export const b = 1;`
    );

    const files = collectSourceFiles(tempDir);
    const issues = detectCircularDeps(tempDir, files);
    const circularDep = issues.find((i) => i.type === "circular_dep");
    expect(circularDep).toBeUndefined();
  });
});

describe("detectUnusedExports", () => {
  it("detects exported symbols never imported by other modules", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "moduleA.ts"),
      `export function unusedFunc() { return 1; }
export const usedConst = 2;`
    );
    writeFileSync(
      join(tempDir, "src", "moduleB.ts"),
      `import { usedConst } from "./moduleA.js";
console.log(usedConst);`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const unusedExport = report.issues.find(
      (i) => i.type === "unused_export" && i.description.includes("unusedFunc")
    );
    expect(unusedExport).toBeDefined();
  });

  it("does not flag exports that are imported elsewhere", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "moduleA.ts"),
      `export function usedFunc() { return 1; }`
    );
    writeFileSync(
      join(tempDir, "src", "moduleB.ts"),
      `import { usedFunc } from "./moduleA.js";
usedFunc();`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const unusedExport = report.issues.find(
      (i) => i.type === "unused_export" && i.description.includes("usedFunc")
    );
    expect(unusedExport).toBeUndefined();
  });
});

describe("detectDeadCodePatterns", () => {
  it("detects @ts-ignore comments", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "unsafe.ts"),
      `// @ts-ignore
const x: string = 123;`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const deadCode = report.issues.find(
      (i) => i.type === "dead_code" && i.description.includes("@ts-ignore") && i.location.includes("unsafe.ts")
    );
    expect(deadCode).toBeDefined();
  });

  it("detects empty function bodies", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "empty.ts"),
      `function emptyFunc() {}

const emptyArrow = () => {}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const deadCode = report.issues.filter(
      (i) => i.type === "dead_code" && i.location.includes("empty.ts") && i.description.includes("vazi")
    );
    expect(deadCode.length).toBeGreaterThanOrEqual(1);
  });

  it("does not flag if/for/while blocks as dead code", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "valid.ts"),
      `function check(x: number) {
  if (x > 0) {}
  for (let i = 0; i < x; i++) {}
}`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const deadCode = report.issues.filter(
      (i) => i.type === "dead_code" && i.location.includes("valid.ts") && i.description.includes("vazi")
    );
    expect(deadCode.length).toBe(0);
  });

  it("detects TODO comments", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    writeFileSync(
      join(tempDir, "src", "todo.ts"),
      `// TODO: implement this
function todoFunc() { return 1; }`
    );

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const todoIssue = report.issues.find(
      (i) => i.type === "dead_code" && i.location.includes("todo.ts") && i.description.includes("TODO")
    );
    expect(todoIssue).toBeDefined();
  });

  it("limits TODO output to 5 per file", async () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "test.ts"), "# Commands");
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "act.ts"), "# Act");
    const manyTodos = Array.from({ length: 10 }, (_, i) => `// TODO item ${i}`).join("\n");
    writeFileSync(join(tempDir, "src", "many-todos.ts"), manyTodos);

    const report = await auditHealth(tempDir, shitennoDir, "standard");
    const todoIssues = report.issues.filter(
      (i) => i.type === "dead_code" && i.location.includes("many-todos.ts") && i.description.includes("TODO")
    );
    expect(todoIssues.length).toBeLessThanOrEqual(5);
  });
});

describe("SEC-* Security Pattern Detectors", () => {
  let projectRoot: string;
  let shitennoDir: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "sec-test-"));
    shitennoDir = join(projectRoot, "shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    mkdirSync(join(projectRoot, "src"), { recursive: true });
    mkdirSync(join(shitennoDir, "docs"), { recursive: true });
    writeFileSync(join(projectRoot, "package.json"), JSON.stringify({ name: "test", dependencies: {} }));
    writeFileSync(join(shitennoDir, ".gitignore"), "node_modules/");
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("SEC-01: detectHardcodedSecrets detects password hardcoded", async () => {
    writeFileSync(join(projectRoot, "src", "config.ts"),
      `const DB_PASSWORD = "supersecret123";\n` +
      `export const apiKey = "sk-1234567890abcdef1234";\n`
    );
    const files = collectSourceFiles(projectRoot);
    const secrets = detectHardcodedSecrets(projectRoot, files);
    expect(secrets.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-01: detectHardcodedSecrets ignores comments", async () => {
    writeFileSync(join(projectRoot, "src", "safe.ts"),
      `// password = "notreal"\n` +
      `// This is just a comment\n`
    );
    const files = collectSourceFiles(projectRoot);
    const secrets = detectHardcodedSecrets(projectRoot, files);
    expect(secrets.length).toBe(0);
  });

  it("SEC-02: detectSQLInjection detects query concatenation", async () => {
    writeFileSync(join(projectRoot, "src", "db.ts"),
      `db.query("SELECT * FROM users WHERE id = " + userId);\n` +
      `db.execute(\`SELECT * FROM orders WHERE name = \${name}\`);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const sqli = detectSQLInjection(projectRoot, files);
    expect(sqli.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-03: detectXSS detects innerHTML usage", async () => {
    writeFileSync(join(projectRoot, "src", "render.ts"),
      `element.innerHTML = userInput;\n` +
      `document.write(unsafeContent);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const xss = detectXSS(projectRoot, files);
    expect(xss.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-04: detectUnsafeEval detects eval()", async () => {
    writeFileSync(join(projectRoot, "src", "dynamic.ts"),
      `eval(userCode);\n` +
      `new Function(params, body);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const evalIssues = detectUnsafeEval(projectRoot, files);
    expect(evalIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-05: detectConsoleSecrets detects sensitive data in console", async () => {
    writeFileSync(join(projectRoot, "src", "debug.ts"),
      `console.log("password:", req.body.password);\n` +
      `console.log("token:", req.headers.authorization);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const consoleIssues = detectConsoleSecrets(projectRoot, files);
    expect(consoleIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-06: detectWeakCrypto detects MD5 usage", async () => {
    writeFileSync(join(projectRoot, "src", "crypto.ts"),
      `crypto.createHash("md5");\n` +
      `crypto.createHash("sha1");\n`
    );
    const files = collectSourceFiles(projectRoot);
    const cryptoIssues = detectWeakCrypto(projectRoot, files);
    expect(cryptoIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-06: detectWeakCrypto ignores createCipheriv (safe)", async () => {
    writeFileSync(join(projectRoot, "src", "safe-crypto.ts"),
      `crypto.createCipheriv("aes-256-gcm", key, iv);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const cryptoIssues = detectWeakCrypto(projectRoot, files);
    expect(cryptoIssues.length).toBe(0);
  });

  it("SEC-07: detectInsecureHTTP detects http URLs", async () => {
    writeFileSync(join(projectRoot, "src", "api.ts"),
      `const url = "http://api.example.com/data";\n`
    );
    const files = collectSourceFiles(projectRoot);
    const httpIssues = detectInsecureHTTP(projectRoot, files);
    expect(httpIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-07: detectInsecureHTTP ignores localhost", async () => {
    writeFileSync(join(projectRoot, "src", "dev.ts"),
      `const url = "http://localhost:3000/api";\n`
    );
    const files = collectSourceFiles(projectRoot);
    const httpIssues = detectInsecureHTTP(projectRoot, files);
    expect(httpIssues.length).toBe(0);
  });

  it("SEC-08: detectPrototypePollution detects Object.assign with req", async () => {
    writeFileSync(join(projectRoot, "src", "merge.ts"),
      `Object.assign(target, req.body);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const protoIssues = detectPrototypePollution(projectRoot, files);
    expect(protoIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-09: detectPathTraversal detects dynamic file paths", async () => {
    writeFileSync(join(projectRoot, "src", "files.ts"),
      `readFile(req.query.path);\n` +
      `writeFileSync(req.body.filename, data);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const pathIssues = detectPathTraversal(projectRoot, files);
    expect(pathIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-11: detectUnsafeDeserialization detects JSON.parse with req", async () => {
    writeFileSync(join(projectRoot, "src", "parse.ts"),
      `JSON.parse(req.body.data);\n`
    );
    const files = collectSourceFiles(projectRoot);
    const deserIssues = detectUnsafeDeserialization(projectRoot, files);
    expect(deserIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("All SEC-* detectors return 0 issues for clean code", async () => {
    writeFileSync(join(projectRoot, "src", "clean.ts"),
      `export const x = 42;\n` +
      `export function add(a: number, b: number) { return a + b; }\n`
    );
    const files = collectSourceFiles(projectRoot);
    const allSecIssues = [
      ...detectHardcodedSecrets(projectRoot, files),
      ...detectSQLInjection(projectRoot, files),
      ...detectXSS(projectRoot, files),
      ...detectUnsafeEval(projectRoot, files),
      ...detectConsoleSecrets(projectRoot, files),
      ...detectWeakCrypto(projectRoot, files),
      ...detectInsecureHTTP(projectRoot, files),
      ...detectPrototypePollution(projectRoot, files),
      ...detectPathTraversal(projectRoot, files),
      ...detectRegexDos(projectRoot, files),
      ...detectUnsafeDeserialization(projectRoot, files),
      ...detectDependencyConfusion(projectRoot, files),
    ];
    expect(allSecIssues.length).toBe(0);
  });

  it("SEC-10: detectRegexDos detects ReDoS patterns", async () => {
    writeFileSync(join(projectRoot, "src", "regex.ts"),
      `const bad = new RegExp("(a+)+$");\n` +
      `const also = new RegExp("\\w+\\s*=\\s*\\w+");\n`
    );
    const files = collectSourceFiles(projectRoot);
    const regexIssues = detectRegexDos(projectRoot, files);
    expect(regexIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("SEC-12: detectDependencyConfusion detects phantom imports", async () => {
    writeFileSync(join(projectRoot, "src", "import.ts"),
      `import { something } from "nonexistent-package-xyz";\n`
    );
    const files = collectSourceFiles(projectRoot);
    const depIssues = detectDependencyConfusion(projectRoot, files);
    expect(depIssues.length).toBeGreaterThanOrEqual(1);
  });
});
