/**
 * shitenno-briefing — OpenCode plugin (template)
 *
 * Injects the Shugo briefing (`.shitenno/BRIEFING.md`) into the agent
 * context before every task. Hook: `chat.message`.
 *
 * Auto-discovered by OpenCode from `.opencode/plugin/`.
 * Self-contained on purpose: scaffolded projects have no src/ to import.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SHITENNO_DIR_NAME = ".shitenno";
const BRIEFING_FILE = "BRIEFING.md";
const START_MARKER = "<!-- shitenno-briefing-start -->";
const END_MARKER = "<!-- shitenno-briefing-end -->";
const TRIVIAL_PATTERNS = [/^continue$/, /^ok$/, /^go on$/, /^yes$/, /^y$/, /^next$/];

function buildBriefingContextBlock(briefingMarkdown) {
  const trimmed = briefingMarkdown.trim();
  if (trimmed.length === 0) return "";
  return `${START_MARKER}\n${trimmed}\n${END_MARKER}`;
}

function isTrivialPrompt(prompt) {
  const normalized = prompt.trim().toLowerCase();
  return TRIVIAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function extractUserText(parts) {
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n");
}

export default async ({ directory }) => {
  return {
    "chat.message": async (_input, output) => {
      const prompt = extractUserText(output.parts).trim();
      if (!prompt || isTrivialPrompt(prompt)) return;

      const briefingPath = join(directory, SHITENNO_DIR_NAME, BRIEFING_FILE);
      if (!existsSync(briefingPath)) return;

      const briefing = readFileSync(briefingPath, "utf-8");
      const block = buildBriefingContextBlock(briefing);
      if (!block) return;

      output.message.system = [output.message.system, block]
        .filter((part) => part && part.trim().length > 0)
        .join("\n\n");
    },
  };
};
