/**
 * sbom-generator.ts — CycloneDX SBOM Generator (local, no external services)
 *
 * Reads package.json + lock file (pnpm-lock.yaml, package-lock.json, yarn.lock)
 * and generates a CycloneDX 1.5 compliant SBOM JSON.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";

export interface CycloneDXComponent {
  name: string;
  version: string;
  type: "library";
  "bom-ref": string;
  description?: string;
  licenses?: Array<{ license: { id: string } }>;
  properties?: Array<{ name: string; value: string }>;
}

export interface CycloneDXBom {
  bomFormat: "CycloneDX";
  specVersion: "1.5";
  version: 1;
  metadata: {
    timestamp: string;
    tools: Array<{ vendor: "shitenno", name: "audit", version: string }>;
  };
  components: CycloneDXComponent[];
  dependencies: Array<{ ref: string; dependsOn: string[] }>;
}

/** Parse pnpm-lock.yaml to extract dependency versions */
function parsePnpmLock(lockContent: string): Map<string, string> {
  const versions = new Map<string, string>();
  // Match patterns like "  lodash@4.17.21:" or "  /lodash/4.17.21:"
  const versionPattern = /^\s+(?:\/[^/]+\/)?([^@\s]+)@(\d+\.\d+\.\d+[\w.-]*)/gm;
  let match: RegExpExecArray | null;
  while ((match = versionPattern.exec(lockContent)) !== null) {
    const name = match[1];
    const version = match[2];
    if (name && version && !versions.has(name)) {
      versions.set(name, version);
    }
  }
  return versions;
}

/** Parse package-lock.json v2/v3 to extract dependency versions */
function parsePackageLock(lockContent: string): Map<string, string> {
  const versions = new Map<string, string>();
  try {
    const lock = JSON.parse(lockContent);
    // v2/v3 format
    if (lock.packages) {
      for (const [key, value] of Object.entries(lock.packages)) {
        if (key === "") continue; // root
        const name = key.replace(/^node_modules\//, "").replace(/.*node_modules\//, "");
        const val = value as { version?: string };
        if (val?.version && !versions.has(name)) {
          versions.set(name, val.version);
        }
      }
    }
    // v1 format
    if (lock.dependencies) {
      for (const [name, value] of Object.entries(lock.dependencies)) {
        const val = value as { version?: string };
        if (val?.version && !versions.has(name)) {
          versions.set(name, val.version);
        }
      }
    }
  } catch { /* malformed lock file */ }
  return versions;
}

/** Parse yarn.lock to extract dependency versions */
function parseYarnLock(lockContent: string): Map<string, string> {
  const versions = new Map<string, string>();
  const pattern = /^"?([^@\s"]+)@[^"]*":\s*\n\s+version:? "?(\d+\.\d+\.\d+[\w.-]*)"?/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lockContent)) !== null) {
    const name = match[1];
    const version = match[2];
    if (name && version && !versions.has(name)) {
      versions.set(name, version);
    }
  }
  return versions;
}

/** Read and parse the lock file to extract dependency versions */
function readLockFileVersions(projectRoot: string): Map<string, string> {
  const lockFiles = [
    { path: "pnpm-lock.yaml", parser: parsePnpmLock },
    { path: "package-lock.json", parser: parsePackageLock },
    { path: "yarn.lock", parser: parseYarnLock },
  ];

  for (const { path: lockPath, parser } of lockFiles) {
    const fullPath = join(projectRoot, lockPath);
    if (existsSync(fullPath)) {
      try {
        const content = readFileSync(fullPath, "utf-8");
        return parser(content);
      } catch { /* try next */ }
    }
  }

  return new Map();
}

/** Generate a BOM-ref from package name */
function bomRef(name: string, version: string): string {
  return `pkg:npm/${name}@${version}`;
}

/**
 * Generate a CycloneDX SBOM from the project's package.json + lock file.
 * Returns the SBOM as a JSON object. Does NOT write to disk (caller decides).
 */
export function generateSBOM(projectRoot: string): CycloneDXBom | null {
  const packageJsonPath = join(projectRoot, "package.json");
  if (!existsSync(packageJsonPath)) return null;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const allDeps: Record<string, string> = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const lockVersions = readLockFileVersions(projectRoot);

    const components: CycloneDXComponent[] = [];
    const dependencies: Array<{ ref: string; dependsOn: string[] }> = [];

    for (const [name, declaredVersion] of Object.entries(allDeps)) {
      const version = lockVersions.get(name) ?? (typeof declaredVersion === "string" ? declaredVersion.replace(/^[~^>=<]/, "") : "0.0.0");
      const ref = bomRef(name, version);

      const component: CycloneDXComponent = {
        name,
        version,
        type: "library",
        "bom-ref": ref,
        properties: [
          { name: "declaredVersion", value: typeof declaredVersion === "string" ? declaredVersion : "unknown" },
        ],
      };

      components.push(component);
      dependencies.push({ ref, dependsOn: [] });
    }

    const bom: CycloneDXBom = {
      bomFormat: "CycloneDX",
      specVersion: "1.5",
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [{ vendor: "shitenno", name: "audit", version: "1.0.0" }],
      },
      components,
      dependencies,
    };

    return bom;
  } catch (err) {
    logger.debug("sbom-generator", "Error generating SBOM", { error: err });
    return null;
  }
}

/**
 * Write the SBOM to disk as sbom.json in CycloneDX format.
 */
export function writeSBOM(projectRoot: string): boolean {
  const bom = generateSBOM(projectRoot);
  if (!bom) return false;

  try {
    const outputPath = join(projectRoot, "sbom.json");
    writeFileSync(outputPath, JSON.stringify(bom, null, 2), "utf-8");
    return true;
  } catch {
    return false;
  }
}
