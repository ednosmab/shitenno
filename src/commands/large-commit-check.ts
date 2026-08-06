import { Command } from "commander";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { getEventBus } from "../infrastructure/event-bus.js";

const LARGE_COMMIT_THRESHOLD = 50;

function getCommittedFileCount(projectRoot: string): number {
  try {
    const output = execSync("git diff HEAD~1 --name-only 2>/dev/null | wc -l", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 5000,
    });
    return parseInt(output.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export const largeCommitCheckCommand = new Command("large-commit-check")
  .alias("internal-large-commit-check")
  .description("Check if last commit was large and notify daemon")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .action((options: Record<string, unknown>) => {
    const projectRoot = options.dir ? resolve(options.dir as string) : process.cwd();
    const count = getCommittedFileCount(projectRoot);
    if (count > LARGE_COMMIT_THRESHOLD) {
      getEventBus().publish("git.large_commit_detected", { count });
    }
  });
