/**
 * AGENTS.md update logic for upgrade command.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import { getTemplatesDir } from "../../shared/paths.js";
import type { Capability } from "../../application/maturity-profile.js";

export function updateAgentsMdWithCapabilities(
  targetDir: string,
  installedCapabilities: Capability[]
): void {
  const agentsMdPath = join(targetDir, SHITENNO_DIR_NAME, "docs", "AGENTS.md");
  if (!existsSync(agentsMdPath)) return;

  const templatesDir = getTemplatesDir();
  const templatePath = join(templatesDir, "docs", "AGENTS.md");
  if (!existsSync(templatePath)) return;

  let content = readFileSync(templatePath, "utf-8");
  content = filterAgentsMdByCapabilities(content, installedCapabilities);
  writeFileSync(agentsMdPath, content, "utf-8");
}

function filterAgentsMdByCapabilities(
  content: string,
  installedCapabilities: Capability[]
): string {
  const capabilityBlockRegex = /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g;
  return content.replace(capabilityBlockRegex, (match, capability: string) => {
    if (installedCapabilities.includes(capability as Capability)) {
      return match.replace(/<!-- CAPABILITY: \w+ -->\n?/, "").replace(/<!-- \/CAPABILITY -->\n?$/, "");
    }
    return "";
  });
}
