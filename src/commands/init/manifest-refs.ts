/**
 * commands/init/manifest-refs.ts — Phase 5: knowledge artifact references
 *
 * Knowledge artifacts (ADRs, plans, …) are NEVER copied into `.shitenno/`.
 * Instead a structured reference manifest (`.shitenno/docs/external-index.json`)
 * points at their real locations. `shugo audit` consumes both the native docs
 * set and the referenced set — without duplication or drift risk.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { EXTERNAL_INDEX_REL_PATH } from "../../constants.js";
import type { GovernanceInventory } from "./discovery.js";

export { EXTERNAL_INDEX_REL_PATH };

export const EXTERNAL_INDEX_FILE = "external-index.json";

export type ExternalArtifactType = "adr" | "plan";

export interface ExternalReference {
  type: ExternalArtifactType;
  /** Path relative to the project root. */
  path: string;
}

export interface ExternalIndex {
  version: 1;
  generatedAt: string;
  refs: ExternalReference[];
}

const MARKDOWN_EXTENSION = /\.md$/i;

function collectMarkdownFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MARKDOWN_EXTENSION.test(entry.name))
      .map((entry) => join(dir, entry.name));
  } catch {
    return [];
  }
}

/**
 * Collect references for every knowledge artifact detected in Phase 1.
 * Paths are normalized to be relative to the project root.
 */
export function collectExternalReferences(
  projectRoot: string,
  inventory: GovernanceInventory,
): ExternalReference[] {
  const refs: ExternalReference[] = [];

  for (const dir of inventory.adrDirs) {
    for (const file of collectMarkdownFiles(dir)) {
      refs.push({ type: "adr", path: relative(projectRoot, file) });
    }
  }
  for (const dir of inventory.plansDirs) {
    for (const file of collectMarkdownFiles(dir)) {
      refs.push({ type: "plan", path: relative(projectRoot, file) });
    }
  }

  return refs;
}

/**
 * Write `.shitenno/docs/external-index.json` referencing the real artifact
 * paths. Returns the collected references.
 */
export function writeExternalIndex(
  projectRoot: string,
  shitennoDir: string,
  inventory: GovernanceInventory,
): ExternalReference[] {
  const refs = collectExternalReferences(projectRoot, inventory);
  const manifest: ExternalIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    refs,
  };
  const manifestPath = join(shitennoDir, EXTERNAL_INDEX_REL_PATH);
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  return refs;
}

/**
 * Whether a reference manifest exists for a given shitenno dir.
 */
export function externalIndexExists(shitennoDir: string): boolean {
  return existsSync(join(shitennoDir, EXTERNAL_INDEX_REL_PATH));
}