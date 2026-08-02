import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { resolveWithinRoot } from "../../path-safety.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import { logger } from "../../logger.js";
import { getEventBus } from "../../event-bus.js";
import type {
  DocLifecycleStatus,
  DocumentClassification,
  DocumentInfo,
  GitCorrelation,
  StalenessSignals,
  DocLifecycleReport,
  MoveResult,
} from "./types.js";
import { detectStatusMarkers, detectCrossReferences, detectSupersession } from "./detectors.js";
import { classifyDocument, discoverDocuments, hasRecentCommits, getLastModified } from "./classifier.js";

function classifyDocumentWithSignals(doc: DocumentInfo, allDocPaths: string[], docs: DocumentInfo[], adrs: DocumentInfo[]): DocumentClassification {
  const statusMarkers = detectStatusMarkers(doc.content);
  const crossReferences = detectCrossReferences(doc.content, allDocPaths);
  const lastModified = getLastModified(doc.path);
  const ageInDays = Math.floor((Date.now() - new Date(lastModified).getTime()) / (24 * 60 * 60 * 1000));
  const gitCorrelation: GitCorrelation = { lastModified, referencedFilesExist: crossReferences.some((r) => r.exists), recentCommits: hasRecentCommits(doc.path, 30) };
  const staleness: StalenessSignals = { ageInDays, referencedByOtherDocs: docs.some((d) => d.path !== doc.path && d.content.includes(basename(doc.path))), recentCommits: gitCorrelation.recentCommits };
  const supersessionSignals = doc.docType === "adr" ? detectSupersession(doc, adrs) : undefined;
  return classifyDocument(doc, { statusMarkers, crossReferences, gitCorrelation, staleness, supersessionSignals });
}

function buildStatusCounts(classifications: DocumentClassification[]): Record<DocLifecycleStatus, number> {
  const statusCounts: Record<DocLifecycleStatus, number> = { planned: 0, in_progress: 0, completed: 0, superseded: 0, stale: 0 };
  for (const c of classifications) statusCounts[c.status]++;
  return statusCounts;
}

export function auditDocLifecycle(projectRoot: string, shitennoDir: string): DocLifecycleReport {
  const docs = discoverDocuments(projectRoot, shitennoDir);
  const allDocPaths = docs.map((d) => d.path);
  const plans = docs.filter((d) => d.docType === "plan");
  const adrs = docs.filter((d) => d.docType === "adr");
  const classifications = docs.map((doc) => classifyDocumentWithSignals(doc, allDocPaths, docs, adrs));
  const proposedMoves = classifications.filter((c) => c.confidence >= 0.5).map((c) => ({
    source: c.relativePath, destination: join(SHITENNO_DIR_NAME, "docs", c.suggestedDestination, basename(c.path)),
    docType: c.docType, status: c.status, reason: c.evidence.join("; "),
  }));
  const statusCounts = buildStatusCounts(classifications);
  const summary = [`Analysed ${plans.length} plan(s) and ${adrs.length} ADR(s).`,
    `Found: ${statusCounts.planned} planned, ${statusCounts.in_progress} in progress,`,
    `${statusCounts.completed} completed, ${statusCounts.superseded} superseded,`,
    `${statusCounts.stale} stale.`, `${proposedMoves.length} move(s) proposed.`].join(" ");
  return { auditedAt: new Date().toISOString(), totalPlans: plans.length, totalAdrs: adrs.length, classifications, proposedMoves, summary };
}

export function applyMoves(report: DocLifecycleReport, shitennoDir: string, dryRun: boolean): MoveResult {
  const result: MoveResult = { movesApplied: 0, movesSkipped: 0, errors: [] };

  for (const move of report.proposedMoves) {
    const sourcePath = join(shitennoDir, "..", move.source);
    const destDir = join(shitennoDir, "docs", move.destination.replace(/\.?shitenno\/docs\//, ""));
    const destPath = resolveWithinRoot(destDir, basename(move.source));

    if (!existsSync(sourcePath)) {
      result.errors.push(`Source not found: ${move.source}`);
      result.movesSkipped++;
      continue;
    }

    if (dryRun) {
      result.movesSkipped++;
      continue;
    }

    try {
      mkdirSync(destDir, { recursive: true });
      renameSync(sourcePath, destPath);
      result.movesApplied++;

      getEventBus().publish("asset.archived", {
        assetId: basename(move.source),
        assetType: move.docType,
        path: move.source,
        reason: move.reason,
        timestamp: new Date().toISOString(),
      });

      const changelogPath = join(shitennoDir, "docs", "_archive", "CHANGELOG.md");
      const entry = [
        `## ${new Date().toISOString().split("T")[0]}`,
        "",
        `- **Moved:** \`${move.source}\` → \`${move.destination}\``,
        `- **Type:** ${move.docType}`,
        `- **Status:** ${move.status}`,
        `- **Reason:** ${move.reason}`,
        "",
      ].join("\n");

      if (existsSync(changelogPath)) {
        const existing = readFileSync(changelogPath, "utf-8");
        writeFileSync(changelogPath, existing + "\n" + entry);
      } else {
        mkdirSync(dirname(changelogPath), { recursive: true });
        writeFileSync(changelogPath, "# Documentation Lifecycle Changelog\n\n" + entry);
      }
    } catch (error) {
      result.errors.push(`Failed to move ${move.source}: ${error}`);
      result.movesSkipped++;
    }
  }

  return result;
}

export function writeDocLifecycleReport(shitennoDir: string, report: DocLifecycleReport): string {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const filename = `doc-lifecycle-${report.auditedAt.split("T")[0]}.json`;
  const filepath = join(reportsDir, filename);

  writeFileSync(filepath, JSON.stringify(report, null, 2));
  logger.info("DocLifecycleAuditor", `Report written to ${filepath}`);

  return filename;
}
