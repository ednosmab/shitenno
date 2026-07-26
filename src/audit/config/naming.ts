/**
 * Config detectors — Naming conventions
 *
 * Detects naming convention violations and unreferenced directories.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";

/**
 * Detect report files that don't follow naming conventions.
 */
export function detectReportNaming(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return issues;

  const validPattern = /^(health|complexity|doc-lifecycle|pattern)(-[a-z0-9]+(-[a-z0-9]+)*)?-\d{4}-\d{2}-\d{2}.*\.json$/;

  try {
    const files = readdirSync(reportsDir);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      if (file === "README.md") continue;
      if (!validPattern.test(file)) {
        issues.push({
          type: "broken_ref",
          severity: 1,
          description: `Report "${file}" não segue a convenção de nomenclatura (<tipo>-YYYY-MM-DD.json)`,
          location: `shitenno/reports/${file}`,
          recommendation: `Renomear "${file}" para seguir o padrão <tipo>-YYYY-MM-DD.json`,
          confidence: 0.75,
        });
      }
    }
  } catch (err) { logger.debug("config/naming", "Error in detectReportNaming:", err); }

  return issues;
}

/**
 * Detect directories in docs/ that are not referenced in governance documents.
 */
export function detectUnreferencedDirs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(shitennoDir, "docs");
  if (!existsSync(docsDir)) return issues;

  const governanceFiles = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/DESDO.md",
    "docs/capabilities.md",
  ];

  let governanceContent = "";
  for (const doc of governanceFiles) {
    const path = join(shitennoDir, doc);
    if (existsSync(path)) {
      try { governanceContent += readFileSync(path, "utf-8") + "\n"; } catch (readErr) { logger.debug("config/naming", "Error reading governance file:", readErr); }
    }
  }

  try {
    const entries = readdirSync(docsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (["skills", "adrs", "history", "runbooks", "plans"].includes(entry.name)) continue;
      const dirPattern = new RegExp(`docs/${entry.name}/|docs/${entry.name}\\b`);
      if (!dirPattern.test(governanceContent)) {
        issues.push({
          type: "orphan_dir",
          severity: 1,
          description: `Directório "docs/${entry.name}" existe mas não é referenciado em nenhum documento governance`,
          location: `shitenno/docs/${entry.name}/`,
          recommendation: `Adicionar referência a "docs/${entry.name}" em SYSTEM_MAP.md ou remover o directório`,
          confidence: 0.75,
        });
      }
    }
  } catch (scanErr) { logger.debug("config/naming", "Error in detectUnreferencedDirs:", scanErr); }

  return issues;
}
