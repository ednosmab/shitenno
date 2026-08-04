/**
 * commands/init/consent.ts — Phase 2: consent persistence
 *
 * Consent records live in `.git/shitenno/consent.json` (resolved via
 * `git rev-parse --git-common-dir`), NOT inside the isolated worktree. That
 * way the audit trail survives branch discard or merge — the record is
 * per-repository, independent of any single branch.
 *
 * The history is append-only: every `init` adds a record. Phase 7 (upgrade)
 * reads the last record to know the current consent level without re-running
 * the assessment.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import inquirer from "inquirer";
import { resolveGitCommonDir } from "./git.js";
import { GIT_METADATA_DIR_NAME } from "../../constants.js";

export type ConsentLevel = 1 | 2;

export interface ConsentRecord {
  /** Unique id (timestamp-based) — allows audit-trail correlation. */
  id: string;
  level: ConsentLevel;
  /** Absolute project root that consented. */
  project: string;
  recordedAt: string;
  cliVersion?: string;
}

export const CONSENT_DIR_NAME = GIT_METADATA_DIR_NAME;
export const CONSENT_FILE_NAME = "consent.json";

/**
 * The consent file path inside the git common dir.
 */
export function resolveConsentFilePath(gitCommonDir: string): string {
  return join(gitCommonDir, CONSENT_DIR_NAME, CONSENT_FILE_NAME);
}

/**
 * Resolve the consent file path for a project, or null when it is not a git
 * repository (git common dir unavailable).
 */
export async function getConsentFilePath(projectRoot: string): Promise<string | null> {
  const gitCommonDir = await resolveGitCommonDir(projectRoot);
  if (!gitCommonDir) return null;
  return resolveConsentFilePath(gitCommonDir);
}

/**
 * Read the full append-only consent history. Tolerates a missing or
 * corrupted file (returns empty array).
 */
export function readConsentHistory(consentFilePath: string): ConsentRecord[] {
  if (!existsSync(consentFilePath)) return [];
  try {
    const raw = JSON.parse(readFileSync(consentFilePath, "utf-8"));
    if (!Array.isArray(raw)) return [];
    return raw as ConsentRecord[];
  } catch {
    return [];
  }
}

/**
 * Read the latest consent record (the source of truth for Phase 7 upgrade).
 */
export function readLatestConsent(consentFilePath: string): ConsentRecord | null {
  const history = readConsentHistory(consentFilePath);
  return history.length > 0 ? history[history.length - 1]! : null;
}

/**
 * Append a consent record. Returns the record that was persisted.
 */
export function recordConsent(
  consentFilePath: string,
  project: string,
  level: ConsentLevel,
  cliVersion?: string,
): ConsentRecord {
  const history = readConsentHistory(consentFilePath);
  const record: ConsentRecord = {
    id: `${Date.now()}-${history.length + 1}`,
    level,
    project,
    recordedAt: new Date().toISOString(),
    cliVersion,
  };
  history.push(record);
  mkdirSync(dirname(consentFilePath), { recursive: true });
  writeFileSync(consentFilePath, JSON.stringify(history, null, 2) + "\n", "utf-8");
  return record;
}

// ── Non-interactive resolution ──────────────────────────────────────────────

export interface ConsentOptions {
  consentLevel?: string;
  answersFile?: string;
}

export interface DeclaredConsentLevel {
  level: ConsentLevel | null;
  error: string | null;
}

function parseConsentLevel(value: unknown): ConsentLevel | null {
  if (value === "1" || value === 1) return 1;
  if (value === "2" || value === 2) return 2;
  return null;
}

/**
 * Read a declared consent level from the --consent-level flag or the
 * `consentLevel` key in the answers file. Flag takes precedence.
 */
export async function readDeclaredConsentLevel(options: ConsentOptions): Promise<DeclaredConsentLevel> {
  if (options.consentLevel !== undefined) {
    const level = parseConsentLevel(options.consentLevel);
    if (level === null) {
      return { level: null, error: `Invalid --consent-level "${options.consentLevel}". Use "1" (observation) or "2" (full integration).` };
    }
    return { level, error: null };
  }

  if (options.answersFile) {
    const answersPath = resolve(options.answersFile);
    if (!existsSync(answersPath)) {
      return { level: null, error: `Answers file not found: ${options.answersFile}` };
    }
    try {
      const raw = JSON.parse(readFileSync(answersPath, "utf-8")) as { consentLevel?: unknown };
      if (raw.consentLevel === undefined) return { level: null, error: null };
      const level = parseConsentLevel(raw.consentLevel);
      if (level === null) {
        return { level: null, error: `Invalid consentLevel "${String(raw.consentLevel)}" in answers file. Use "1" or "2".` };
      }
      return { level, error: null };
    } catch (err) {
      return {
        level: null,
        error: `Failed to read answers file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return { level: null, error: null };
}

export interface ConsentDecision {
  level: ConsentLevel;
}

/**
 * Ask for the consent level — never assumed by default.
 *
 * Interactive: list prompt (Level 1 / Level 2 / abort).
 * Non-interactive: `--consent-level 1|2` or `consentLevel` in the answers
 * file is required; a missing key aborts with a clear error.
 */
export async function promptConsentLevel(options: ConsentOptions): Promise<ConsentDecision | null> {
  const declared = await readDeclaredConsentLevel(options);
  if (declared.error) {
    throw new Error(declared.error);
  }
  if (declared.level !== null) return { level: declared.level };

  if (options.answersFile) {
    throw new Error('The answers file must define "consentLevel" ("1" or "2") for non-interactive runs.');
  }

  if (!process.stdin.isTTY) return null;

  const { level } = await inquirer.prompt<{ level: ConsentLevel }>([
    {
      type: "list",
      name: "level",
      message: "How far may shugo go?",
      choices: [
        { name: "Level 1 — Observation: create .shitenno/ only, touch nothing else", value: 1 },
        { name: "Level 2 — Full integration: also manage agent config files (backed up first)", value: 2 },
      ],
    },
  ]);
  return { level };
}

/**
 * Resolve the consent file path from a project root (convenience wrapper).
 */
export async function consentFilePathFor(projectRoot: string): Promise<string | null> {
  return getConsentFilePath(projectRoot);
}
