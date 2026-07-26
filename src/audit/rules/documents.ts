import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue } from "../types.js";
import { logger } from "../../logger.js";

export function detectDocCountMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const guidePath = join(shitennoDir, "docs/Shitenno_GUIDE.md");
  if (!existsSync(guidePath)) return issues;

  try {
    const content = readFileSync(guidePath, "utf-8");

    const reportMatch = content.match(/(\d+)\s+relat/);
    if (reportMatch) {
      const claimed = Number(reportMatch[1]);
      const reportsDir = join(shitennoDir, "reports");
      if (existsSync(reportsDir)) {
        const actual = readdirSync(reportsDir).filter((f) => f.endsWith(".json") && f.startsWith("complexity-")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} relatórios" mas existem ${actual} ficheiros complexity-*.json`,
            location: "shitenno/docs/Shitenno_GUIDE.md",
            recommendation: `Actualizar contagem de relatórios para ${actual}`,
            confidence: 0.75,
          });
        }
      }
    }

    const feedbackMatch = content.match(/(\d+)\s+registos\s+de\s+feedback/);
    if (feedbackMatch) {
      const claimed = Number(feedbackMatch[1]);
      const recordsDir = join(shitennoDir, "feedback/records");
      if (existsSync(recordsDir)) {
        const actual = readdirSync(recordsDir).filter((f) => f.endsWith(".json")).length;
        if (actual !== claimed) {
          issues.push({
            type: "doc_count_mismatch",
            severity: 2,
            description: `GUIDE diz "${claimed} registos de feedback" mas existem ${actual}`,
            location: "shitenno/docs/Shitenno_GUIDE.md",
            recommendation: `Actualizar contagem de registos para ${actual}`,
            confidence: 0.75,
          });
        }
      }
    }
  } catch (err) { logger.debug("governance-detectors", "Error in detectDocCountMismatch:", err); }
  return issues;
}

function extractP0Refs(content: string): Set<string> {
  const p0 = new Set<string>();
  const p0Patterns = [
    /P0[:\s]+([^\n]+)/gi,
    /Level\s*0[:\s]+([^\n]+)/gi,
    /nível\s*0[:\s]+([^\n]+)/gi,
    /\[Nível\s*0:\s*P0\]\s+([^\n]+)/gi,
  ];
  for (const pattern of p0Patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const fileRefs = (match[1] ?? "").match(/[A-Z_]+\.md/g);
      if (fileRefs) {
        for (const ref of fileRefs) p0.add(ref);
      }
    }
  }
  return p0;
}

function compareP0Sets(
  fileA: string,
  p0A: Set<string>,
  fileB: string,
  p0B: Set<string>,
): HealthIssue | null {
  const onlyInA = [...p0A].filter((f) => !p0B.has(f));
  const onlyInB = [...p0B].filter((f) => !p0A.has(f));
  if (onlyInA.length === 0 && onlyInB.length === 0) return null;

  const parts: string[] = [];
  if (onlyInA.length > 0) parts.push(`${fileA} tem: ${onlyInA.join(", ")}`);
  if (onlyInB.length > 0) parts.push(`${fileB} tem: ${onlyInB.join(", ")}`);
  return {
    type: "cross_doc_p0_contradiction",
    severity: 2,
    description: `Hierarquia P0 inconsistente entre docs: ${parts.join("; ")}`,
    location: `shitenno/${fileA}`,
    recommendation: "Reconciliar listas P0 em todos os documentos",
    confidence: 0.65,
  };
}

export function detectCrossDocP0Contradiction(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const files = [
    "governance/WORKFLOW.md",
    "cognition/context/CONTEXT_HIERARCHY.md",
    "docs/Shitenno_GUIDE.md",
  ];

  const p0Map = new Map<string, Set<string>>();
  for (const file of files) {
    const path = join(shitennoDir, file);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      const p0 = extractP0Refs(content);
      if (p0.size > 0) p0Map.set(file, p0);
    } catch (err) { logger.debug("governance-detectors", "Error in detectCrossDocP0Contradiction:", err); }
  }

  const entries = Array.from(p0Map.entries());
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const entryA = entries[i];
      const entryB = entries[j];
      if (!entryA || !entryB) continue;
      const issue = compareP0Sets(entryA[0], entryA[1], entryB[0], entryB[1]);
      if (issue) issues.push(issue);
    }
  }
  return issues;
}

function scanFileForEmptyFiles(dir: string, files: string[], issues: HealthIssue[]): void {
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = statSync(filePath);
      if (stat.isFile() && stat.size === 0) {
        issues.push({ type: "empty_data_file", severity: 1,
          description: `Ficheiro vazio (0 bytes): ${dir}/${file}`,
          location: `shitenno/${dir}/${file}`, recommendation: `Verificar se ${file} deveria ter conteúdo ou removê-lo`, confidence: 0.95 });
      }
    } catch (statErr) { logger.debug("governance-detectors", "Error checking file stat:", statErr); }
  }
}

function detectEmptyDataFilesInDir(dir: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const dirPath = join(shitennoDir, dir);
  if (!existsSync(dirPath)) return issues;
  try { scanFileForEmptyFiles(dirPath, readdirSync(dirPath), issues); }
  catch (scanErr) { logger.debug("governance-detectors", "Error in detectEmptyDataFiles:", scanErr); }
  return issues;
}

export function detectEmptyDataFiles(shitennoDir: string): HealthIssue[] {
  const dirsToScan = ["telemetry", "reports", "docs/history", "governance/knowledge-graph"];
  return dirsToScan.flatMap((dir) => detectEmptyDataFilesInDir(dir, shitennoDir));
}
