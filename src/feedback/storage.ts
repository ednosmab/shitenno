/**
 * feedback/storage.ts — Filesystem helpers for the Feedback Loop System
 */

import { join } from "node:path";

export function getFeedbackDir(shitennoDir: string): string {
  return join(shitennoDir, "feedback");
}

export function getRecordsDir(shitennoDir: string): string {
  return join(getFeedbackDir(shitennoDir), "records");
}

export function getSummaryPath(shitennoDir: string): string {
  return join(getFeedbackDir(shitennoDir), "summary.json");
}
