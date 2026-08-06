/**
 * Utilitários partilhados entre analyser.ts e scorer.ts.
 *
 * - walkSourceFiles: percorre directórios e processa ficheiros de código
 * - FileContentCache: cache de conteúdo de ficheiros para evitar leitura repetida
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../shared/logger.js";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";

/** Extensões de ficheiros de código fonte. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".vue", ".svelte"];

/** Directórios ignorados. */
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", ".next", ".nuxt"];

/** Extensões incluídas no scan de keywords (inclui config). */
const KEYWORD_EXTENSIONS = [
  ".ts", ".tsx", ".js", ".jsx", ".json", ".yaml", ".yml",
];

// ── walkSourceFiles ─────────────────────────────────────────────────────────

/**
 * Percorre recursivamente um directório e processa cada ficheiro de código.
 * Usa os mesmos critérios em analyser.ts e scorer.ts.
 *
 * @param dir - Directório raiz para percorrer
 * @param callback - Chamado para cada ficheiro com (fullPath, fileName)
 * @param options.extensions - Extensões a incluir (default: SOURCE_EXTENSIONS)
 * @param options.includeAll - Se true, inclui .json, .yaml, etc. (para keyword scan)
 */
export function walkSourceFiles(
  dir: string,
  callback: (fullPath: string, fileName: string) => void,
  options?: { includeAll?: boolean }
): void {
  const extensions = options?.includeAll ? KEYWORD_EXTENSIONS : SOURCE_EXTENSIONS;

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          callback(fullPath, entry.name);
        }
      }
    } catch {
      logger.debug("utils", "Inaccessible directory skipped:", currentDir);
    }
  }

  walk(dir);
}

/**
 * Conta ficheiros de código fonte num directório.
 */
export function countSourceFilesInDir(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  walkSourceFiles(dir, () => count++);
  return count;
}

// ── FileContentCache ────────────────────────────────────────────────────────

/**
 * Cache de conteúdo de ficheiros para evitar leitura repetida.
 * Usado pelo scorer para keyword search em múltiplas áreas sobrepostas.
 */
/** Detecta a raiz do projecto shugo procurando por opencode.json ou shitenno/. */
export function detectShitennoProject(startDir: string): { root: string; shitennoDir: string } | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, "opencode.json")) || existsSync(join(current, SHITENNO_DIR_NAME))) {
      return { root: current, shitennoDir: join(current, SHITENNO_DIR_NAME) };
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

export class FileContentCache {
  private cache = new Map<string, string>();
  private static readonly MAX_ENTRIES = 500;

  get(filePath: string): string | null {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }
    try {
      const content = readFileSync(filePath, "utf-8");
      this.set(filePath, content);
      return content;
    } catch {
      return null;
    }
  }

  set(filePath: string, content: string): void {
    if (this.cache.size >= FileContentCache.MAX_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(filePath, content);
  }

  get size(): number {
    return this.cache.size;
  }
}
