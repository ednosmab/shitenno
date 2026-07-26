/**
 * Docs detectors — shared helpers
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../logger.js";
import { PLACEHOLDER_NAMES } from "../constants.js";

export function collectEmptyDirsSync(
  dirPath: string,
  relativePath: string,
  skipDirs: Set<string>,
  results: string[],
): void {
  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch (err) {
    logger.debug("docs/helpers", "Cannot scan directory:", err);
    return;
  }

  const realEntries = entries.filter((e) => !PLACEHOLDER_NAMES.has(e.name));

  if (realEntries.length === 0 && relativePath !== "") {
    results.push(relativePath);
  }

  for (const entry of entries) {
    if (entry.isDirectory() && !skipDirs.has(entry.name)) {
      const childRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      collectEmptyDirsSync(join(dirPath, entry.name), childRelative, skipDirs, results);
    }
  }
}

export function collectBacktickRefs(content: string): Set<string> {
  const refs = new Set<string>();
  const regex = /`([a-zA-Z0-9_/.-]+\.(?:md|ts|js|yaml|json))`/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    if (m[1]) refs.add(m[1]);
  }
  return refs;
}

export function isTemplateRef(ref: string): boolean {
  return ref.includes("*") || ref.includes("<") || ref.includes("[") || ref.includes("YYYY") || ref.includes("MM-DD");
}

export function refExists(ref: string, docDir: string, shitennoDir: string, projectRoot: string): boolean {
  return existsSync(join(docDir, ref)) || existsSync(join(shitennoDir, ref)) || existsSync(join(projectRoot, ref));
}
