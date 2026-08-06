/**
 * doc-semantic-sync.ts — Bridge between semantic-drift-detector and context_buffer.yaml
 *
 * PRINCIPLE: detection is deterministic and cheap (runs on every commit).
 * Prose writing is expensive and stays for the AI, on demand, next session.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { scanCodebase, detectDriftBatch, type DriftResult } from "./semantic-drift-detector.js";
import { addReminder } from "../application/context-buffer-writer.js";
import type { ReminderPriority, ReminderCategory } from "../application/briefing.js";

const ARCHIVAL_DIRS = ["history", "evolution", "feedback", "implementation", "plans"];

function isArchivalPath(relativePath: string): boolean {
  return ARCHIVAL_DIRS.some(dir => relativePath.startsWith(dir + "/") || relativePath.includes("/" + dir + "/"));
}

function loadDocsForDrift(docsDir: string): Array<{ path: string; content: string; type: string; age?: number }> {
  if (!existsSync(docsDir)) return [];
  const files = readdirSync(docsDir, { recursive: true })
    .filter((f): f is string => typeof f === "string" && extname(f) === ".md")
    .filter((f): f is string => !isArchivalPath(f));

  return files.map(f => {
    const fullPath = join(docsDir, f);
    const content = readFileSync(fullPath, "utf-8");
    const type = f.includes("adr") ? "adr" : f.includes("runbook") ? "runbook" : "doc";
    return { path: f, content, type };
  });
}

function severityToPriority(confidence: number): ReminderPriority {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

function formatReminder(result: DriftResult): string {
  const preview = result.missingKeywords.slice(0, 3).join(", ");
  return `Doc desatualizada: ${result.document} — ${result.reason} (${preview})`;
}

export interface SemanticSyncOptions {
  projectRoot: string;
  shitennoDir: string;
  docsDir?: string;
  minConfidence?: number;
}

export interface SemanticSyncResult {
  scanned: number;
  driftFound: number;
  remindersWritten: number;
  remindersSkipped: number;
}

/**
 * Runs semantic drift detection and writes reminders for cases
 * with sufficient confidence. Idempotent: duplicate reminders
 * are skipped by addReminder().
 */
export function runSemanticDocSync(options: SemanticSyncOptions): SemanticSyncResult {
  const { projectRoot, shitennoDir, docsDir = join(projectRoot, "docs"), minConfidence = 0.8 } = options;

  const facts = scanCodebase(projectRoot);
  const docs = loadDocsForDrift(docsDir);
  const driftResults = detectDriftBatch(docs, facts).filter(r => r.confidence >= minConfidence);

  let written = 0;
  let skipped = 0;

  for (const result of driftResults) {
    const outcome = addReminder(shitennoDir, {
      message: formatReminder(result),
      priority: severityToPriority(result.confidence),
      category: "docs" as ReminderCategory,
      createdAt: new Date().toISOString(),
    });
    if (outcome.skipped) skipped++;
    else if (outcome.success) written++;
  }

  return {
    scanned: docs.length,
    driftFound: driftResults.length,
    remindersWritten: written,
    remindersSkipped: skipped,
  };
}
