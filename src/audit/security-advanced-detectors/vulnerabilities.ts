/**
 * Transitive vulnerability and dependency staleness detectors.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseVersion(version: string): { major: number; minor: number; clean: string } | null {
  const clean = version.replace(/^[~^>=<]/, "");
  const m = clean.match(/^(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: parseInt(m[1]!, 10), minor: parseInt(m[2]!, 10), clean };
}

function collectStaleDeps(allDeps: Record<string, string>) {
  const zeroX: string[] = [];
  const loose: string[] = [];
  const preV1: string[] = [];
  for (const [name, ver] of Object.entries(allDeps)) {
    if (typeof ver !== "string") continue;
    const v = parseVersion(ver);
    if (v && v.major === 0 && v.minor < 10) zeroX.push(`${name}@${ver}`);
    if (ver === "*" || ver === "latest" || ver === ">=0.0.0") loose.push(`${name}@${ver}`);
    if (v && v.major === 0 && ver.startsWith("^")) preV1.push(`${name}@${ver}`);
  }
  return { zeroX, loose, preV1 };
}

function countZeroXInLock(projectRoot: string): number {
  const f = ["pnpm-lock.yaml", "package-lock.json", "yarn.lock"].find((x) => existsSync(join(projectRoot, x)));
  if (!f) return 0;
  const seen = new Set<string>();
  const pat = /@0\.\d+\.\d+/g;
  let m: RegExpExecArray | null;
  while ((m = pat.exec(readFileSync(join(projectRoot, f), "utf-8"))) !== null) seen.add(m[0]);
  return seen.size;
}

// ── 13.5 Transitive Vulnerabilities ─────────────────────────────────────────

export function detectTransitiveVulns(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lockFilePath = join(projectRoot, "pnpm-lock.yaml");

  if (!existsSync(lockFilePath)) return issues;

  const lockContent = readFileSync(lockFilePath, "utf-8");
  const versionPattern = /(\d+\.\d+\.\d+)/g;
  const versions = lockContent.match(versionPattern) || [];

  const oldVersions = versions.filter((v) => {
    const [major] = v.split(".").map(Number);
    return major === 0;
  });

  if (oldVersions.length > 5) {
    issues.push({
      type: "transitive_vuln",
      severity: 2,
      description: `${oldVersions.length} dependências com versões 0.x detectadas (possivelmente instáveis)`,
      location: "pnpm-lock.yaml",
      recommendation: "Rever dependências 0.x para estabilidade e possíveis vulnerabilidades.",
      confidence: 0.9,
    });
  }

  return issues;
}

// ── 13.7 Dependency Staleness ──────────────────────────────────────────────

export function detectDependencyStaleness(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pjPath = join(projectRoot, "package.json");
  if (!existsSync(pjPath)) return issues;

  const pj = JSON.parse(readFileSync(pjPath, "utf-8"));
  const cls = collectStaleDeps({ ...pj.dependencies, ...pj.devDependencies });
  const loc = "package.json";

  const lockZeroX = countZeroXInLock(projectRoot);
  if (lockZeroX > 10) {
    issues.push({ type: "transitive_vuln", severity: 1, description: `${lockZeroX} dependências transitivas 0.x no lock file`, location: "lock file", recommendation: "Rever dependências 0.x transitivas", confidence: 0.7 });
  }
  if (cls.zeroX.length > 3) {
    issues.push({ type: "outdated_dependencies", severity: 2, description: `${cls.zeroX.length} dependências diretas 0.x: ${cls.zeroX.slice(0, 5).join(", ")}`, location: loc, recommendation: "Atualizar para versões 1.0+", confidence: 0.8 });
  }
  if (cls.loose.length > 0) {
    issues.push({ type: "outdated_dependencies", severity: 2, description: `${cls.loose.length} ranges soltos ("*" ou "latest"): ${cls.loose.join(", ")}`, location: loc, recommendation: "Fixar versões ou usar ranges específicos", confidence: 0.85 });
  }
  if (cls.preV1.length > 5) {
    issues.push({ type: "outdated_dependencies", severity: 1, description: `${cls.preV1.length} deps 0.x com range ^ — permite breaking changes`, location: loc, recommendation: 'Usar "~" ou fixar versão exata', confidence: 0.75 });
  }

  return issues;
}
