/**
 * commands/status/health-checks.ts — Governance health check functions
 *
 * Extracted from commands/status.ts to keep modules focused.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface StatusCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

export function runHealthChecks(projectRoot: string, shitennoDir: string): StatusCheck[] {
  return [
    checkOpencodeConfig(projectRoot),
    checkAgentsFile(shitennoDir),
    checkSkillsDirectory(shitennoDir),
    checkGovernanceDirectory(shitennoDir),
    checkContextBuffer(shitennoDir),
    checkScripts(shitennoDir),
    checkAgentContracts(shitennoDir),
  ];
}

function checkOpencodeConfig(projectRoot: string): StatusCheck {
  const configPath = join(projectRoot, "opencode.json");
  if (!existsSync(configPath)) return { name: "opencode.json", status: "fail", message: "File not found" };
  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    if (!config.model) return { name: "opencode.json", status: "warn", message: "Missing 'model' field" };
    if (!config.agent) return { name: "opencode.json", status: "warn", message: "Missing 'agent' configuration" };
    const agentCount = Object.keys(config.agent).length;
    return { name: "opencode.json", status: "pass", message: `Configured with ${agentCount} agents` };
  } catch {
    return { name: "opencode.json", status: "fail", message: "Invalid JSON" };
  }
}

function checkAgentsFile(shitennoDir: string): StatusCheck {
  const agentsPath = join(shitennoDir, "docs", "AGENTS.md");
  if (!existsSync(agentsPath)) return { name: "shitenno/docs/AGENTS.md", status: "fail", message: "File not found" };
  const content = readFileSync(agentsPath, "utf-8");
  const ruleCount = (content.match(/^\d+\./gm) || []).length;
  if (ruleCount < 10) return { name: "shitenno/docs/AGENTS.md", status: "warn", message: `Only ${ruleCount} rules found (expected 22+)` };
  return { name: "shitenno/docs/AGENTS.md", status: "pass", message: `${ruleCount} rules configured` };
}

function checkSkillsDirectory(shitennoDir: string): StatusCheck {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return { name: "shitenno/docs/skills/", status: "warn", message: "Directory not found" };
  const skillFiles = readdirSync(skillsDir).filter((f: string) => f.endsWith(".md"));
  if (skillFiles.length === 0) return { name: "shitenno/docs/skills/", status: "warn", message: "No skills found" };
  return { name: "shitenno/docs/skills/", status: "pass", message: `${skillFiles.length} skills installed` };
}

function checkGovernanceDirectory(shitennoDir: string): StatusCheck {
  const govDir = join(shitennoDir, "governance");
  if (!existsSync(govDir)) return { name: "shitenno/governance/", status: "warn", message: "Directory not found" };
  const hasContext = existsSync(join(govDir, "context"));
  const hasAgents = existsSync(join(govDir, "agents"));
  const parts: string[] = [];
  if (hasContext) parts.push("context");
  if (hasAgents) parts.push("agents");
  return { name: "shitenno/governance/", status: "pass", message: `Contains: ${parts.join(", ") || "empty"}` };
}

function checkContextBuffer(shitennoDir: string): StatusCheck {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
  if (!existsSync(bufferPath)) return { name: "context_buffer.yaml", status: "warn", message: "Not found" };
  const content = readFileSync(bufferPath, "utf-8");
  if (!content.includes("current_task:")) return { name: "context_buffer.yaml", status: "warn", message: "Missing 'current_task' section" };
  return { name: "context_buffer.yaml", status: "pass", message: "Valid" };
}

function checkScripts(shitennoDir: string): StatusCheck {
  const scriptsDir = join(shitennoDir, "scripts");
  if (!existsSync(scriptsDir)) return { name: "shitenno/scripts/", status: "warn", message: "Directory not found" };
  const scriptFiles = readdirSync(scriptsDir).filter((f: string) => f.endsWith(".ts") || f.endsWith(".js"));
  if (scriptFiles.length === 0) return { name: "shitenno/scripts/", status: "warn", message: "No scripts found" };
  return { name: "shitenno/scripts/", status: "pass", message: `${scriptFiles.length} scripts installed` };
}

function checkAgentContracts(shitennoDir: string): StatusCheck {
  const contractsDir = join(shitennoDir, "governance", "agents");
  if (!existsSync(contractsDir)) return { name: "agent contracts", status: "warn", message: "Not found" };
  const yamlFiles = readdirSync(contractsDir).filter((f: string) => f.endsWith(".yaml") || f.endsWith(".yml"));
  if (yamlFiles.length === 0) return { name: "agent contracts", status: "warn", message: "No contracts found" };
  return { name: "agent contracts", status: "pass", message: `${yamlFiles.length} contracts defined` };
}
