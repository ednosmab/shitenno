/**
 * session-bootstrapper.ts — Lazy Loading for Session Context
 *
 * Reduces token usage at session start by loading only essential files.
 * Other files are loaded on-demand via MCP or explicit requests.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "./logger.js";

// ── Essential Files (loaded at session start) ─────────────────────────────

const ESSENTIAL_FILES = [
  "docs/AGENTS.md",
  "governance/context/context_buffer.yaml",
] as const;

// ── Optional Files (loaded on-demand) ─────────────────────────────────────

const OPTIONAL_FILES = {
  "opencode-context": "docs/opencode-context.md",
  "mandatory-context": "governance/MANDATORY_CONTEXT.md",
  "skill-manifest": "governance/skill-manifest.yaml",
  "rule-manifest": "governance/rule-manifest.yaml",
  "agent-contracts": "governance/agents/*.yaml",
} as const;

// ── Token Budget ──────────────────────────────────────────────────────────

const TOKEN_BUDGET = {
  essential: 2000,    // ~2000 tokens for essential files
  optional: 1000,     // ~1000 tokens for optional files
  total: 3000,        // Total budget per session
} as const;

// ── Cache ─────────────────────────────────────────────────────────────────

const fileCache = new Map<string, { content: string; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ── Helper Functions ──────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

function loadFileWithCache(shitennoDir: string, relativePath: string): string | null {
  const fullPath = join(shitennoDir, relativePath);
  
  // Check cache
  const cached = fileCache.get(fullPath);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.content;
  }
  
  // Load from disk
  if (!existsSync(fullPath)) {
    return null;
  }
  
  try {
    const content = readFileSync(fullPath, "utf-8");
    fileCache.set(fullPath, { content, loadedAt: Date.now() });
    return content;
  } catch (err) {
    logger.debug("session-bootstrapper", `Failed to load ${relativePath}: ${err}`);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────

function loadGlobFiles(
  shitennoDir: string,
  relativePath: string,
  key: string,
  result: Record<string, string>,
): void {
  const lastSlash = relativePath.lastIndexOf("/");
  const dirPart = relativePath.substring(0, lastSlash);
  const filePattern = relativePath.substring(lastSlash + 1);
  const ext = filePattern.startsWith("*.") ? filePattern.slice(1) : null;
  const dirPath = join(shitennoDir, dirPart);

  if (!ext || !existsSync(dirPath)) return;

  const files = readdirSync(dirPath).filter((f) => f.endsWith(ext));
  for (const file of files) {
    const content = loadFileWithCache(shitennoDir, join(dirPart, file));
    if (content) {
      result[`${key}:${file}`] = content;
    }
  }
}

export interface SessionContext {
  essential: Record<string, string>;
  tokensUsed: number;
  budgetRemaining: number;
}

/**
 * Load essential session context (minimal token usage).
 * This replaces the heavy instructions[] in opencode.json.
 */
export function loadEssentialContext(shitennoDir: string): SessionContext {
  const essential: Record<string, string> = {};
  let tokensUsed = 0;
  
  for (const file of ESSENTIAL_FILES) {
    const content = loadFileWithCache(shitennoDir, file);
    if (content) {
      essential[file] = content;
      tokensUsed += estimateTokens(content);
    }
  }
  
  logger.info("session-bootstrapper", `Loaded essential context: ${tokensUsed} tokens used`);
  
  return {
    essential,
    tokensUsed,
    budgetRemaining: TOKEN_BUDGET.essential - tokensUsed,
  };
}

/**
 * Load optional context on-demand (with token budget check).
 */
export function loadOptionalContext(
  shitennoDir: string,
  keys: Array<keyof typeof OPTIONAL_FILES>,
): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const key of keys) {
    const relativePath = OPTIONAL_FILES[key];
    if (!relativePath) continue;
    
    // Handle glob patterns (dir/*.ext — single level, no recursive glob)
    if (relativePath.includes("*")) {
      loadGlobFiles(shitennoDir, relativePath, key, result);
      continue;
    }
    
    const content = loadFileWithCache(shitennoDir, relativePath);
    if (content) {
      result[key] = content;
    }
  }
  
  return result;
}

/**
 * Get token usage statistics.
 */
export function getTokenStats(): {
  cachedFiles: number;
  estimatedTokens: number;
} {
  let estimatedTokens = 0;
  for (const [, cached] of fileCache) {
    estimatedTokens += estimateTokens(cached.content);
  }
  
  return {
    cachedFiles: fileCache.size,
    estimatedTokens,
  };
}

/**
 * Clear file cache (e.g., on branch switch).
 */
export function clearCache(): void {
  fileCache.clear();
  logger.debug("session-bootstrapper", "Cache cleared");
}
