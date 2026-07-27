/**
 * state-manager/knowledge-reader.ts — Reads permanent knowledge state
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { KnowledgeState } from "./types.js";

function readAdrs(shitennoDir: string): KnowledgeState["adrs"] {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];
  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"));
  return files.map((file) => {
    const content = readFileSync(join(adrDir, file), "utf-8");
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/Estado:\s*(\w+)/i) || content.match(/Status:\s*(\w+)/i);
    return {
      id: file.replace(".md", ""),
      title: titleMatch?.[1] ?? file.replace(".md", ""),
      status: statusMatch?.[1] ?? "unknown",
      path: `docs/adrs/${file}`,
    };
  });
}

function readSkills(shitennoDir: string): KnowledgeState["skills"] {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: file.replace(".md", ""),
    name: file.replace(".md", "").replace(/_/g, " "),
    path: `docs/skills/${file}`,
  }));
}

function readContracts(shitennoDir: string): KnowledgeState["contracts"] {
  const contractsDir = join(shitennoDir, "governance", "agents");
  if (!existsSync(contractsDir)) return [];
  const files = readdirSync(contractsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  return files.map((file) => {
    const content = readFileSync(join(contractsDir, file), "utf-8");
    const nameMatch = content.match(/name:\s*(.+)/);
    const roleMatch = content.match(/agent:\s*(.+)/);
    return {
      id: file.replace(/\.(yaml|yml)$/, ""),
      name: nameMatch?.[1]?.trim() ?? file,
      role: roleMatch?.[1]?.trim() ?? "unknown",
      path: `governance/agents/${file}`,
    };
  });
}

function readGovernanceDocs(shitennoDir: string): KnowledgeState["governanceDocs"] {
  const maturityPath = join(shitennoDir, "maturity-profile.json");
  let caps: string[] = [];
  if (existsSync(maturityPath)) {
    try {
      const profile = JSON.parse(readFileSync(maturityPath, "utf-8"));
      caps = profile.installedCapabilities || [];
    } catch { /* ignore */ }
  }
  return buildExpectedDocs(caps).filter((doc) => existsSync(join(shitennoDir, doc.path)));
}

function readScripts(shitennoDir: string): KnowledgeState["scripts"] {
  const scriptsDir = join(shitennoDir, "scripts");
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir).filter((f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f)).map((file) => ({
    id: file.replace(/\.(ts|js)$/, ""),
    name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
    path: `scripts/${file}`,
  }));
}

function readRunbooks(shitennoDir: string): KnowledgeState["runbooks"] {
  const runbooksDir = join(shitennoDir, "docs", "runbooks");
  if (!existsSync(runbooksDir)) return [];
  return readdirSync(runbooksDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: file.replace(".md", ""),
    name: file.replace(".md", "").replace(/-/g, " "),
    path: `docs/runbooks/${file}`,
  }));
}

/** Build expected docs list with conditional criticality based on installed capabilities. */
function buildExpectedDocs(installedCapabilities: string[]) {
  return [
    { name: "AGENTS.md", path: "docs/AGENTS.md", critical: true },
    { name: "FORBIDDEN_OPERATIONS.md", path: "docs/FORBIDDEN_OPERATIONS.md", critical: true },
    { name: "DESDO.md", path: "docs/DESDO.md", critical: true },
    { name: "CONCEPTUAL_MODEL.md", path: "docs/CONCEPTUAL_MODEL.md", critical: false },
    { name: "KNOWLEDGE_LIFECYCLE.md", path: "docs/KNOWLEDGE_LIFECYCLE.md", critical: false },
    { name: "WORKFLOW.md", path: "governance/WORKFLOW.md",
      critical: installedCapabilities.includes("governance") },
    { name: "SYSTEM_MAP.md", path: "governance/SYSTEM_MAP.md", critical: false },
  ];
}

export function readKnowledgeState(shitennoDir: string): KnowledgeState {
  return {
    adrs: readAdrs(shitennoDir),
    skills: readSkills(shitennoDir),
    contracts: readContracts(shitennoDir),
    governanceDocs: readGovernanceDocs(shitennoDir),
    scripts: readScripts(shitennoDir),
    runbooks: readRunbooks(shitennoDir),
  };
}
