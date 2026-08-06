/**
 * scaffolder.ts — Capability-based Scaffolding
 *
 * Substitui a instalação por níveis (L1/L2/L3) por instalação por capacidades.
 * Cada capacidade mapeia para diretórios e arquivos específicos.
 *
 * PRINCÍPIO: Instalar apenas o que agrega valor naquele momento.
 * Toda instalação é evolutiva — nada é definitivo.
 */

import fse from "fs-extra";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { UserAnswers } from "../interface/cli/prompts.js";
import type { Capability } from "../application/maturity-profile.js";
import { logger } from "../shared/logger.js";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import { getCapabilityMapping } from "../domain/types/capability-mapping.js";

const { ensureDirSync, readdirSync, existsSync } = fse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATES_DIR = join(__dirname, "..", "templates");

export interface ScaffoldResult {
  filesCreated: string[];
  directoriesCreated: string[];
  /** Capacidades instaladas */
  capabilities: Capability[];
  /** Legacy level para compatibilidade */
  level: string;
}

export interface ScaffoldOptions {
  /**
   * Write root-level config files (opencode.json, .gitignore).
   * Defaults to true (full integration). Set to false for Level 1
   * (observation) where only `.shitenno/` may be created.
   */
  rootConfig?: boolean;
}

// ── Re-exports from split modules ───────────────────────────────────────────

export { selectSkills, copySkills } from "../scaffold/skills.js";
export { updateGitignore } from "../scaffold/gitignore.js";
export {
  fillPlaceholders,
  customizeContent,
  copyAndCustomizeFiles,
  generateOpencodeJson,
  removeTemplateFile,
  updateSystemMapCapabilityStatus,
} from "../scaffold/templates.js";

// ── Import from split modules ───────────────────────────────────────────────

import { copyAndCustomizeFiles, generateOpencodeJson, removeTemplateFile } from "../scaffold/templates.js";
import { copySkills } from "../scaffold/skills.js";
import { updateGitignore } from "../scaffold/gitignore.js";

// ── Main Scaffolding Function ───────────────────────────────────────────────

/**
 * Cria a estrutura inicial do Shitenno num projeto.
 *
 * Gera opencode.json, shitenno/, shitenno-profile/, skills,
 * scripts e docs baseado nas capacidades seleccionadas.
 *
 * @param targetDir - Directorio onde criar a estrutura
 * @param answers - Respostas do utilizador (modelos, stack, etc.)
 * @param capabilities - Capacidades a instalar (knowledge, governance, etc.)
 * @returns Resultado com ficheiros e directórios criados
 */
export function scaffoldShitenno(
  targetDir: string,
  answers: UserAnswers,
  capabilities: Capability[],
  options?: ScaffoldOptions,
): ScaffoldResult {
  const result: ScaffoldResult = {
    filesCreated: [],
    directoriesCreated: [],
    capabilities,
    level: "custom",
  };
  const withRootConfig = options?.rootConfig !== false;

  const baseDir = join(TEMPLATES_DIR, "base");
  const { allDirs, allFiles } = collectCapabilityAssets(capabilities);

  createDirectories(targetDir, allDirs, result);
  copyAndCustomizeFiles({ targetDir, baseDir, allFiles, answers, capabilities, result });
  if (withRootConfig) {
    generateOpencodeJson(targetDir, baseDir, answers, result);
  }
  generateProfile(targetDir, baseDir, result);
  removeTemplateFile(targetDir, SHITENNO_DIR_NAME);
  if (withRootConfig) {
    updateGitignore(targetDir);
  }
  copySkills({ targetDir, baseDir, capabilities, allDirs, result });

  return result;
}

interface CapabilityAssets {
  allDirs: Set<string>;
  allFiles: Array<{ src: string; dest: string; customize?: boolean }>;
}

function collectCapabilityAssets(capabilities: Capability[]): CapabilityAssets {
  const allDirs = new Set<string>();
  const allFiles: Array<{ src: string; dest: string; customize?: boolean }> = [];

  for (const cap of capabilities) {
    const mapping = getCapabilityMapping(cap);
    for (const dir of mapping.directories) allDirs.add(dir);
    for (const file of mapping.files) {
      if (!allFiles.some((f) => f.dest === file.dest)) allFiles.push(file);
    }
  }

  return { allDirs, allFiles };
}

function createDirectories(
  targetDir: string,
  allDirs: Set<string>,
  result: ScaffoldResult
): void {
  for (const dir of allDirs) {
    const fullPath = join(targetDir, dir);
    ensureDirSync(fullPath);
    result.directoriesCreated.push(dir);
  }
}

function generateProfile(
  targetDir: string,
  baseDir: string,
  result: ScaffoldResult
): void {
  const { readFileSync, writeFileSync } = fse;
  const profileTemplate = readFileSync(
    join(baseDir, SHITENNO_DIR_NAME, "profile", "_template.config.ts"), "utf-8"
  );
  const dirName = targetDir.split(/[/\\]/).pop() || "my-project";
  const projectName = dirName.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const areas = detectAreas(targetDir);
  const areasStr = areas.map((a) => `    "${a}",`).join("\n");
  const profileContent = profileTemplate
    .replace(/\[PROJECT_NAME\]/g, projectName)
    .replace(/areas: \[.*?\]/s, `areas: [\n${areasStr}\n  ]`);
  const profilePath = join(targetDir, SHITENNO_DIR_NAME, "profile", `${projectName}.config.ts`);
  writeFileSync(profilePath, profileContent, "utf-8");
  result.filesCreated.push(`${SHITENNO_DIR_NAME}/profile/${projectName}.config.ts`);
}

function detectAreas(targetDir: string): string[] {
  const candidates = ["src", "packages", "apps"];
  const areas: string[] = [];

  for (const base of candidates) {
    const basePath = join(targetDir, base);
    if (!existsSync(basePath)) continue;

    try {
      const entries = readdirSync(basePath, { withFileTypes: true });
      const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

      if (subdirs.length === 0) {
        areas.push(base);
      } else {
        for (const dir of subdirs) {
          areas.push(`${base}/${dir.name}`);
        }
      }
    } catch {
      logger.debug("scaffolder", "Inaccessible directory skipped:", base);
    }
  }

  return areas.length > 0 ? areas : ["src"];
}


