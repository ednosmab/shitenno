import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import { CAPABILITIES, type Capability, type CapabilityInfo } from "../maturity-profile.js";
import type { CapabilityMaturity, CapabilityEntity } from "./types.js";

export function detectCapabilityMaturity(
  capability: Capability,
  shitennoDir: string,
  installedCapabilities: Capability[]
): { level: CapabilityMaturity; score: number } {
  if (!installedCapabilities.includes(capability)) {
    return { level: "dormant", score: 0 };
  }

  const capInfo = CAPABILITIES.find((c) => c.id === capability);
  if (!capInfo) return { level: "dormant", score: 0 };

  let score = 20;

  if (checkCapabilityFiles(capability, shitennoDir)) score += 20;
  if (checkCapabilityRules(capability, shitennoDir)) score += 20;
  if (checkCapabilitySkills(capability, shitennoDir)) score += 15;
  if (checkCapabilityTemplates(capability, shitennoDir)) score += 10;
  if (checkCapabilityMetrics(capability, shitennoDir)) score += 15;

  let level: CapabilityMaturity;
  if (score >= 80) level = "optimized";
  else if (score >= 60) level = "active";
  else if (score >= 40) level = "configured";
  else level = "installed";

  return { level, score: Math.min(100, score) };
}

function checkCapabilityFiles(capability: Capability, shitennoDir: string): boolean {
  const mapping = getCapabilityFilesForEngine(capability);
  return mapping.some((f) => existsSync(join(shitennoDir, f)));
}

function checkCapabilityRules(capability: Capability, shitennoDir: string): boolean {
  const rulesDir = join(shitennoDir, "governance", "rules");
  if (!existsSync(rulesDir)) return false;

  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
  for (const file of ruleFiles) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      if (content.tags && content.tags.includes(capability)) return true;
    } catch {
      logger.debug("capability-engine", "Failed to parse rule file:", file);
    }
  }
  return false;
}

function checkCapabilitySkills(capability: Capability, shitennoDir: string): boolean {
  const capabilityFiles = getCapabilityFilesForEngine(capability)
    .filter((f) => f.startsWith("docs/skills/"));
  if (capabilityFiles.length === 0) return false;

  // Check if ANY of the specific skill files for this capability actually exist
  return capabilityFiles.some((f) => {
    // capabilityFiles use paths relative to shitennoDir (e.g. "docs/skills/")
    // but some are directory prefixes — check if any .md file in that dir matches
    const fullPath = join(shitennoDir, f);
    if (f.endsWith("/")) {
      // It's a directory prefix — check if any skill file exists in it
      return existsSync(fullPath) && readdirSync(fullPath).some((sf) => sf.endsWith(".md"));
    }
    return existsSync(fullPath);
  });
}

function checkCapabilityTemplates(capability: Capability, shitennoDir: string): boolean {
  const capabilityFiles = getCapabilityFilesForEngine(capability)
    .filter((f) => f.startsWith("templates/"));
  if (capabilityFiles.length === 0) return false;

  // Check if the specific template directory/file for this capability exists
  return capabilityFiles.some((f) => {
    const fullPath = join(shitennoDir, f);
    if (f.endsWith("/")) {
      return existsSync(fullPath) && readdirSync(fullPath).some((tf) => tf.endsWith(".md") || tf.endsWith(".yaml"));
    }
    return existsSync(fullPath);
  });
}

function checkCapabilityMetrics(capability: Capability, shitennoDir: string): boolean {
  const capabilityFiles = getCapabilityFilesForEngine(capability)
    .filter((f) => f.startsWith("reports/"));
  if (capabilityFiles.length === 0) return false;

  // Check if any report file exists in the specific reports directory
  return capabilityFiles.some((f) => {
    const fullPath = join(shitennoDir, f);
    if (f.endsWith("/")) {
      return existsSync(fullPath) && readdirSync(fullPath).some((rf) => rf.endsWith(".json"));
    }
    return existsSync(fullPath);
  });
}

export function getCapabilityFilesForEngine(capability: Capability): string[] {
  const fileMap: Record<Capability, string[]> = {
    core: ["docs/backlog/ACTIVE.md", "docs/AGENTS.md"],
    knowledge: ["docs/skills/", "docs/AGENTS.md"],
    architecture: ["docs/adrs/", "governance/plans/"],
    governance: ["governance/WORKFLOW.md", "governance/context/"],
    ai: ["governance/agents/", "cognition/"],
    quality: ["scripts/validate-session.ts"],
    metrics: ["reports/"],
    operations: ["scripts/close-session.ts", "docs/runbooks/"],
    compliance: ["docs/FORBIDDEN_OPERATIONS.md", "docs/DESDO.md"],
  };
  return fileMap[capability] || [];
}

interface CapabilityBuildInput {
  capInfo: CapabilityInfo;
  shitennoDir: string;
  installedCapabilities: Capability[];
  assets: Array<{ type: string; path: string }>;
  maturityScore?: number;
}

function buildCapabilityMetrics(score: number, capabilityAssets: number, activePolicies: number) {
  return { assetCount: capabilityAssets, ruleCount: activePolicies, policyCount: activePolicies, healthScore: score, lastUpdated: new Date().toISOString(), referenceCount: 0 };
}

export function buildCapabilityEntity(input: CapabilityBuildInput): CapabilityEntity {
  const { capInfo, shitennoDir: sDir, installedCapabilities: installed, assets: allAssets } = input;

  const isInstalled = installed.includes(capInfo.id);
  const { level, score } = detectCapabilityMaturity(capInfo.id, sDir, installed);
  const capabilityAssets = allAssets.filter((a) => getCapabilityFilesForEngine(capInfo.id).some((m) => a.path.startsWith(m.replace(/\/$/, ""))));
  const activePolicies = collectCapabilityPolicies(capInfo.id, sDir);
  const activeSkills = collectCapabilitySkills(capInfo.id, sDir);
  const templates = collectCapabilityTemplates(capInfo.id, sDir);

  return {
    id: capInfo.id, name: capInfo.name, description: capInfo.description,
    maturity: level, maturityScore: score, dimensions: capInfo.dimensions,
    dependencies: capInfo.requires, activePolicies, activeSkills, templates,
    recommendations: [], metrics: buildCapabilityMetrics(score, capabilityAssets.length, activePolicies.length),
    alwaysInstalled: capInfo.alwaysInstalled, isInstalled, files: getCapabilityFilesForEngine(capInfo.id),
  };
}

function collectCapabilityPolicies(capability: Capability, shitennoDir: string): string[] {
  const policies: string[] = [];
  const rulesDir = join(shitennoDir, "governance", "rules");
  if (!existsSync(rulesDir)) return policies;

  const ruleFiles = readdirSync(rulesDir).filter((f) => f.endsWith(".json"));
  for (const file of ruleFiles) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      if (content.tags && content.tags.includes(capability)) {
        policies.push(content.id || file.replace(".json", ""));
      }
    } catch {
      logger.debug("capability-engine", "Failed to parse rule file:", file);
    }
  }
  return policies;
}

function collectCapabilitySkills(_capability: Capability, shitennoDir: string): string[] {
  const skills: string[] = [];
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return skills;

  const skillFiles = readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
  for (const file of skillFiles) {
    skills.push(file.replace(".md", ""));
  }
  return skills;
}

function collectCapabilityTemplates(_capability: Capability, shitennoDir: string): string[] {
  const templates: string[] = [];
  const templatesDir = join(shitennoDir, "templates");
  if (!existsSync(templatesDir)) return templates;

  const templateFiles = readdirSync(templatesDir).filter(
    (f) => f.endsWith(".md") || f.endsWith(".yaml")
  );
  for (const file of templateFiles) {
    templates.push(file);
  }
  return templates;
}
