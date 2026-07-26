/**
 * types.ts — File watcher types.
 */

import type { SignificanceResult } from "../../../doc-sync-significance.js";
import type { getEventBus } from "../../../event-bus.js";

export interface WatcherOptions {
  debounceMs?: number;
  extraPaths?: string[];
  enableDocSync?: boolean;
  watchSourceCode?: boolean;
  projectRoot?: string;
  watchGitEvents?: boolean;
}

export interface WatcherContext {
  shitennoDir: string;
  bus: ReturnType<typeof getEventBus>;
  enableDocSync: boolean;
  debounceMs: number;
  pendingEvents: Map<string, NodeJS.Timeout>;
}

export interface ChangeInfo {
  filePath: string;
  relativePath: string;
  significance: SignificanceResult;
}

export type ArtifactType = "adr" | "skill" | "workflow" | "rule" | "config" | "doc" | "unknown";
