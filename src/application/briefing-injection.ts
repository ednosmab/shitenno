/**
 * briefing-injection.ts — Build the context block injected by the OpenCode plugin
 *
 * Pure functions used by the `.opencode/plugin/shitenno-briefing.ts` plugin.
 * Kept in src/ so the logic is unit-testable (TDD) and shareable.
 *
 * PRINCIPLE: The plugin only orchestrates; all formatting logic lives here.
 */

const START_MARKER = "<!-- shitenno-briefing-start -->";
const END_MARKER = "<!-- shitenno-briefing-end -->";

/**
 * Wrap the briefing markdown in explicit HTML-style markers so the
 * agent can identify the injected block and the boundaries are clear.
 */
export function buildBriefingContextBlock(briefingMarkdown: string): string {
  const trimmed = briefingMarkdown.trim();
  if (trimmed.length === 0) return "";

  return `${START_MARKER}\n${trimmed}\n${END_MARKER}`;
}

const TRIVIAL_PATTERNS = [/^continue$/, /^ok$/, /^go on$/, /^yes$/, /^y$/, /^next$/];

/**
 * Decide whether a user prompt is trivial (a continuation command) and
 * should not trigger a fresh briefing injection. Keeps token usage low.
 */
export function isTrivialPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase();
  return TRIVIAL_PATTERNS.some((pattern) => pattern.test(normalized));
}
