import { Command } from "commander";
import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { invalidateCache } from "../cache.js";
import { outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";
import { output, outputBlank } from "../output.js";

function removeCacheFile(projectRoot: string): string | null {
  const cachePath = join(projectRoot, ".shitenno-cache.json");
  if (!existsSync(cachePath)) return null;
  try {
    unlinkSync(cachePath);
    return ".shitenno-cache.json";
  } catch {
    return null;
  }
}

function removeBuildInfoFiles(projectRoot: string): string[] {
  const removed: string[] = [];
  if (!existsSync(projectRoot)) return removed;
  try {
    const files = readdirSync(projectRoot);
    for (const file of files) {
      if (!file.endsWith(".tsbuildinfo")) continue;
      const filePath = join(projectRoot, file);
      try {
        unlinkSync(filePath);
        removed.push(file);
      } catch {
        logger.debug("clean", "Failed to remove:", filePath);
      }
    }
  } catch {
    logger.debug("clean", "Failed to read directory:", projectRoot);
  }
  return removed;
}

function renderCleanResults(isJson: boolean, projectRoot: string, itemsRemoved: string[]) {
  if (isJson) {
    outputJson({ projectRoot, itemsRemoved, count: itemsRemoved.length });
    return;
  }
  if (itemsRemoved.length === 0) {
    output(chalk.green("  ✔ Cache is already clean."));
  } else {
    output(chalk.green(`  ✔ Removed ${itemsRemoved.length} item(s):`));
    for (const item of itemsRemoved) {
      output(chalk.gray(`    - ${item}`));
    }
  }
  outputBlank();
}

export const cleanCommand = new Command("clean")
  .description("Clear shugo cache and temporary files")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--json", "Output results as JSON")
  .action((options) => {
    const isJson = options.json === true;

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    if (!checkLifecycleGate("clean", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    if (!isJson) {
      outputBlank();
      banner("shugo clean", "Clear Cache");
      outputBlank();
    }

    const itemsRemoved: string[] = [];

    const cacheResult = removeCacheFile(ctx.projectRoot);
    if (cacheResult) itemsRemoved.push(cacheResult);
    itemsRemoved.push(...removeBuildInfoFiles(ctx.projectRoot));

    invalidateCache({ projectRoot: ctx.projectRoot });

    getEventBus().publish("analysis.complete", {
      projectRoot: ctx.projectRoot,
      itemsRemoved: itemsRemoved.length,
    });

    renderCleanResults(isJson, ctx.projectRoot, itemsRemoved);
  });
