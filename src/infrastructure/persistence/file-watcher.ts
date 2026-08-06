/**
 * file-watcher.ts — Governance Artifact Watcher
 *
 * Watches shitenno/ for file changes and triggers automatic
 * context regeneration, knowledge graph rebuild, and briefing cache
 * invalidation.
 *
 * PRINCIPLE: File changes should propagate through the event system.
 */

import { watch, type FSWatcher } from "chokidar";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { getEventBus } from "../event-bus.js";
import { logger } from "../../shared/logger.js";
import type { WatcherOptions, WatcherContext } from "./file-watcher/types.js";
import { handleFileAdd, handleFileDelete, handleFileChange, publishGitEvent } from "./file-watcher/handlers.js";

export type { WatcherOptions, WatcherContext, ChangeInfo, ArtifactType } from "./file-watcher/types.js";
export { detectArtifactType, handleFileAdd, handleFileDelete, handleFileChange, publishGitEvent } from "./file-watcher/handlers.js";

let activeWatcher: FSWatcher | null = null;
let watcherRestartCount = 0;
const MAX_RESTARTS = 5;
const BASE_RESTART_DELAY_MS = 1000;

function getRestartDelay(attempt: number): number {
  return Math.min(BASE_RESTART_DELAY_MS * 2 ** attempt, 30_000);
}

export function startWatching(
  shitennoDir: string,
  options: WatcherOptions = {}
): () => void {
  const { debounceMs = 500, enableDocSync = true } = options;

  if (activeWatcher) {
    activeWatcher.close();
  }

  const watchPaths = [
    join(shitennoDir, "governance"),
    join(shitennoDir, "docs"),
    ...(options.extraPaths || []),
  ];

  if (options.watchSourceCode && options.projectRoot) {
    const candidates = ["src", "lib", "app"].filter((d) => existsSync(join(options.projectRoot!, d)));
    const resolvedDirs = candidates.length > 0 ? candidates : ["."];
    for (const dir of resolvedDirs) {
      const fullPath = join(options.projectRoot, dir);
      watchPaths.push(fullPath);
      logger.info("file-watcher", `Source code watching enabled: ${fullPath}`);
    }
  }

  if (options.watchGitEvents && options.projectRoot) {
    const gitHead = join(options.projectRoot, ".git", "HEAD");
    const gitRefs = join(options.projectRoot, ".git", "refs");
    watchPaths.push(gitHead, gitRefs);
    logger.info("file-watcher", `Git event watching enabled: .git/HEAD, .git/refs/`);
  }

  const ctx: WatcherContext = {
    shitennoDir,
    bus: getEventBus(),
    enableDocSync,
    debounceMs,
    pendingEvents: new Map<string, NodeJS.Timeout>(),
  };

  activeWatcher = createWatcherInstance(watchPaths, ctx);

  return () => {
    for (const timeout of ctx.pendingEvents.values()) {
      clearTimeout(timeout);
    }
    ctx.pendingEvents.clear();
    watcherRestartCount = MAX_RESTARTS;
    activeWatcher?.close();
    activeWatcher = null;
  };
}

function createWatcherInstance(watchPaths: string[], ctx: WatcherContext): FSWatcher {
  const watcher = watch(watchPaths, {
    ignoreInitial: true,
    depth: 3,
    ignored: [
      /node_modules/,
      /telemetry\/events-/,
      /docs\/generated\//,
    ],
  });

  watcher.on("ready", () => {
    watcherRestartCount = 0;
    logger.info("file-watcher", "Watcher ready");
  });

  watcher.on("error", (err: unknown) => {
    handleWatcherError(err, watchPaths, ctx);
  });

  watcher.on("change", (filePath: string) => {
    if (filePath.endsWith(".git/HEAD") || filePath.includes(".git/refs/")) {
      handleGitEvent(filePath, ctx);
      return;
    }
    handleChangeEvent(filePath, ctx);
  });

  watcher.on("add", (filePath: string) => {
    if (filePath.includes(".git/refs/")) {
      handleGitEvent(filePath, ctx);
      return;
    }
    handleFileAdd(filePath, ctx);
  });

  watcher.on("unlink", (filePath: string) => {
    if (filePath.includes(".git/")) return;
    handleFileDelete(filePath, ctx);
  });

  return watcher;
}

function handleWatcherError(err: unknown, watchPaths: string[], ctx: WatcherContext): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logger.error("file-watcher", `Watcher error: ${error.message}`);
  ctx.bus.publish("watcher.error" as never, {
    error: error.message,
    timestamp: new Date().toISOString(),
  } as never);

  if (watcherRestartCount >= MAX_RESTARTS) {
    logger.error("file-watcher", `Max restart attempts (${MAX_RESTARTS}) reached — watcher stopped`);
    return;
  }

  watcherRestartCount++;
  const delay = getRestartDelay(watcherRestartCount);
  logger.info("file-watcher", `Restarting watcher in ${delay}ms (attempt ${watcherRestartCount}/${MAX_RESTARTS})`);
  setTimeout(() => {
    activeWatcher?.close();
    for (const timeout of ctx.pendingEvents.values()) {
      clearTimeout(timeout);
    }
    ctx.pendingEvents.clear();
    activeWatcher = createWatcherInstance(watchPaths, ctx);
  }, delay);
}

function handleChangeEvent(filePath: string, ctx: WatcherContext): void {
  if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

  const existing = ctx.pendingEvents.get(filePath);
  if (existing) clearTimeout(existing);

  ctx.pendingEvents.set(
    filePath,
    setTimeout(() => {
      ctx.pendingEvents.delete(filePath);
      handleFileChange(filePath, ctx.shitennoDir, ctx.bus, ctx.enableDocSync);
    }, ctx.debounceMs)
  );
}

function handleGitEvent(filePath: string, ctx: WatcherContext): void {
  const existing = ctx.pendingEvents.get(filePath);
  if (existing) clearTimeout(existing);

  ctx.pendingEvents.set(
    filePath,
    setTimeout(() => {
      ctx.pendingEvents.delete(filePath);
      publishGitEvent(filePath, ctx.bus);
    }, ctx.debounceMs)
  );
}

export function stopWatching(): void {
  activeWatcher?.close();
  activeWatcher = null;
}
