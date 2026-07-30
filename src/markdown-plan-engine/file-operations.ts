/**
 * file-operations.ts — File operations for markdown plan engine
 *
 * Handles YAML/legacy status updates, event publishing, and file movement.
 */

import { existsSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { getEventBus } from "../event-bus.js";
import { logger } from "../logger.js";
import { YAML_BLOCK_RE } from "./parser.js";
import { isCompletionStatus, statusDisplayText, type MarkdownPlanStatus } from "./status.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface StatusUpdateResult {
  content: string;
  updated: boolean;
}

// ── YAML Status Update ─────────────────────────────────────────────────────

export function updateYamlStatus(content: string, newStatus: MarkdownPlanStatus): StatusUpdateResult {
  const yamlMatch = content.match(YAML_BLOCK_RE);
  if (!yamlMatch || !yamlMatch[1]) return { content, updated: false };

  try {
    const parsed = (parseYaml(yamlMatch[1]) as Record<string, unknown>) ?? {};
    parsed.status = newStatus;
    parsed.updated_at = new Date().toISOString();
    const newBlock = `---\n${stringifyYaml(parsed).trimEnd()}\n---\n`;
    const updated = content.slice(0, yamlMatch.index) + newBlock + content.slice((yamlMatch.index ?? 0) + yamlMatch[0].length);
    return { content: updated, updated: true };
  } catch {
    logger.debug("markdown-plan-engine", "Malformed YAML block — falling through to legacy path");
    return { content, updated: false };
  }
}

// ── Legacy Status Update ───────────────────────────────────────────────────

export function updateLegacyStatus(content: string, newStatus: MarkdownPlanStatus): string {
  const statusRegex = /(\*\*Status:\*\*\s*)(.+)/;
  const statusMatch = content.match(statusRegex);

  if (statusMatch) {
    content = content.replace(statusRegex, `$1${statusDisplayText(newStatus)}`);
  } else {
    const lines = content.split("\n");
    const titleIndex = lines.findIndex((l) => l.startsWith("# "));
    if (titleIndex !== -1) {
      lines.splice(titleIndex + 2, 0, "", `**Status:** ${statusDisplayText(newStatus)}`);
      content = lines.join("\n");
    } else {
      const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
      const insertAt = firstNonEmpty === -1 ? 0 : firstNonEmpty + 1;
      lines.splice(insertAt, 0, "", `**Status:** ${statusDisplayText(newStatus)}`);
      content = lines.join("\n");
    }
  }

  const updatedAtRegex = /(\*\*Updated_at:\*\*\s*)(.+)/;
  if (content.match(updatedAtRegex)) {
    content = content.replace(updatedAtRegex, `$1${new Date().toISOString()}`);
  }

  return content;
}

// ── Event Publishing ───────────────────────────────────────────────────────

export interface StatusEventPayload {
  id: string;
  oldStatus: MarkdownPlanStatus;
  newStatus: MarkdownPlanStatus;
  relativePath: string;
  title: string;
  plansDir: string;
  doneDir: string;
}

export function publishStatusEvents(payload: StatusEventPayload): void {
  const { id, oldStatus, newStatus, relativePath, title, plansDir, doneDir } = payload;

  if (oldStatus !== newStatus) {
    const bus = getEventBus();
    bus.publish("plan.status_changed", {
      planId: id,
      oldStatus,
      newStatus,
      path: relativePath,
    });
  }

  if (isCompletionStatus(newStatus)) {
    moveToDone(id, plansDir, doneDir);
    const bus = getEventBus();
    bus.publish("plan.archived", {
      planId: id,
      title,
      path: `shitenno/governance/plans/done/${id}.md`,
      finalStatus: "done",
    });
  }
}

// ── File Movement ──────────────────────────────────────────────────────────

export function moveToDone(id: string, plansDir: string, doneDir: string): void {
  const sourcePath = join(plansDir, `${id}.md`);
  const destPath = join(doneDir, `${id}.md`);

  if (!existsSync(sourcePath)) {
    throw new Error(`Plan file not found: ${sourcePath}`);
  }

  if (!existsSync(doneDir)) {
    mkdirSync(doneDir, { recursive: true });
  }
  renameSync(sourcePath, destPath);

  const verificationSrc = join(plansDir, `${id}.verification.json`);
  const verificationDest = join(doneDir, `${id}.verification.json`);
  if (existsSync(verificationSrc)) {
    renameSync(verificationSrc, verificationDest);
  }
}
