/**
 * System map update logic for upgrade command.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { updateSystemMapCapabilityStatus } from "../../infrastructure/scaffolder.js";
import { getTemplatesDir } from "../../shared/paths.js";
import type { Capability } from "../../application/maturity-profile.js";

export function updateSystemMapStatus(
  targetDir: string,
  installedCapabilities: Capability[]
): void {
  const systemMapPath = join(targetDir, SHITENNO_DIR_NAME, "governance", "SYSTEM_MAP.md");
  if (!existsSync(systemMapPath)) return;

  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, "governance", "SYSTEM_MAP.md");
  if (!existsSync(templatePath)) return;

  let content = readFileSync(templatePath, "utf-8");
  content = updateSystemMapCapabilityStatus(content, installedCapabilities);
  writeFileSync(systemMapPath, content, "utf-8");
}
