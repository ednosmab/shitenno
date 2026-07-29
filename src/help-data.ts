/**
 * help-data.ts — Command help metadata for shugo help system
 *
 * Categories, descriptions, usage examples, and tips for each command.
 * Used by the custom help formatter in bin/shugo.ts.
 */

export interface CommandHelp {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  tips?: string[];
}

export interface CommandCategory {
  name: string;
  description: string;
  commands: CommandHelp[];
}

export { COMMAND_CATEGORIES } from "./help-data/commands.js";

import { COMMAND_CATEGORIES } from "./help-data/commands.js";

/**
 * Find a command by name across all categories.
 */
export function findCommand(name: string): CommandHelp | undefined {
  for (const cat of COMMAND_CATEGORIES) {
    const cmd = cat.commands.find((c: CommandHelp) => c.name === name);
    if (cmd) return cmd;
  }
  return undefined;
}

/**
 * Get all command names.
 */
export function getAllCommandNames(): string[] {
  const names: string[] = [];
  for (const cat of COMMAND_CATEGORIES) {
    for (const cmd of cat.commands) {
      names.push(cmd.name);
    }
  }
  return names;
}
