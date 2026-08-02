import { Command } from "commander";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";

const UNCOMMITTED_FILES_THRESHOLD = 20;
const UNCOMMITTED_MINUTES_THRESHOLD = 120;

function getUncommittedDrift(projectRoot: string): { filesChanged: number; minutesSinceLastCommit: number } {
  let filesChanged = 0;
  try {
    const diffStat = execSync("git diff --stat HEAD 2>/dev/null || true", { cwd: projectRoot, encoding: "utf-8" });
    filesChanged = diffStat.trim() ? diffStat.trim().split("\n").length - 1 : 0;
  } catch { /* ignore git diff error */ }

  let minutesSinceLastCommit = 0;
  try {
    const lastCommitEpoch = execSync("git log -1 --format=%ct", { cwd: projectRoot, encoding: "utf-8" }).trim();
    if (lastCommitEpoch) {
      minutesSinceLastCommit = (Date.now() / 1000 - Number(lastCommitEpoch)) / 60;
    }
  } catch { /* sem commits ainda — não alarmar */ }

  return { filesChanged, minutesSinceLastCommit };
}

export function scheduledCheck(projectRoot: string, _shitennoDir: string): void {
  const drift = getUncommittedDrift(projectRoot);
  const driftIsSignificant =
    drift.filesChanged > UNCOMMITTED_FILES_THRESHOLD ||
    drift.minutesSinceLastCommit > UNCOMMITTED_MINUTES_THRESHOLD;

  if (driftIsSignificant) {
    getEventBus().publish("workdir.large_uncommitted_drift", {
      filesChanged: drift.filesChanged,
      minutesSinceLastCommit: Math.round(drift.minutesSinceLastCommit),
    });
    logger.info("scheduledCheck", `Published large_uncommitted_drift event (files: ${drift.filesChanged}, mins: ${Math.round(drift.minutesSinceLastCommit)})`);
  } else {
    logger.debug("scheduledCheck", `Drift is small, not alarming (files: ${drift.filesChanged}, mins: ${Math.round(drift.minutesSinceLastCommit)})`);
  }
}

export const internalScheduledCheckCommand = new Command("scheduled-check")
  .alias("internal-scheduled-check")
  .description("Run scheduled checks — detect uncommitted drift (e.g. via cron)")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .action((options) => {
    const projectRoot = options.dir ? resolve(options.dir) : process.cwd();
    // shitennoDir is not strictly needed for drift check, but pass an empty string
    scheduledCheck(projectRoot, "");
  });
