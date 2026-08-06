/**
 * Shared path utilities for Shitenno CLI.
 * Centralizes template directory resolution.
 */

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Returns the path to the base templates directory.
 * This is the source of truth for template files.
 */
export function getTemplatesDir(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, "..", "templates", "base");
}
