import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue } from "../types.js";
import { logger } from "../../shared/logger.js";

export function detectScriptWiring(projectRoot: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  let rootScripts: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    rootScripts = Object.keys(pkg.scripts ?? {});
  } catch (err) { logger.debug("governance-detectors", "Error reading root package.json:", err); }

  const docsToScan = [
    "governance/WORKFLOW.md",
    "docs/AGENTS.md",
    "docs/session-template.md",
  ];
  const scriptRegex = /pnpm run ([a-zA-Z0-9:-]+)/g;
  const referenced = new Set<string>();

  for (const doc of docsToScan) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = scriptRegex.exec(content)) !== null) {
        if (match[1]) referenced.add(match[1]);
      }
    } catch (err) { logger.debug("governance-detectors", "Error scanning doc scripts:", err); }
  }

  const missing = Array.from(referenced).filter((s) => !rootScripts.includes(s));
  if (missing.length > 0) {
    issues.push({
      type: "script_wiring",
      severity: 3,
      description: `${missing.length} script(s) referenciado(s) em docs não existem no root package.json: ${missing.join(", ")}`,
      location: "package.json",
      recommendation: `Adicionar scripts ao root package.json: ${missing.map((s) => `"${s}": "tsx shitenno/scripts/..."`).join(", ")}`,
      confidence: 0.9,
    });
  }
  return issues;
}
