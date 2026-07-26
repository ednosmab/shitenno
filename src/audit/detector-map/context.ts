/**
 * Detector map — Shared context type
 */

import type { SourceFileInfo, HistoryEntry } from "../types.js";

export interface DetectorContext {
  projectRoot: string;
  shitennoDir: string;
  sourceFiles: SourceFileInfo[];
  rules: string[];
  history: HistoryEntry[];
}
