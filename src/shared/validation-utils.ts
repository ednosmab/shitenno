/**
 * Pure validation utilities shared across contexts.
 *
 * These helpers have no infrastructure or domain dependencies, so they live
 * in the shared layer and are importable from any context (including domain).
 */

import { logger } from "./logger.js";

/**
 * Safe JSON.parse with type guard validation and logging.
 * Returns null if parsing fails or validation fails.
 * Used at trust boundaries (file I/O, daemon state, audit output).
 */
export function safeJsonParseValidated<T>(
  raw: string,
  validate: (v: unknown) => v is T,
  context: string,
): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("validation", `Failed to parse JSON in ${context}`);
    return null;
  }
  if (!validate(parsed)) {
    logger.warn("validation", `Shape validation failed in ${context}`);
    return null;
  }
  return parsed;
}

/**
 * Common type guard: check if value is a plain object.
 */
export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Escape regex metacharacters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
