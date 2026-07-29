/**
 * risk-map.ts — Project Risk Mapping
 *
 * Maps project areas to risk levels based on:
 * - Test coverage (files without tests)
 * - Code churn (git log correlation)
 * - File size (large files = higher risk)
 * - Import complexity (many imports = higher coupling)
 *
 * PRINCIPLE: Risk should be visible before it becomes incident.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "./logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RiskFactor {
  /** Factor type */
  type: "no-tests" | "high-churn" | "large-file" | "many-imports" | "no-types" | "sensitive-keyword";
  /** Factor description */
  description: string;
  /** Factor weight (0-1) */
  weight: number;
}

export interface RiskArea {
  /** Directory path relative to project root */
  path: string;
  /** Overall risk level */
  riskLevel: RiskLevel;
  /** Risk score (0-100) */
  score: number;
  /** Contributing risk factors */
  factors: RiskFactor[];
  /** Number of source files in area */
  fileCount: number;
}

export interface RiskMap {
  /** When the risk map was generated */
  generatedAt: string;
  /** Overall project risk level */
  overallRisk: RiskLevel;
  /** Overall risk score (0-100) */
  overallScore: number;
  /** All mapped areas */
  areas: RiskArea[];
  /** Summary */
  summary: string;
}

// ── Risk Detection ─────────────────────────────────────────────────────────

const SENSITIVE_KEYWORDS = ["auth", "payment", "security", "session", "token", "password", "secret"];

function getSourceFiles(dir: string, extensions = [".ts", ".tsx", ".js", ".jsx"]): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...getSourceFiles(fullPath, extensions));
      } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.debug("risk-map", `Permission error reading ${dir}: ${err}`);
  }
  return files;
}

function hasTestFile(filePath: string): boolean {
  const base = filePath.replace(/\.(ts|tsx|js|jsx)$/, "");
  const testPatterns = [
    `${base}.test.ts`,
    `${base}.test.tsx`,
    `${base}.spec.ts`,
    `${base}.spec.tsx`,
    `${base}.test.js`,
    `${base}.spec.js`,
  ];
  return testPatterns.some((p) => existsSync(p));
}

function getFileLineCount(content: string): number {
  return content.split("\n").length;
}

function getImportCount(content: string): number {
  const importMatches = content.match(/^import\s+.*from\s+["'].*["']/gm) || [];
  return importMatches.length;
}

function getChurnData(projectRoot: string): Map<string, number> {
  const churn = new Map<string, number>();
  try {
    const output = execSync(
      'git log --pretty=format:"" --name-only --since="90 days ago" 2>/dev/null | sort | uniq -c | sort -rn | head -50',
      { encoding: "utf-8", cwd: projectRoot, timeout: 10000 }
    );
    for (const line of output.trim().split("\n")) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/);
      if (match && match[1] && match[2]) {
        churn.set(match[2], parseInt(match[1], 10));
      }
    }
  } catch (err) {
    logger.debug("risk-map", `Git not available or no history: ${err}`);
  }
  return churn;
}

function detectSensitiveKeywords(content: string): boolean {
  const lower = content.toLowerCase();
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function evaluateFileRisk(
  file: string,
  projectRoot: string,
  churnData: Map<string, number>
): { factors: RiskFactor[]; score: number } {
  const relPath = relative(projectRoot, file);
  const factors: RiskFactor[] = [];
  let score = 0;

  if (!hasTestFile(file)) {
    factors.push({ type: "no-tests", description: `No test file for ${relPath}`, weight: 0.3 });
    score += 15;
  }

  const churn = churnData.get(relPath) || 0;
  if (churn > 10) {
    factors.push({ type: "high-churn", description: `${relPath} changed ${churn} times in 90 days`, weight: 0.25 });
    score += 10;
  }

  let content: string;
  try {
    content = readFileSync(file, "utf-8");
  } catch {
    return { factors, score };
  }

  const lineCount = getFileLineCount(content);
  if (lineCount > 300) {
    factors.push({ type: "large-file", description: `${relPath} has ${lineCount} lines`, weight: 0.2 });
    score += 8;
  }

  const importCount = getImportCount(content);
  if (importCount > 15) {
    factors.push({ type: "many-imports", description: `${relPath} has ${importCount} imports`, weight: 0.15 });
    score += 5;
  }

  if (detectSensitiveKeywords(content)) {
    factors.push({ type: "sensitive-keyword", description: `${relPath} contains sensitive keywords`, weight: 0.1 });
    score += 3;
  }

  return { factors, score };
}

function determineRiskLevel(score: number): RiskLevel {
  if (score >= 70) return "critical";
  if (score >= 40) return "high";
  if (score >= 15) return "medium";
  return "low";
}

function analyzeArea(
  projectRoot: string,
  areaPath: string,
  churnData: Map<string, number>
): RiskArea {
  const fullPath = join(projectRoot, areaPath);
  const files = getSourceFiles(fullPath);
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  for (const file of files) {
    const result = evaluateFileRisk(file, projectRoot, churnData);
    factors.push(...result.factors);
    totalScore += result.score;
  }

  const normalizedScore = Math.min(100, totalScore);

  return {
    path: areaPath,
    riskLevel: determineRiskLevel(normalizedScore),
    score: normalizedScore,
    factors: factors.slice(0, 10),
    fileCount: files.length,
  };
}

// ── Main Function ──────────────────────────────────────────────────────────

export function generateRiskMap(projectRoot: string, _shitennoDir: string): RiskMap {
  const areas: RiskArea[] = [];
  const churnData = getChurnData(projectRoot);

  // Detect areas to analyze
  const possibleAreas = ["src", "lib", "packages", "apps", "pages", "components", "services", "utils"];

  for (const area of possibleAreas) {
    const areaPath = area;
    const fullPath = join(projectRoot, areaPath);
    if (existsSync(fullPath)) {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        areas.push(analyzeArea(projectRoot, areaPath, churnData));
      }
    }
  }

  // If no standard areas found, analyze root src/ or project root
  if (areas.length === 0) {
    const srcPath = join(projectRoot, "src");
    if (existsSync(srcPath)) {
      areas.push(analyzeArea(projectRoot, "src", churnData));
    } else {
      areas.push(analyzeArea(projectRoot, ".", churnData));
    }
  }

  // Calculate overall score
  const totalScore = areas.reduce((sum, a) => sum + a.score, 0);
  const overallScore = areas.length > 0 ? Math.round(totalScore / areas.length) : 0;

  // Determine overall risk level
  let overallRisk: RiskLevel;
  if (overallScore >= 70) overallRisk = "critical";
  else if (overallScore >= 40) overallRisk = "high";
  else if (overallScore >= 15) overallRisk = "medium";
  else overallRisk = "low";

  // Generate summary
  const criticalAreas = areas.filter((a) => a.riskLevel === "critical" || a.riskLevel === "high");
  const summary = criticalAreas.length > 0
    ? `${criticalAreas.length} area(s) with high/critical risk detected. Focus on: ${criticalAreas.map((a) => a.path).join(", ")}`
    : "All areas within acceptable risk levels.";

  return {
    generatedAt: new Date().toISOString(),
    overallRisk,
    overallScore,
    areas,
    summary,
  };
}
