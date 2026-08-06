/**
 * feedback-utils.ts — Shared parsing helpers for feedback user fields
 *
 * Extracted from feedback.ts to eliminate duplication between
 * production code and test code. Single source of truth for
 * rating clamping and tag parsing logic.
 */

/**
 * Parse a raw rating string to a clamped 1-5 value.
 * Returns undefined when input is missing, not a number, or out of range.
 */
export function parseUserRating(value: string | undefined): 1 | 2 | 3 | 4 | 5 | undefined {
  if (value === undefined || value === "") return undefined;

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return undefined;
  if (parsed < 1 || parsed > 5) return undefined;

  return parsed as 1 | 2 | 3 | 4 | 5;
}

/**
 * Parse a comma-separated tag string into a trimmed array.
 * Returns undefined when there is nothing usable to parse.
 */
export function parseUserTags(value: string | undefined): string[] | undefined {
  if (value === undefined || value === "") return undefined;

  const tags = String(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.length > 0 ? tags : undefined;
}
