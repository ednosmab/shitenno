/**
 * scaffold/gitignore.ts — Gitignore Management for Scaffolding
 */

import fse from "fs-extra";
const { readFileSync, writeFileSync, existsSync } = fse;
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";

export function updateGitignore(targetDir: string): void {
  const gitignorePath = join(targetDir, ".gitignore");
  let gitignoreContent = "";
  if (existsSync(gitignorePath)) gitignoreContent = readFileSync(gitignorePath, "utf-8");

  const entries: Array<{ pattern: string; comment: string }> = [
    { pattern: `${SHITENNO_DIR_NAME}/.cache/`, comment: "Shitenno — runtime cache" },
    { pattern: `${SHITENNO_DIR_NAME}/daemon/`, comment: "Shitenno — daemon state (pid, sock, log, state)" },
    { pattern: `${SHITENNO_DIR_NAME}/telemetry/`, comment: "Shitenno — session telemetry" },
    { pattern: `${SHITENNO_DIR_NAME}/feedback/records/`, comment: "Shitenno — session feedback records" },
    { pattern: `${SHITENNO_DIR_NAME}/feedback/summary.json`, comment: "Shitenno — feedback summary" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/executions/`, comment: "Shitenno — execution logs" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/context/checkpoints/`, comment: "Shitenno — context checkpoints" },
    { pattern: `${SHITENNO_DIR_NAME}/governance/context/context_buffer.yaml`, comment: "Shitenno — context buffer (auto-generated)" },
    { pattern: `${SHITENNO_DIR_NAME}/docs/generated/`, comment: "Shitenno — generated docs" },
    { pattern: `${SHITENNO_DIR_NAME}/docs/feedback/`, comment: "Shitenno — session feedback (private)" },
  ];

  let appended = false;
  for (const entry of entries) {
    if (!gitignoreContent.includes(entry.pattern)) {
      gitignoreContent += `\n# ${entry.comment}\n${entry.pattern}\n`;
      appended = true;
    }
  }

  if (appended) {
    writeFileSync(gitignorePath, gitignoreContent, "utf-8");
  }
}
