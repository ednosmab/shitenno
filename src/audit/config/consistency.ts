/**
 * Config detectors — Cross-file consistency
 *
 * Detects broken references, extension mismatches, and inconsistencies.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { logger } from "../../logger.js";
import type { HealthIssue } from "../types.js";
import { KNOWN_CORRECTIONS, EXTENSION_SWAP, DOCS_TO_SCAN, findFileInDirs, isBranchConvention } from "./helpers.js";

function checkP0FileExists(file: string, shitennoDir: string, locations: string[]): boolean {
  return locations.some((loc) => existsSync(join(shitennoDir, loc, file)));
}

function detectBareWordRefsInFile(content: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const p0Files = ["AGENTS.md", "FORBIDDEN_OPERATIONS.md", "DESDO.md", "Requisitos_plataforma.md", "CONTEXT_HIERARCHY.md"];
  const p0Line = content.split("\n").find((l) => l.includes("Requisitos_plataforma"));
  if (!p0Line) return issues;
  const locations = ["docs/", "cognition/context/", "governance/", ""];
  for (const file of p0Files) {
    if (p0Line.includes(file) && !checkP0FileExists(file, shitennoDir, locations)) {
      issues.push({ type: "bare_word_ref", severity: 3,
        description: `Referência P0 obrigatória "${file}" não existe em nenhuma localização`,
        location: "shitenno/docs/AGENTS.md", recommendation: `Criar "${file}" ou remover da lista P0 em AGENTS.md`, confidence: 0.7 });
    }
  }
  return issues;
}

/**
 * Detect bare word references to P0 files that don't exist.
 */
export function detectBareWordRefs(shitennoDir: string): HealthIssue[] {
  const docPath = join(shitennoDir, "docs/AGENTS.md");
  if (!existsSync(docPath)) return [];
  try { return detectBareWordRefsInFile(readFileSync(docPath, "utf-8"), shitennoDir); }
  catch (err) { logger.debug("config/consistency", "Error in detectBareWordRefs:", err); return []; }
}

function scanDocForTemplateDirRefs(content: string, doc: string, shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const templateRefRegex = /`([^`\n]*<[^`\n>]+>[^`\n]*)`/g;
  let match;
  while ((match = templateRefRegex.exec(content)) !== null) {
    const ref = match[1];
    if (!ref) continue;
    const dirPart = ref.split(/[<]/)[0];
    if (!dirPart || !dirPart.includes("/") || dirPart.startsWith("shitenno/")) continue;
    if (isBranchConvention(dirPart)) continue;
    if (!existsSync(join(shitennoDir, dirPart))) {
      issues.push({ type: "template_dir_ref", severity: 2,
        description: `Directório "${dirPart}" referenciado por template "${ref}" não existe`,
        location: `shitenno/${doc}`, recommendation: `Criar directório "${dirPart}" ou corrigir referência em "${doc}"`, confidence: 0.75 });
    }
  }
  return issues;
}

/**
 * Detect template directory references to non-existent directories.
 */
export function detectTemplateDirRefs(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsToScan = ["docs/AGENTS.md", "docs/capabilities.md", "cognition/context/CONTEXT_HIERARCHY.md"];
  for (const doc of docsToScan) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;
    try { issues.push(...scanDocForTemplateDirRefs(readFileSync(path, "utf-8"), doc, shitennoDir)); }
    catch (err) { logger.debug("config/consistency", "Error scanning template dir refs:", err); }
  }
  return issues;
}

interface FileCheckContext {
  content: string;
  doc: string;
  shitennoDir: string;
  projectRoot: string;
  docDir: string;
}

function checkKnownCorrections(ctx: FileCheckContext): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const [wrongName, correctName] of Object.entries(KNOWN_CORRECTIONS)) {
    if (ctx.content.includes(wrongName) && findFileInDirs(correctName, ctx.shitennoDir, ctx.projectRoot, ctx.docDir)) {
      issues.push({
        type: "extension_mismatch",
        severity: 2,
        description: `Referência "${wrongName}" usa extensão errada — ficheiro real é "${correctName}"`,
        location: `shitenno/${ctx.doc}`,
        recommendation: `Corrigir "${wrongName}" para "${correctName}" em "${ctx.doc}"`,
        confidence: 0.7,
      });
    }
  }
  return issues;
}

function checkSwappedExtensions(ctx: FileCheckContext): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const refRegex = /`([a-zA-Z0-9_/.-]+)(\.(?:md|ts|js|yaml|json|txt))`/g;
  let match;
  while ((match = refRegex.exec(ctx.content)) !== null) {
    const baseName = match[1] as string;
    const ext = match[2] as string;
    if (!baseName || baseName.includes("*") || baseName.includes("[") || baseName.includes("<") || baseName.includes("YYYY") || baseName.includes("MM-DD")) continue;

    const fullName = `${baseName}${ext}`;
    if (KNOWN_CORRECTIONS[fullName]) continue;
    if (findFileInDirs(fullName, ctx.shitennoDir, ctx.projectRoot, ctx.docDir)) continue;

    const swappedExt = EXTENSION_SWAP[ext];
    if (!swappedExt) continue;

    const swappedName = `${baseName}${swappedExt}`;
    if (findFileInDirs(swappedName, ctx.shitennoDir, ctx.projectRoot, ctx.docDir)) {
      issues.push({
        type: "extension_mismatch",
        severity: 2,
        description: `Referência "${fullName}" usa extensão errada — ficheiro real é "${swappedName}"`,
        location: `shitenno/${ctx.doc}`,
        recommendation: `Corrigir "${fullName}" para "${swappedName}" em "${ctx.doc}"`,
        confidence: 0.75,
      });
    }
  }
  return issues;
}

/**
 * Detect file extension mismatches in documentation references.
 */
export function detectExtensionMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const projectRoot = join(shitennoDir, "..");

  for (const doc of DOCS_TO_SCAN) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      const docDir = dirname(path);
      const ctx: FileCheckContext = { content, doc, shitennoDir, projectRoot, docDir };
      issues.push(...checkKnownCorrections(ctx));
      issues.push(...checkSwappedExtensions(ctx));
    } catch (err) { logger.debug("config/consistency", "Error scanning extension mismatch:", err); }
  }
  return issues;
}

/**
 * Detect directories not listed in SYSTEM_MAP.md.
 */
export function detectSystemMapMismatch(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const systemMapTreePath = join(shitennoDir, "governance/SYSTEM_MAP_TREE.md");
  if (!existsSync(systemMapTreePath)) return issues;

  try {
    const content = readFileSync(systemMapTreePath, "utf-8");
    const treeEntryRegex = /[├└]──\s+`?([^\s`]+)`?/g;
    const mapEntries = new Set<string>();
    let match;
    while ((match = treeEntryRegex.exec(content)) !== null) {
      if (match[1]) mapEntries.add(match[1].replace(/\/$/, ""));
    }

    const docsDir = join(shitennoDir, "docs");
    if (existsSync(docsDir)) {
      const entries = readdirSync(docsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !mapEntries.has(entry.name)) {
          issues.push({
            type: "system_map_mismatch",
            severity: 1,
          description: `Directório "docs/${entry.name}" existe mas não está listado no SYSTEM_MAP_TREE.md`,
          location: "shitenno/governance/SYSTEM_MAP_TREE.md",
          recommendation: `Adicionar "docs/${entry.name}" à árvore em SYSTEM_MAP_TREE.md`,
            confidence: 0.75,
          });
        }
      }
    }
  } catch (err) { logger.debug("config/consistency", "Error in detectSystemMapMismatch:", err); }
  return issues;
}

/**
 * Detect pnpm commands referenced without a package.json.
 */
export function detectBrokenCommands(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pkgPath = join(shitennoDir, "package.json");
  if (existsSync(pkgPath)) return issues;

  const docsToScan = ["governance/WORKFLOW.md", "docs/AGENTS.md"];
  const commandRegex = /pnpm run ([a-zA-Z0-9:-]+)/g;
  const brokenCommands = new Set<string>();

  for (const doc of docsToScan) {
    const path = join(shitennoDir, doc);
    if (!existsSync(path)) continue;
    try {
      const content = readFileSync(path, "utf-8");
      let match;
      while ((match = commandRegex.exec(content)) !== null) {
        if (match[1]) brokenCommands.add(match[1]);
      }
    } catch (err) { logger.debug("config/consistency", "Error scanning broken commands:", err); }
  }

  if (brokenCommands.size > 0) {
    issues.push({
      type: "broken_command",
      severity: 2,
      description: `${brokenCommands.size} comando(s) pnpm run não executável(s) sem package.json: ${Array.from(brokenCommands).join(", ")}`,
      location: "shitenno/",
      recommendation: "Criar shitenno/package.json com os scripts definidos",
      confidence: 0.95,
    });
  }
  return issues;
}

/**
 * Detect P0 file list inconsistency between AGENTS.md and CONTEXT_HIERARCHY.md.
 */
export function detectP0Inconsistency(shitennoDir: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const agentsPath = join(shitennoDir, "docs/AGENTS.md");
  const contextPath = join(shitennoDir, "cognition/context/CONTEXT_HIERARCHY.md");
  if (!existsSync(agentsPath) || !existsSync(contextPath)) return issues;

  try {
    const agentsContent = readFileSync(agentsPath, "utf-8");
    const contextContent = readFileSync(contextPath, "utf-8");
    const p0Files = [
      "AGENTS.md",
      "FORBIDDEN_OPERATIONS.md",
      "DESDO.md",
      "Requisitos_plataforma.md",
      "CONTEXT_HIERARCHY.md",
    ];

    const agentsP0 = new Set<string>();
    const contextP0 = new Set<string>();

    for (const file of p0Files) {
      if (agentsContent.includes(file)) agentsP0.add(file);
      if (contextContent.includes(file)) contextP0.add(file);
    }

    for (const file of agentsP0) {
      if (!contextP0.has(file)) {
        issues.push({
          type: "p0_inconsistency",
          severity: 1,
          description: `"${file}" está na lista P0 de AGENTS.md mas não na de CONTEXT_HIERARCHY.md`,
          location: "shitenno/docs/AGENTS.md",
          recommendation: `Verificar se "${file}" deve ser P0 em ambos os documentos`,
          confidence: 0.7,
        });
      }
    }
    for (const file of contextP0) {
      if (!agentsP0.has(file)) {
        issues.push({
          type: "p0_inconsistency",
          severity: 1,
          description: `"${file}" está na lista P0 de CONTEXT_HIERARCHY.md mas não na de AGENTS.md`,
          location: "shitenno/cognition/context/CONTEXT_HIERARCHY.md",
          recommendation: `Verificar se "${file}" deve ser P0 em ambos os documentos`,
          confidence: 0.7,
        });
      }
    }
  } catch (err) { logger.debug("config/consistency", "Error in detectP0Inconsistency:", err); }
  return issues;
}
