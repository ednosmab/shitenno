/**
 * commander-reset.ts — Reset commander option state between parses (SA17)
 *
 * Commander 12 retains `_optionValues` on the Command instance across
 * `.parse()` calls. When shugo is used as a library (or tests re-parse
 * the same program), options from a previous parse leak into the next.
 *
 * PRINCIPLE: parsing is a pure operation — each parse starts from a clean
 * option state. We reset the internal option maps before parsing.
 */

import type { Command } from "commander";

/**
 * Reset the commander internal option state on the command and all its
 * subcommands (recursively), so a fresh `.parse()` starts clean.
 *
 * Uses the private fields `_optionValues` and `_optionValueSources`
 * (commander 12.x). The cast is intentional and isolated here.
 */
export function resetCommanderOptions(cmd: Command): void {
  const internal = cmd as unknown as {
    _optionValues: Record<string, unknown>;
    _optionValueSources: Record<string, unknown>;
    commands?: Command[];
  };

  internal._optionValues = {};
  internal._optionValueSources = {};

  for (const sub of internal.commands ?? []) {
    resetCommanderOptions(sub);
  }
}
