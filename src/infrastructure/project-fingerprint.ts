/**
 * project-fingerprint.ts — Project Identity & Domain Detection
 *
 * Generates a unique fingerprint for the project based on:
 * - Tech stack (dependencies)
 * - Domain detection (folder names, imports)
 * - Scale (packages, apps, files)
 * - Tooling (TypeScript, tests, CI)
 *
 * PRINCIPLE: To help the project, Shugo must first understand it.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { ProjectAnalysis } from "./analyser.js";

// ── Types ──────────────────────────────────────────────────────────────────

export type ProjectDomain =
  | "web-app"
  | "api"
  | "library"
  | "mobile"
  | "monorepo"
  | "data-pipeline"
  | "cli-tool"
  | "desktop"
  | "unknown";

export type ProjectScale = "tiny" | "small" | "medium" | "large" | "enterprise";

export interface ProjectFingerprint {
  /** Hash of the fingerprint (for change detection) */
  hash: string;
  /** When the fingerprint was generated */
  detectedAt: string;
  /** Detected project domain */
  domain: ProjectDomain;
  /** Tech stack detected */
  stack: string[];
  /** Project scale */
  scale: ProjectScale;
  /** Tooling present */
  tooling: {
    typescript: boolean;
    tests: boolean;
    ci: boolean;
    linter: boolean;
    monorepo: boolean;
  };
  /** Maturity score (if available) */
  maturityScore?: number;
  /** Version of the fingerprint format */
  version: number;
}

// ── Domain Detection ───────────────────────────────────────────────────────

const DOMAIN_SIGNALS: Record<ProjectDomain, string[]> = {
  "web-app": ["next", "nuxt", "gatsby", "remix", "vite", "react", "vue", "svelte", "angular"],
  "api": ["express", "fastify", "hono", "trpc", "graphql", "nestjs", "koa"],
  "library": [],
  "mobile": ["expo", "react-native", "flutter", "capacitor"],
  "monorepo": ["turborepo", "nx", "lerna"],
  "data-pipeline": ["apache-airflow", "dbt", "prefect", "dagster"],
  "cli-tool": ["commander", "yargs", "meow", "oclif"],
  "desktop": ["electron", "tauri", "nw.js"],
  "unknown": [],
};

function detectDomain(analysis: ProjectAnalysis): ProjectDomain {
  // Check monorepo first (structural signal)
  if (analysis.monorepo) return "monorepo";

  // Check stack for domain signals
  for (const [domain, signals] of Object.entries(DOMAIN_SIGNALS)) {
    if (domain === "monorepo" || domain === "unknown") continue;
    for (const signal of signals) {
      if (analysis.stack.some((s) => s.toLowerCase().includes(signal))) {
        return domain as ProjectDomain;
      }
    }
  }

  // Check if it's a library (no apps, few packages)
  if (analysis.appCount === 0 && analysis.packageCount <= 1) {
    return "library";
  }

  return "unknown";
}

// ── Scale Detection ────────────────────────────────────────────────────────

function detectScale(analysis: ProjectAnalysis): ProjectScale {
  const fileCount = analysis.sourceFileCount;
  const depCount = analysis.dependencyCount;

  if (fileCount > 1000 || depCount > 200) return "enterprise";
  if (fileCount > 500 || depCount > 100) return "large";
  if (fileCount > 100 || depCount > 50) return "medium";
  if (fileCount > 20 || depCount > 10) return "small";
  return "tiny";
}

// ── Fingerprint Generation ─────────────────────────────────────────────────

export function generateProjectFingerprint(
  _projectRoot: string,
  analysis: ProjectAnalysis,
  maturityScore?: number
): ProjectFingerprint {
  const domain = detectDomain(analysis);
  const scale = detectScale(analysis);

  const fingerprint: ProjectFingerprint = {
    hash: "",
    detectedAt: new Date().toISOString(),
    domain,
    stack: analysis.stack,
    scale,
    tooling: {
      typescript: analysis.hasTypeScript,
      tests: analysis.hasTests,
      ci: analysis.hasCI,
      linter: analysis.hasLinter,
      monorepo: analysis.monorepo,
    },
    maturityScore,
    version: 1,
  };

  // Generate hash from fingerprint data
  const hashData = JSON.stringify({
    domain,
    stack: [...analysis.stack].sort(),
    scale,
    tooling: fingerprint.tooling,
  });
  fingerprint.hash = createHash("sha256").update(hashData).digest("hex").slice(0, 12);

  return fingerprint;
}

// ── Persistence ────────────────────────────────────────────────────────────

export function saveFingerprint(shitennoDir: string, fingerprint: ProjectFingerprint): void {
  const dir = join(shitennoDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const filePath = join(dir, "fingerprint.json");
  writeFileSync(filePath, JSON.stringify(fingerprint, null, 2), "utf-8");
}

export function loadFingerprint(shitennoDir: string): ProjectFingerprint | null {
  const filePath = join(shitennoDir, "fingerprint.json");
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function isFingerprintStale(shitennoDir: string, maxAgeDays = 7): boolean {
  const fingerprint = loadFingerprint(shitennoDir);
  if (!fingerprint) return true;
  const age = Date.now() - new Date(fingerprint.detectedAt).getTime();
  return age > maxAgeDays * 24 * 60 * 60 * 1000;
}
