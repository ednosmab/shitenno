/**
 * Audit module — Product Strategy & Requirements detectors
 *
 * Detectors that validate product vision alignment, roadmap consistency,
 * KPI coverage, and requirement traceability.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 1.1 Vision Alignment ────────────────────────────────────────────────────

export function detectVisionAlignment(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const briefingPath = join(projectRoot, "BRIEFING.md");
  const readmePath = join(projectRoot, "README.md");
  const backlogPath = join(projectRoot, SHITENNO_DIR_NAME, "docs", "backlog", "ACTIVE.md");

  const briefing = existsSync(briefingPath) ? readFileSync(briefingPath, "utf-8") : "";
  const readme = existsSync(readmePath) ? readFileSync(readmePath, "utf-8") : "";
  const backlog = existsSync(backlogPath) ? readFileSync(backlogPath, "utf-8") : "";

  if (!briefing && !readme) {
    issues.push({
      type: "missing_vision_doc",
      severity: 2,
      description: "Nenhum BRIEFING.md nem README.md encontrado — visão do produto não documentada",
      location: "project root",
      recommendation: "Criar BRIEFING.md com visão, objectivos e proposta de valor do produto.",
      confidence: 0.95,
    });
    return issues;
  }

  const visionKeywords = ["visão", "vision", "objectivo", "objetivo", "proposta", "valor", "meta"];
  const combined = (briefing + readme).toLowerCase();
  const found = visionKeywords.filter((kw) => combined.includes(kw));

  if (found.length < 2) {
    issues.push({
      type: "vision_roadmap_gap",
      severity: 1,
      description: `Documentação de visão fraca — apenas ${found.length} keyword(s) de visão encontrada(s)`,
      location: "BRIEFING.md / README.md",
      recommendation: "Documentar visão, objectivos e proposta de valor de forma explícita.",
      confidence: 0.7,
    });
  }

  if (backlog && briefing) {
    const backlogTopics = backlog.split("\n").filter((l) => l.includes("P0") || l.includes("P1")).length;
    if (backlogTopics === 0) {
      issues.push({
        type: "vision_roadmap_gap",
        severity: 1,
        description: "BACKLOG.md não tem itens P0/P1 — roadmap pode estar desalinhado com visão",
        location: "shitenno/docs/backlog/ACTIVE.md",
        recommendation: "Adicionar itens P0/P1 ao BACKLOG alinhados com a visão do produto.",
        confidence: 0.7,
      });
    }
  }

  return issues;
}

// ── 1.2 Roadmap Consistency ─────────────────────────────────────────────────

export function detectRoadmapConsistency(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const roadmapPaths = [
    join(projectRoot, "docs", "roadmap.md"),
    join(projectRoot, "ROADMAP.md"),
    join(projectRoot, SHITENNO_DIR_NAME, "docs", "ROADMAP.md"),
  ];

  const roadmapPath = roadmapPaths.find((p) => existsSync(p));
  if (!roadmapPath) {
    issues.push({
      type: "roadmap_stale",
      severity: 1,
      description: "Nenhum roadmap.md encontrado — planeamento de produto não documentado",
      location: "docs/ ou shitenno/docs/",
      recommendation: "Criar roadmap.md com milestones e timeline.",
      confidence: 0.95,
    });
    return issues;
  }

  const content = readFileSync(roadmapPath, "utf-8");
  const hasDates = /\d{4}[-/]\d{2}[-/]\d{2}/.test(content) || /\d{2}[-/]\d{4}/.test(content);
  const hasStatus = /concluído|concluido|done|em progresso|in progress|pendente|pending/i.test(content);

  if (!hasDates) {
    issues.push({
      type: "roadmap_stale",
      severity: 1,
      description: "Roadmap não contém datas — impossível verificar consistência temporal",
      location: roadmapPath.replace(projectRoot + "/", ""),
      recommendation: "Adicionar datas/milestones ao roadmap.",
      confidence: 0.75,
    });
  }

  if (!hasStatus) {
    issues.push({
      type: "roadmap_stale",
      severity: 1,
      description: "Roadmap não contém campos de status — progresso não rastreável",
      location: roadmapPath.replace(projectRoot + "/", ""),
      recommendation: "Adicionar status (concluído/em progresso/pendente) a cada item do roadmap.",
      confidence: 0.75,
    });
  }

  return issues;
}

// ── 1.3 KPI Coverage ────────────────────────────────────────────────────────

export function detectKPICoverage(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const docsDir = join(projectRoot, SHITENNO_DIR_NAME, "docs");
  if (!existsSync(docsDir)) return issues;

  const kpiPatterns = [/kpi/i, /metric/i, /indicator/i, /measure/i, /dashboard/i];
  const files = ["BACKLOG.md", "BRIEFING.md", "README.md"];

  let kpiFound = false;
  for (const file of files) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    if (kpiPatterns.some((p) => p.test(content))) {
      kpiFound = true;
      break;
    }
  }

  if (!kpiFound) {
    issues.push({
      type: "missing_kpis",
      severity: 1,
      description: "Nenhuma referência a KPIs ou métricas encontrada na documentação",
      location: "BRIEFING.md, README.md, BACKLOG.md",
      recommendation: "Definir KPIs mensuráveis para o produto (ex: test coverage, health score, velocity).",
      confidence: 0.75,
    });
  }

  return issues;
}

// ── 1.4 Orphan Requirements ─────────────────────────────────────────────────

const FEATURE_PATTERNS = [
  /feature[s]?\s*[:]\s*`?(\w+)`?/gi,
  /implementa[çc][ãa]o\s+de\s+(.+)/gi,
  /criar\s+(.+)/gi,
  /adicionar\s+(.+)/gi,
];

const DOC_FILES = ["BACKLOG.md", "BRIEFING.md"];

function collectDocFeatures(projectRoot: string): Set<string> {
  const features = new Set<string>();
  for (const file of DOC_FILES) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    for (const pattern of FEATURE_PATTERNS) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        features.add(match[1]?.toLowerCase().trim() ?? "");
      }
    }
  }
  return features;
}

function collectCodeExports(files: SourceFileInfo[]): Set<string> {
  const exports = new Set<string>();
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];
  for (const file of files) {
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;
    const exportMatches = file.content.matchAll(/^export\s+(?:async\s+)?(?:function|const|class)\s+(\w+)/gm);
    for (const m of exportMatches) {
      if (m[1]) exports.add(m[1].toLowerCase());
    }
  }
  return exports;
}

export function detectOrphanRequirements(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(projectRoot, SHITENNO_DIR_NAME, "docs");
  if (!existsSync(docsDir)) return issues;

  const docFeatures = collectDocFeatures(projectRoot);
  if (docFeatures.size === 0) return issues;

  const codeExports = collectCodeExports(files);
  let orphanCount = 0;
  for (const feature of docFeatures) {
    const words = feature.split(/\s+/).filter((w) => w.length > 3);
    if (!words.some((w) => codeExports.has(w))) orphanCount++;
  }

  if (orphanCount > 3) {
    issues.push({
      type: "orphan_requirement",
      severity: 1,
      description: `${orphanCount} feature(s) documentada(s) sem correspondência óbvia no código exportado`,
      location: "docs/backlog/ACTIVE.md, docs/BRIEFING.md",
      recommendation: "Verificar se requisitos documentados foram implementados ou estão pendentes.",
      confidence: 0.8,
    });
  }

  return issues;
}

// ── 1.5 Requirement Traceability ────────────────────────────────────────────

export function detectRequirementTraceability(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const backlogPath = join(projectRoot, SHITENNO_DIR_NAME, "docs", "backlog", "ACTIVE.md");
  if (!existsSync(backlogPath)) return issues;

  const backlog = readFileSync(backlogPath, "utf-8");
  const hasTraceability = /rastreabilidade|traceability|link|referência|ver.*ticket/i.test(backlog);

  if (!hasTraceability && backlog.length > 100) {
    issues.push({
      type: "broken_traceability",
      severity: 1,
      description: "BACKLOG.md não contém links de rastreabilidade para código ou tickets",
      location: "shitenno/docs/backlog/ACTIVE.md",
      recommendation: "Adicionar links para commits, PRs ou tickets em cada item do backlog.",
      confidence: 0.75,
    });
  }

  return issues;
}

// ── 1.6 Ambiguity Patterns ──────────────────────────────────────────────────

export function detectAmbiguityPatterns(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(projectRoot, SHITENNO_DIR_NAME, "docs");
  if (!existsSync(docsDir)) return issues;

  const ambiguityPatterns = [
    /deve talvez/gi,
    /possivelmente/gi,
    /quando possível/gi,
    /se necessário/gi,
    /pode ser que/gi,
    /dependendo de/gi,
    /talvez deva/gi,
    /às vezes/gi,
  ];

  const docFiles = ["BACKLOG.md", "BRIEFING.md", "README.md"];
  let ambiguityCount = 0;

  for (const file of docFiles) {
    const path = join(projectRoot, file);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");
    for (const pattern of ambiguityPatterns) {
      const matches = content.match(pattern);
      if (matches) ambiguityCount += matches.length;
    }
  }

  if (ambiguityCount > 5) {
    issues.push({
      type: "ambiguous_requirement",
      severity: 1,
      description: `${ambiguityCount} expressão(ões) ambígua(s) encontrada(s) na documentação`,
      location: "docs/backlog/ACTIVE.md, BRIEFING.md, README.md",
      recommendation: "Substituir linguagem ambígua por especificações concretas e mensuráveis.",
      confidence: 0.75,
    });
  }

  return issues;
}
