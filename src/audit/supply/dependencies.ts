import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../shared/logger.js";
import { safeJsonParseValidated, isRecord } from "../../shared/validation-utils.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";

const NODE_BUILTINS = new Set([
  "fs", "path", "os", "child_process", "util", "events", "stream", "http", "https",
  "url", "crypto", "assert", "buffer", "zlib", "net", "tls", "dns", "readline",
  "worker_threads", "perf_hooks", "v8", "vm", "module", "constants", "querystring",
  "string_decoder", "timers", "tty", "punycode", "domain", "cluster", "dgram",
  "dns/promises", "fs/promises", "path/posix", "path/win32",
]);
for (const builtin of [...NODE_BUILTINS]) NODE_BUILTINS.add(`node:${builtin}`);

function extractPackageName(spec: string): string {
  return spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0] ?? spec;
}

function isUndeclaredPackage(pkgName: string, declaredDeps: Set<string>): boolean {
  return !NODE_BUILTINS.has(pkgName) && !declaredDeps.has(pkgName);
}

function scanFileForUndeclaredDeps(content: string, relPath: string, declaredDeps: Set<string>, usedPackages: Map<string, string>): void {
  const importRegex = /(?:from|import)\s+["']([^"'\.\/][^"']*)["']/g;
  const requireRegex = /require\s*\(\s*["']([^"'\.\/][^"']*)["']\s*\)/g;
  let match;
  importRegex.lastIndex = 0;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;
    const pkgName = extractPackageName(importPath);
    if (pkgName && isUndeclaredPackage(pkgName, declaredDeps) && !usedPackages.has(pkgName)) usedPackages.set(pkgName, relPath);
  }
  requireRegex.lastIndex = 0;
  while ((match = requireRegex.exec(content)) !== null) {
    const importPath = match[1];
    if (!importPath) continue;
    const pkgName = extractPackageName(importPath);
    if (pkgName && isUndeclaredPackage(pkgName, declaredDeps) && !usedPackages.has(pkgName)) usedPackages.set(pkgName, relPath);
  }
}

export function detectPhantomDependencies(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;
  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectPhantomDependencies");
    if (!pkg) return issues;
    const declaredDeps = new Set([
      ...Object.keys((pkg as Record<string, unknown>).dependencies ?? {}),
      ...Object.keys((pkg as Record<string, unknown>).devDependencies ?? {}),
      ...Object.keys((pkg as Record<string, unknown>).peerDependencies ?? {}),
    ]);
    const usedPackages = new Map<string, string>();
    for (const file of files) scanFileForUndeclaredDeps(file.content, file.relPath, declaredDeps, usedPackages);
    if (usedPackages.size > 0) {
      const phantomList = Array.from(usedPackages.entries()).map(([pkg, file]) => `${pkg} (usado em ${file})`);
      issues.push({ type: "phantom_dep", severity: 2,
        description: `${usedPackages.size} dependência(s) usada(s) mas não declarada(s): ${phantomList.slice(0, 5).join(", ")}${phantomList.length > 5 ? ` (+${phantomList.length - 5})` : ""}`,
        location: "package.json", recommendation: `Adicionar ao package.json: ${Array.from(usedPackages.keys()).slice(0, 3).join(", ")}`, confidence: 0.75 });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectPhantomDependencies:", err); }
  return issues;
}

export function detectDeprecatedPackages(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return issues;

  try {
    const pkg = safeJsonParseValidated(readFileSync(pkgPath, "utf-8"), isRecord, "supply:detectDeprecatedPackages");
    if (!pkg) return issues;
    const allDeps = {
      ...((pkg as Record<string, unknown>).dependencies as Record<string, unknown> ?? {}),
      ...((pkg as Record<string, unknown>).devDependencies as Record<string, unknown> ?? {}),
    };

    const KNOWN_DEPRECATED: Record<string, string> = {
      "request": "Use node-fetch, axios, ou got em vez de request",
      "tslint": "Usar ESLint com @typescript-eslint em vez de tslint",
      "node-uuid": "Usar crypto.randomUUID() ou uuid package",
      "nomnom": "Usar commander ou yargs em vez de nomnom",
      "natives": "Removido — não necessário em Node.js moderno",
      "left-pad": "Usar String.prototype.padStart() em vez de left-pad",
      "istanbul": "Usar nyc ou c8 em vez de istanbul",
      "es5-ext": "Usar nativos ES6+ em vez de es5-ext",
    };

    const deprecated: string[] = [];
    for (const name of Object.keys(allDeps)) {
      if (KNOWN_DEPRECATED[name]) {
        deprecated.push(`${name} → ${KNOWN_DEPRECATED[name]}`);
      }
    }

    if (deprecated.length > 0) {
      issues.push({
        type: "deprecated_package",
        severity: 2,
        description: `${deprecated.length} dependência(s) deprecated: ${deprecated.slice(0, 3).join(", ")}${deprecated.length > 3 ? ` (+${deprecated.length - 3})` : ""}`,
        location: "package.json",
        recommendation: `Substituir dependências deprecated: ${deprecated.slice(0, 2).join("; ")}`,
        confidence: 0.9,
      });
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectDeprecatedPackages:", err); }
  return issues;
}
