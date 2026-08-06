/**
 * validation.ts — Centralized validation utilities
 *
 * Replaces duplicated try/catch JSON parsing, schema checks,
 * and sanitization helpers scattered across the codebase.
 */

import { existsSync, readFileSync } from "node:fs";
import { logger } from "../shared/logger.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StatusCheckResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

// ── JSON Helpers ───────────────────────────────────────────────────────────

/**
 * Safe JSON.parse with fallback. Replaces ~30 try/catch blocks.
 */
export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Read + parse JSON file. Returns fallback if missing or invalid.
 */
export function safeJsonParseFile<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

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

// ── Schema Validation ──────────────────────────────────────────────────────

export interface FieldSpec {
  key: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
}

/**
 * Validate that an object has required fields with correct types.
 */
export function validateRequiredFields(
  obj: unknown,
  fields: FieldSpec[],
): ValidationResult {
  const errors: string[] = [];
  if (typeof obj !== "object" || obj === null) {
    return { valid: false, errors: ["Expected an object"] };
  }
  const record = obj as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field.key];
    if (value === undefined || value === null) {
      if (field.required !== false) {
        errors.push(`Missing required field: ${field.key}`);
      }
      continue;
    }
    if (field.type === "array") {
      if (!Array.isArray(value)) {
        errors.push(`Field ${field.key} must be an array`);
      }
    } else if (typeof value !== field.type) {
      errors.push(`Field ${field.key} must be ${field.type}, got ${typeof value}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// ── ID / String Validation ─────────────────────────────────────────────────

const DEFAULT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validate a string ID (alphanumeric + hyphens + underscores).
 */
export function validateStringId(
  id: unknown,
  options?: { pattern?: RegExp; maxLength?: number },
): boolean {
  if (typeof id !== "string") return false;
  const pattern = options?.pattern ?? DEFAULT_ID_PATTERN;
  const maxLen = options?.maxLength ?? 100;
  return pattern.test(id) && id.length <= maxLen;
}

// ── File / Path Validation ─────────────────────────────────────────────────

/**
 * Check if a file exists. Simple wrapper for common guard pattern.
 */
export function validateFileExists(filePath: string): { exists: boolean } {
  return { exists: existsSync(filePath) };
}

/**
 * Check if a YAML file contains required section markers.
 */
export function validateYamlHasSections(
  filePath: string,
  sections: string[],
): StatusCheckResult {
  if (!existsSync(filePath)) {
    return { name: filePath, status: "fail", message: "File not found" };
  }
  const content = readFileSync(filePath, "utf-8");
  const missing = sections.filter((s) => !content.includes(`${s}:`));
  if (missing.length > 0) {
    return {
      name: filePath,
      status: "warn",
      message: `Missing sections: ${missing.join(", ")}`,
    };
  }
  return { name: filePath, status: "pass", message: "OK" };
}

/**
 * Parse a JSON config file and verify required top-level keys.
 */
export function validateJsonConfig(
  filePath: string,
  requiredKeys: string[],
): StatusCheckResult {
  if (!existsSync(filePath)) {
    return { name: filePath, status: "fail", message: "File not found" };
  }
  try {
    const content = readFileSync(filePath, "utf-8");
    const config = JSON.parse(content);
    const missing = requiredKeys.filter((k) => !(k in config));
    if (missing.length > 0) {
      return {
        name: filePath,
        status: "warn",
        message: `Missing keys: ${missing.join(", ")}`,
      };
    }
    return { name: filePath, status: "pass", message: "OK" };
  } catch {
    return { name: filePath, status: "fail", message: "Invalid JSON" };
  }
}

// ── Sanitization ───────────────────────────────────────────────────────────

/**
 * Escape regex metacharacters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if a field name is safe (no prototype pollution).
 */
const DANGEROUS_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
]);

export function isSafeFieldName(field: string): boolean {
  return !DANGEROUS_KEYS.has(field);
}

/**
 * Sanitize input for safe YAML embedding.
 * Escapes quotes, backslashes, newlines and truncates.
 */
export function sanitizeForYaml(input: string, maxLen = 200): string {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .substring(0, maxLen);
}

/**
 * Sanitize a string to contain only safe identifier characters.
 */
export function sanitizeIdentifier(input: string, maxLen = 50): string {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, maxLen);
}
