/**
 * Docs detectors — Reference integrity
 *
 * Detects broken file and directory references in documentation.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";
import { collectBacktickRefs, isTemplateRef, refExists } from "./helpers.js";

const DOCS_WITH_FILE_REFS = [
  "docs/AGENTS.md",
  "docs/DESDO.md",
  "docs/capabilities.md",
  "cognition/context/CONTEXT_HIERARCHY.md",
];

const DOCS_WITH_DIR_REFS = [
  "governance/WORKFLOW.md",
  "governance/SYSTEM_MAP.md",
  "docs/AGENTS.md",
  "docs/DESDO.md",
  "docs/FORBIDDEN_OPERATIONS.md",
  "docs/capabilities.md",
  "cognition/context/CONTEXT_HIERARCHY.md",
];

/**
 * Detect broken file references in documentation.
 */
export function detectBrokenRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitennoDir, "..");
  const docsWithRefs = [
    "governance/WORKFLOW.md",
    "governance/SYSTEM_MAP.md",
    "docs/AGENTS.md",
    "docs/CONCEPTUAL_MODEL.md",
    "docs/capabilities.md",
  ];

  for (const doc of docsWithRefs) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      const refRegex = /`([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json|txt))`/g;
      let match;
      while ((match = refRegex.exec(content)) !== null) {
        const ref = match[1];
        if (
          !ref ||
          ref.includes("*") ||
          ref.includes("[") ||
          ref.includes("<") ||
          ref.includes("YYYY") ||
          ref.includes("MM-DD")
        ) continue;
        const refPathShitenno = join(shitennoDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathShitenno) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `shitenno/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
            confidence: 0.75,
          });
        }
      }
    } catch (err) {
      logger.debug("docs/refs", `Error scanning refs in ${doc}:`, err);
    }
  }

  return issues;
}

/**
 * Detect broken directory references in documentation.
 */
export function detectBrokenDirRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitennoDir, "..");
  const dirRefRegex = /`([a-zA-Z0-9_/.-]+\/)`/g;

  for (const doc of DOCS_WITH_DIR_REFS) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = dirRefRegex.exec(content)) !== null) {
        const ref = match[1];
        if (
          !ref ||
          ref.includes("*") ||
          ref.includes("<") ||
          ref.includes("YYYY")
        ) continue;
        const refPathShitenno = join(shitennoDir, ref);
        const refPathRoot = join(projectRoot, ref);
        if (!existsSync(refPathShitenno) && !existsSync(refPathRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": directório "${ref}" não existe`,
            location: `shitenno/${doc}`,
            recommendation: `Criar directório "${ref}" ou corrigir referência em "${doc}"`,
            confidence: 0.75,
          });
        }
      }
    } catch (err) {
      logger.debug("docs/refs", `Error scanning dir refs in ${doc}:`, err);
    }
  }

  return issues;
}

/**
 * Detect non-backtick file references that may be broken.
 */
export function detectNonBacktickFileRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitennoDir, "..");
  const fileRefRegex = /(?:^|[\s,:(])([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json))(?=[\s,.)]|$)/gm;

  for (const doc of DOCS_WITH_FILE_REFS) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;

    try {
      const content = readFileSync(path, "utf-8");
      const backtickRefs = collectBacktickRefs(content);
      const docDir = dirname(path);

      let match;
      while ((match = fileRefRegex.exec(content)) !== null) {
        const ref = match[1];
        if (!ref || isTemplateRef(ref) || backtickRefs.has(ref)) continue;
        if (!refExists(ref, docDir, shitennoDir, projectRoot)) {
          issues.push({
            type: "broken_ref",
            severity: 2,
            description: `Referência quebrada em "${doc}": "${ref}" não existe`,
            location: `shitenno/${doc}`,
            recommendation: `Corrigir referência "${ref}" em "${doc}" ou criar o ficheiro`,
            confidence: 0.75,
          });
        }
      }
    } catch (err) {
      logger.debug("docs/refs", `Error scanning non-backtick refs in ${doc}:`, err);
    }
  }

  return issues;
}
