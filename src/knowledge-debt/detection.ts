import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";
import type { KnowledgeGap } from "./types.js";

export function detectMissingAdrs(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const adrDir = join(shitennoDir, "docs", "adrs");
  const historyDir = join(shitennoDir, "docs", "history");

  if (!existsSync(historyDir)) return gaps;

  const historyFiles = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter(
        (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
      ).length
    : 0;

  if (historyFiles.length > 5 && adrCount < 2) {
    gaps.push({
      id: "DEBT-ADR-001",
      type: "adr_missing",
      severity: "high",
      description: `${historyFiles.length} session(s) in history but only ${adrCount} ADR(s) — decisions may not be documented`,
      location: "docs/adrs/",
      expectedArtifact: "ADR for each architectural decision",
      recommendation: "Review session history and create ADRs for key decisions",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

export function detectMissingRunbooks(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const runbooksDir = join(shitennoDir, "docs", "runbooks");
  const historyDir = join(shitennoDir, "docs", "history");

  if (!existsSync(historyDir)) return gaps;

  const historyFiles = readdirSync(historyDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("README")
  );

  let incidentCount = 0;
  for (const file of historyFiles) {
    try {
      const content = readFileSync(join(historyDir, file), "utf-8").toLowerCase();
      if (
        content.includes("erro") ||
        content.includes("bug") ||
        content.includes("falhou") ||
        content.includes("rollback") ||
        content.includes("incidente")
      ) {
        incidentCount++;
      }
    } catch {
      logger.debug("knowledge-debt", "Failed to read history file:", file);
    }
  }

  const runbookCount = existsSync(runbooksDir)
    ? readdirSync(runbooksDir).filter((f) => f.endsWith(".md")).length
    : 0;

  if (incidentCount > 2 && runbookCount === 0) {
    gaps.push({
      id: "DEBT-RB-001",
      type: "runbook_missing",
      severity: "medium",
      description: `${incidentCount} incident(s) in history but no runbooks — no operational procedures documented`,
      location: "docs/runbooks/",
      expectedArtifact: "Runbook for each recurring incident type",
      recommendation: "Create runbooks for the most common incident types",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

export function detectMissingSkills(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const skillsDir = join(shitennoDir, "docs", "skills");
  const adrDir = join(shitennoDir, "docs", "adrs");

  const skillCount = existsSync(skillsDir)
    ? readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length
    : 0;

  const adrCount = existsSync(adrDir)
    ? readdirSync(adrDir).filter(
        (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
      ).length
    : 0;

  if (adrCount > 3 && skillCount === 0) {
    gaps.push({
      id: "DEBT-SK-001",
      type: "skill_missing",
      severity: "medium",
      description: `${adrCount} ADR(s) exist but no skills — patterns not extracted for reuse`,
      location: "docs/skills/",
      expectedArtifact: "Skills extracted from ADR patterns",
      recommendation: "Extract reusable patterns from ADRs into skills",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

export function detectMissingDocs(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const expectedDocs = [
    { path: "docs/CONCEPTUAL_MODEL.md", critical: true },
    { path: "docs/KNOWLEDGE_LIFECYCLE.md", critical: true },
    { path: "governance/SYSTEM_MAP.md", critical: false },
    { path: "docs/session-template.md", critical: false },
  ];

  for (const doc of expectedDocs) {
    if (!existsSync(join(shitennoDir, doc.path))) {
      gaps.push({
        id: `DEBT-DOC-${doc.path.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase()}`,
        type: "docs_missing",
        severity: doc.critical ? "high" : "low",
        description: `Expected document "${doc.path}" not found`,
        location: `shitenno/${doc.path}`,
        expectedArtifact: doc.path,
        recommendation: `Create "${doc.path}" — ${doc.critical ? "critical" : "recommended"}`,
        detectedAt: now,
        addressed: false,
      });
    }
  }

  return gaps;
}

export function detectMissingAutomation(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const scriptsDir = join(shitennoDir, "scripts");

  const scriptCount = existsSync(scriptsDir)
    ? readdirSync(scriptsDir).filter(
        (f) => f.endsWith(".ts") || f.endsWith(".js")
      ).length
    : 0;

  if (scriptCount < 3) {
    gaps.push({
      id: "DEBT-AUTO-001",
      type: "automation_missing",
      severity: "low",
      description: `Only ${scriptCount} automation script(s) — many processes may still be manual`,
      location: "shitenno/scripts/",
      expectedArtifact: "Scripts for common operations",
      recommendation: "Identify repetitive processes and create automation scripts",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

export function detectMissingContracts(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const agentsDir = join(shitennoDir, "governance", "agents");
  const configPath = join(shitennoDir, "..", "opencode.json");

  if (!existsSync(configPath)) return gaps;

  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const agentCount = config.agent ? Object.keys(config.agent).length : 0;

    const contractCount = existsSync(agentsDir)
      ? readdirSync(agentsDir).filter(
          (f) => f.endsWith(".yaml") || f.endsWith(".yml")
        ).length
      : 0;

    if (agentCount > 0 && contractCount === 0) {
      gaps.push({
        id: "DEBT-CON-001",
        type: "contract_missing",
        severity: "medium",
        description: `${agentCount} agent(s) configured but no contracts — agent behavior undefined`,
        location: "shitenno/governance/agents/",
        expectedArtifact: "AI contract for each agent role",
        recommendation: "Create AI contracts defining responsibilities and constraints for each agent",
        detectedAt: now,
        addressed: false,
      });
    }
  } catch {
    logger.debug("knowledge-debt", "Failed to analyze AI contracts");
  }

  return gaps;
}

export function detectMissingWorkflows(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const workflowPath = join(shitennoDir, "governance", "WORKFLOW.md");

  if (!existsSync(workflowPath)) {
    gaps.push({
      id: "DEBT-WF-001",
      type: "workflow_missing",
      severity: "high",
      description: "No WORKFLOW.md found — session flow undefined",
      location: "shitenno/governance/WORKFLOW.md",
      expectedArtifact: "WORKFLOW.md defining session flow",
      recommendation: "Create WORKFLOW.md defining standard session procedures",
      detectedAt: now,
      addressed: false,
    });
  }

  return gaps;
}

export function detectStaleAdrs(shitennoDir: string, now: string): KnowledgeGap[] {
  const gaps: KnowledgeGap[] = [];
  const adrDir = join(shitennoDir, "docs", "adrs");

  if (!existsSync(adrDir)) return gaps;

  const files = readdirSync(adrDir).filter(
    (f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE")
  );

  for (const file of files) {
    try {
      const content = readFileSync(join(adrDir, file), "utf-8");
      if (content.includes("Estado: deprecated") || content.includes("Status: deprecated")) {
        gaps.push({
          id: `DEBT-ADR-STALE-${file.replace(".md", "")}`,
          type: "adr_stale",
          severity: "low",
          description: `ADR "${file}" is deprecated — may need superseding ADR`,
          location: `docs/adrs/${file}`,
          expectedArtifact: "New ADR superseding deprecated one",
          recommendation: "Create new ADR or remove deprecated one",
          detectedAt: now,
          addressed: false,
        });
      }
    } catch {
      logger.debug("knowledge-debt", "Failed to read ADR file:", file);
    }
  }

  return gaps;
}
