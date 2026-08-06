import type { CommandCategory } from "../domain/types/help-data.js";
import { CORE_CATEGORIES } from "./commands-core.js";
import { EXTENDED_CATEGORIES } from "./commands-extended.js";

export const COMMAND_CATEGORIES: CommandCategory[] = [
  ...CORE_CATEGORIES,
  ...EXTENDED_CATEGORIES,
];
