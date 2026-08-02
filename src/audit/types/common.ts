/**
 * Audit types — Common foundational types
 */

/** Source file metadata collected during project scan. */
export interface SourceFileInfo {
  fullPath: string;
  relPath: string;
  basename: string;
  content: string;
  lineCount: number;
}

/** History entry read from shitenno/docs/history/*.md. */
export interface HistoryEntry {
  filename: string;
  date: string;
  content: string;
}

/** Nível de auditoria — controla quais detectors são executados. */
export type AuditLevel = "quick" | "standard" | "code-review" | "enterprise";
