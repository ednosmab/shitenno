/**
 * Config detectors — shared helpers
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export const KNOWN_CORRECTIONS: Record<string, string> = {
  "context_buffer.md": "context_buffer.yaml",
  "context_buffer.json": "context_buffer.yaml",
};

export const EXTENSION_SWAP: Record<string, string> = {
  ".ts": ".json",
  ".json": ".ts",
  ".md": ".yaml",
  ".yaml": ".md",
  ".js": ".ts",
  ".txt": ".md",
};

export const DOCS_TO_SCAN = [
  "docs/AGENTS.md",
  "governance/WORKFLOW.md",
  "docs/CONCEPTUAL_MODEL.md",
  "docs/capabilities.md",
  "cognition/context/CONTEXT_HIERARCHY.md",
  "governance/agents/AI-CONTRACT-reviewer-v1.yaml",
  "governance/agents/AI-CONTRACT-planner-v1.yaml",
  "governance/agents/AI-CONTRACT-orchestrator-v1.yaml",
  "governance/agents/AI-CONTRACT-executor-v1.yaml",
];

export function findFileInDirs(baseName: string, shitennoDir: string, projectRoot: string, docDir: string): boolean {
  return existsSync(join(docDir, baseName)) ||
    existsSync(join(shitennoDir, "governance/context", baseName)) ||
    existsSync(join(shitennoDir, baseName)) ||
    existsSync(join(projectRoot, baseName));
}

export function isBranchConvention(dirPart: string): boolean {
  return ["feat/", "fix/", "hotfix/", "chore/", "docs/", "refactor/"].includes(dirPart) || dirPart.includes("git ") || dirPart.includes("&&");
}
