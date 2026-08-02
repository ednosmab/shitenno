import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { EngineeringAsset } from "../domain/entities/engineering-state.js";

function discoverAdrs(shitennoDir: string, now: string): EngineeringAsset[] {
  const adrDir = join(shitennoDir, "docs", "adrs");
  if (!existsSync(adrDir)) return [];
  const files = readdirSync(adrDir).filter((f) => f.endsWith(".md") && !f.startsWith("ADR-TEMPLATE"));
  return files.map((file) => {
    const content = readFileSync(join(adrDir, file), "utf-8");
    const titleMatch = content.match(/^#\s+(.+)/m);
    const statusMatch = content.match(/Estado:\s*(\w+)/i) || content.match(/Status:\s*(\w+)/i);
    return {
      id: `adr-${file.replace(".md", "")}`,
      type: "adr" as const,
      name: titleMatch?.[1] ?? file.replace(".md", "").replace(/-/g, " "),
      path: `docs/adrs/${file}`,
      description: `Architecture Decision Record: ${file}`,
      tags: ["adr", "decision", "architecture"],
      status: statusMatch?.[1]?.toLowerCase() === "deprecated" ? "archived" as const : "active" as const,
      createdAt: now,
      updatedAt: now,
      contributesTo: ["architecture", "documentation"],
      dependencies: [],
    };
  });
}

function discoverSkills(shitennoDir: string, now: string): EngineeringAsset[] {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: `skill-${file.replace(".md", "")}`,
    type: "skill" as const,
    name: file.replace(".md", "").replace(/_/g, " "),
    path: `docs/skills/${file}`,
    description: `Engineering skill: ${file}`,
    tags: ["skill", "engineering"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["documentation", "quality"],
    dependencies: [],
  }));
}

function discoverContracts(shitennoDir: string, now: string): EngineeringAsset[] {
  const contractsDir = join(shitennoDir, "governance", "agents");
  if (!existsSync(contractsDir)) return [];
  return readdirSync(contractsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).map((file) => ({
    id: `contract-${file.replace(/\.(yaml|yml)$/, "")}`,
    type: "contract" as const,
    name: file.replace(/\.(yaml|yml)$/, "").replace(/-/g, " "),
    path: `governance/agents/${file}`,
    description: `AI agent contract: ${file}`,
    tags: ["contract", "agent", "ai"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["ai", "governance"],
    dependencies: [],
  }));
}

function discoverPolicies(shitennoDir: string, now: string): EngineeringAsset[] {
  const rulesDir = join(shitennoDir, "governance", "rules");
  if (!existsSync(rulesDir)) return [];
  const files = readdirSync(rulesDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const assets: EngineeringAsset[] = [];
  for (const file of files) {
    try {
      const content = JSON.parse(readFileSync(join(rulesDir, file), "utf-8"));
      assets.push({
        id: `policy-${content.id || file.replace(".json", "")}`,
        type: "policy",
        name: content.description || file.replace(".json", ""),
        path: `governance/rules/${file}`,
        description: `Governance rule: ${content.id || file}`,
        tags: ["policy", "rule", "governance"],
        status: content.enabled ? "active" : "draft",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["governance"],
        dependencies: [],
      });
    } catch {
      logger.debug("engineering-state", "Failed to parse rule file:", file);
    }
  }
  return assets;
}

function discoverWorkflow(shitennoDir: string, now: string): EngineeringAsset[] {
  const workflowPath = join(shitennoDir, "governance", "WORKFLOW.md");
  if (!existsSync(workflowPath)) return [];
  return [{
    id: "workflow-main",
    type: "workflow",
    name: "Main Workflow",
    path: "governance/WORKFLOW.md",
    description: "Main session workflow",
    tags: ["workflow", "session", "governance"],
    status: "active",
    createdAt: now,
    updatedAt: now,
    contributesTo: ["governance"],
    dependencies: [],
  }];
}

function discoverRunbooks(shitennoDir: string, now: string): EngineeringAsset[] {
  const runbooksDir = join(shitennoDir, "docs", "runbooks");
  if (!existsSync(runbooksDir)) return [];
  return readdirSync(runbooksDir).filter((f) => f.endsWith(".md")).map((file) => ({
    id: `runbook-${file.replace(".md", "")}`,
    type: "runbook" as const,
    name: file.replace(".md", "").replace(/-/g, " "),
    path: `docs/runbooks/${file}`,
    description: `Operational runbook: ${file}`,
    tags: ["runbook", "operations"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["operations", "quality"],
    dependencies: [],
  }));
}

function discoverPlans(shitennoDir: string, now: string): EngineeringAsset[] {
  const plansDir = join(shitennoDir, "governance", "plans");
  if (!existsSync(plansDir)) return [];
  return readdirSync(plansDir).filter((f) => f.endsWith(".md") && !f.startsWith("TEMPLATE")).map((file) => ({
    id: `plan-${file.replace(".md", "")}`,
    type: "plan" as const,
    name: file.replace(".md", "").replace(/-/g, " "),
    path: `governance/plans/${file}`,
    description: `Execution plan: ${file}`,
    tags: ["plan", "execution"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["architecture"],
    dependencies: [],
  }));
}

function discoverScripts(shitennoDir: string, now: string): EngineeringAsset[] {
  const scriptsDir = join(shitennoDir, "scripts");
  if (!existsSync(scriptsDir)) return [];
  return readdirSync(scriptsDir).filter((f) => /\.(ts|tsx|js|jsx|vue|svelte)$/.test(f)).map((file) => ({
    id: `script-${file.replace(/\.(ts|js)$/, "")}`,
    type: "script" as const,
    name: file.replace(/\.(ts|js)$/, "").replace(/-/g, " "),
    path: `scripts/${file}`,
    description: `Automation script: ${file}`,
    tags: ["script", "automation"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["automation"],
    dependencies: [],
  }));
}

function discoverDocs(shitennoDir: string, now: string): EngineeringAsset[] {
  const docsDir = join(shitennoDir, "docs");
  if (!existsSync(docsDir)) return [];
  const governanceDocNames = [
    "AGENTS.md", "FORBIDDEN_OPERATIONS.md", "DESDO.md",
    "CONCEPTUAL_MODEL.md", "KNOWLEDGE_LIFECYCLE.md", "BACKLOG.md",
  ];
  return readdirSync(docsDir).filter((f) => f.endsWith(".md") && !f.startsWith("README")).map((file) => {
    const isGovernanceDoc = governanceDocNames.includes(file);
    return {
      id: `doc-${file.replace(".md", "")}`,
      type: "doc" as const,
      name: file.replace(".md", "").replace(/_/g, " "),
      path: `docs/${file}`,
      description: `Documentation: ${file}`,
      tags: ["doc", "documentation", ...(isGovernanceDoc ? ["governance"] as string[] : [] as string[])],
      status: "active" as const,
      createdAt: now,
      updatedAt: now,
      contributesTo: isGovernanceDoc ? ["governance", "documentation"] : ["documentation"],
      dependencies: [],
    };
  });
}

function discoverTemplates(shitennoDir: string, now: string): EngineeringAsset[] {
  const templatesDir = join(shitennoDir, "templates");
  if (!existsSync(templatesDir)) return [];
  return readdirSync(templatesDir).filter((f) => f.endsWith(".md") || f.endsWith(".yaml") || f.endsWith(".yml")).map((file) => ({
    id: `template-${file.replace(/\.(md|yaml|yml)$/, "")}`,
    type: "template" as const,
    name: file.replace(/\.(md|yaml|yml)$/, "").replace(/_/g, " "),
    path: `templates/${file}`,
    description: `Template: ${file}`,
    tags: ["template"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["documentation"],
    dependencies: [],
  }));
}

function discoverReports(shitennoDir: string, now: string): EngineeringAsset[] {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return [];
  return readdirSync(reportsDir).filter((f) => f.endsWith(".json")).map((file) => ({
    id: `report-${file.replace(".json", "")}`,
    type: "report" as const,
    name: file.replace(".json", "").replace(/-/g, " "),
    path: `reports/${file}`,
    description: `Report: ${file}`,
    tags: ["report", "metrics"],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
    contributesTo: ["observability"],
    dependencies: [],
  }));
}

function discoverContext(shitennoDir: string, now: string): EngineeringAsset[] {
  const contextBuffer = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(contextBuffer)) return [];
  return [{
    id: "context-session",
    type: "context",
    name: "Session Context Buffer",
    path: "governance/context/context_buffer.yaml",
    description: "Current session context state",
    tags: ["context", "session", "state"],
    status: "active",
    createdAt: now,
    updatedAt: now,
    contributesTo: ["governance"],
    dependencies: [],
  }];
}

function discoverPrompts(shitennoDir: string, now: string): EngineeringAsset[] {
  const cognitionDir = join(shitennoDir, "cognition", "prompts");
  if (!existsSync(cognitionDir)) return [];
  const subDirs = readdirSync(cognitionDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const assets: EngineeringAsset[] = [];
  for (const subDir of subDirs) {
    const promptDir = join(cognitionDir, subDir.name);
    const promptFiles = readdirSync(promptDir).filter((f) => f.endsWith(".md"));
    for (const file of promptFiles) {
      assets.push({
        id: `prompt-${subDir.name}-${file.replace(".md", "")}`,
        type: "prompt",
        name: `${subDir.name} prompt: ${file.replace(".md", "")}`,
        path: `cognition/prompts/${subDir.name}/${file}`,
        description: `AI prompt: ${subDir.name}/${file}`,
        tags: ["prompt", "ai", subDir.name],
        status: "active",
        createdAt: now,
        updatedAt: now,
        contributesTo: ["ai"],
        dependencies: [],
      });
    }
  }
  return assets;
}

export function discoverAssets(shitennoDir: string): EngineeringAsset[] {
  const now = new Date().toISOString();
  return [
    ...discoverAdrs(shitennoDir, now),
    ...discoverSkills(shitennoDir, now),
    ...discoverContracts(shitennoDir, now),
    ...discoverPolicies(shitennoDir, now),
    ...discoverWorkflow(shitennoDir, now),
    ...discoverRunbooks(shitennoDir, now),
    ...discoverPlans(shitennoDir, now),
    ...discoverScripts(shitennoDir, now),
    ...discoverDocs(shitennoDir, now),
    ...discoverTemplates(shitennoDir, now),
    ...discoverReports(shitennoDir, now),
    ...discoverContext(shitennoDir, now),
    ...discoverPrompts(shitennoDir, now),
  ];
}
