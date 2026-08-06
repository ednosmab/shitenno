import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue } from "../types.js";
import { logger } from "../../shared/logger.js";

const TEMPLATE_PATTERNS = ["YYYY", "MM-DD", "<", "*", "[camada]"];
const SKIP_DIRS = ["governance/", "docs/", "shitenno/"];

function isTemplateRef(ref: string): boolean {
  return ref.includes("<") || ref.includes("YYYY") || ref.includes("*") || TEMPLATE_PATTERNS.some((p) => ref.includes(p));
}

function isSkippableDirRef(ref: string): boolean {
  return SKIP_DIRS.some((d) => ref.startsWith(d));
}

function checkFileRef(
  ref: string,
  file: string,
  shitennoDir: string,
  projectRoot: string,
): HealthIssue | null {
  if (!ref || isTemplateRef(ref)) return null;
  const refShitenno = join(shitennoDir, ref);
  const refRoot = join(projectRoot, ref);
  if (existsSync(refShitenno) || existsSync(refRoot)) return null;
  return {
    type: "agent_contract_ref",
    severity: 2,
    description: `Referência quebrada em "${file}": "${ref}" não existe`,
    location: `shitenno/governance/agents/${file}`,
    recommendation: `Corrigir referência "${ref}" em "${file}" ou criar o ficheiro`,
    confidence: 0.75,
  };
}

function checkDirRef(
  ref: string,
  file: string,
  shitennoDir: string,
  projectRoot: string,
): HealthIssue | null {
  if (!ref || isTemplateRef(ref) || isSkippableDirRef(ref)) return null;
  const refShitenno = join(shitennoDir, ref);
  const refRoot = join(projectRoot, ref);
  if (existsSync(refShitenno) || existsSync(refRoot)) return null;
  return {
    type: "agent_contract_ref",
    severity: 2,
    description: `Referência quebrada em "${file}": directório "${ref}" não existe`,
    location: `shitenno/governance/agents/${file}`,
    recommendation: `Criar directório "${ref}" ou corrigir referência em "${file}"`,
    confidence: 0.75,
  };
}

export function detectAgentContractRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const agentsDir = join(shitennoDir, "governance/agents");
  if (!existsSync(agentsDir)) return issues;

  const projectRoot = join(shitennoDir, "..");
  const files = readdirSync(agentsDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

  for (const file of files) {
    try {
      const content = readFileSync(join(agentsDir, file), "utf-8");

      const refRegex = /`([^`]+\.(?:md|yaml|json|ts|js))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const issue = checkFileRef(match[1] ?? "", file, shitennoDir, projectRoot);
        if (issue) issues.push(issue);
      }

      const dirRefRegex = /\b([a-zA-Z0-9_/.-]+\/)\s*(?:\||$)/gm;
      let dirMatch;
      while ((dirMatch = dirRefRegex.exec(content)) !== null) {
        const issue = checkDirRef(dirMatch[1] ?? "", file, shitennoDir, projectRoot);
        if (issue) issues.push(issue);
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning agent contracts:", err); }
  }
  return issues;
}

export function detectBufferSchemaMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const bufferPath = join(shitennoDir, "governance/context/context_buffer.yaml");
  const agentsPath = join(shitennoDir, "docs/AGENTS.md");
  if (!existsSync(bufferPath) || !existsSync(agentsPath)) return issues;

  try {
    const bufferContent = readFileSync(bufferPath, "utf-8");
    const agentsContent = readFileSync(agentsPath, "utf-8");

    const requiredSections = ["blockers", "imported-tools"];
    for (const section of requiredSections) {
      const inBuffer = bufferContent.includes(section);
      const inAgents = agentsContent.includes(section);
      if (inAgents && !inBuffer) {
        issues.push({
          type: "buffer_schema_mismatch",
          severity: 2,
          description: `AGENTS.md referencia secção "${section}" mas context_buffer.yaml não a contém`,
          location: "shitenno/governance/context/context_buffer.yaml",
          recommendation: `Adicionar secção "${section}" ao context_buffer.yaml`,
          confidence: 0.7,
        });
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectBufferSchemaMismatch:", err); }
  return issues;
}
