/**
 * Audit module — Data Architecture & Persistence detectors
 *
 * Detectors that validate schema consistency, data ownership,
 * migration coverage, and index usage.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../domain/types/constants.js";
import type { HealthIssue, SourceFileInfo } from "./types.js";

// ── 5.1 Schema Consistency ──────────────────────────────────────────────────

export function detectSchemaConsistency(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const schemaFiles = files.filter(
    (f) => f.relPath.includes("schema") || f.basename.includes("Schema") || f.basename.endsWith("schema.ts"),
  );

  const typeFiles = files.filter(
    (f) => !skipPatterns.some((p) => p.test(f.relPath)) && (f.basename.endsWith(".ts") || f.basename.endsWith(".tsx")),
  );

  const schemaNames = new Set<string>();
  for (const file of schemaFiles) {
    const matches = file.content.matchAll(/(?:interface|type|class)\s+(\w+)/g);
    for (const m of matches) {
      if (m[1]) schemaNames.add(m[1].toLowerCase());
    }
  }

  if (schemaNames.size === 0) return issues;

  const typeNames = new Set<string>();
  for (const file of typeFiles) {
    const matches = file.content.matchAll(/(?:interface|type)\s+(\w+)/g);
    for (const m of matches) {
      if (m[1]) typeNames.add(m[1].toLowerCase());
    }
  }

  let mismatchCount = 0;
  for (const schema of schemaNames) {
    if (!typeNames.has(schema)) mismatchCount++;
  }

  if (mismatchCount > 0) {
    issues.push({
      type: "schema_doc_code_mismatch",
      severity: 2,
      description: `${mismatchCount} schema(s) definido(s) sem type/interface correspondente no código`,
      location: "schema files",
      recommendation: "Garantir que cada schema tem type/interface correspondente no código TypeScript.",
      confidence: 0.65,
    });
  }

  return issues;
}

// ── 5.2 Data Ownership ──────────────────────────────────────────────────────

export function detectDataOwnership(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const dataFiles = ["CONCEPTUAL_MODEL.md", "CONCEPTUAL_MODEL.yaml"];
  for (const file of dataFiles) {
    const path = join(projectRoot, SHITENNO_DIR_NAME, "docs", file);
    if (!existsSync(path)) continue;

    const content = readFileSync(path, "utf-8");
    const hasOwnership = /owner|responsável|responsavel|equipe|team|domínio|dominio/i.test(content);

    if (!hasOwnership && content.length > 100) {
      issues.push({
        type: "missing_data_owner",
        severity: 1,
        description: `"${file}" não contém campos de ownership — dados sem responsável definido`,
        location: `shitenno/docs/${file}`,
        recommendation: "Adicionar campos owner/team a cada entidade de dados documentada.",
        confidence: 0.75,
      });
    }
  }

  return issues;
}

// ── 11.1 Missing Migrations ─────────────────────────────────────────────────

export function detectMissingMigrations(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const migrationPatterns = [/migration/i, /migrate/i, /\.sql$/];
  const hasMigrations = files.some((f) => migrationPatterns.some((p) => p.test(f.relPath)));

  const schemaPatterns = [/schema/i, /prisma/i, /typeorm/i, /drizzle/i];
  const hasSchemaTool = files.some((f) => schemaPatterns.some((p) => p.test(f.relPath)));

  if (hasSchemaTool && !hasMigrations) {
    issues.push({
      type: "missing_migration",
      severity: 2,
      description: "Ferramenta de schema detectada mas nenhum ficheiro de migration encontrado",
      location: "project root",
      recommendation: "Configurar migrations para rastrear alterações de schema (prisma migrate, typeorm, etc).",
      confidence: 0.8,
    });
  }

  return issues;
}

// ── 11.2 Index Coverage ─────────────────────────────────────────────────────

export function detectIndexCoverage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const queryFiles = files.filter(
    (f) => f.content.includes(".find(") || f.content.includes(".findAll(") ||
           f.content.includes(".findOne(") || f.content.includes("SELECT") ||
           f.content.includes("WHERE"),
  );

  const hasIndexDefinition = files.some(
    (f) => f.content.includes("CREATE INDEX") || f.content.includes("@Index") ||
           f.content.includes("createIndex"),
  );

  if (queryFiles.length > 5 && !hasIndexDefinition) {
    issues.push({
      type: "unindexed_query",
      severity: 1,
      description: `${queryFiles.length} ficheiro(s) com queries mas nenhuma definição de índice encontrada`,
      location: "src/",
      recommendation: "Verificar se queries frequentes colunam sobre colunas indexadas.",
      confidence: 0.8,
    });
  }

  return issues;
}
