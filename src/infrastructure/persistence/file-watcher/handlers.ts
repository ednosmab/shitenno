/**
 * handlers.ts — File change event handlers.
 */

import { readFileSync } from "node:fs";
import { join, basename } from "node:path";
import type { WatcherContext, ChangeInfo, ArtifactType } from "./types.js";
import { getEventBus } from "../../../event-bus.js";
import { calculateSignificance, ChangeHistoryTracker } from "../../../doc-sync-significance.js";
import { logger } from "../../../logger.js";
import { isSyncWriteInProgress } from "../../../sync-write-guard.js";

export const changeHistory = new ChangeHistoryTracker();

export function detectArtifactType(filePath: string, shitennoDir: string): ArtifactType {
  const relative = filePath.slice(shitennoDir.length + 1);

  if (relative.startsWith("docs/adrs/")) return "adr";
  if (relative.startsWith("docs/skills/")) return "skill";
  if (relative.startsWith("governance/WORKFLOW")) return "workflow";
  if (relative.startsWith("governance/rules/")) return "rule";
  if (relative.endsWith(".json") || relative.endsWith(".yaml")) return "config";
  if (relative.endsWith(".md")) return "doc";

  return "unknown";
}

export function publishArtifactCreatedEvents(
  filePath: string,
  artifactType: ArtifactType,
  bus: ReturnType<typeof getEventBus>,
): void {
  const fileName = filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown";

  if (artifactType === "adr") {
    bus.publish("adr.created", { adrId: fileName, title: fileName, status: "proposed" });
  }

  if (artifactType === "skill") {
    bus.publish("skill.created", { skillId: fileName, skillName: fileName });
  }
}

export function publishPlanFileEvents(
  filePath: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  const relativePath = filePath.replace(shitennoDir, "").replace(/^\//, "");
  const plansDir = join("governance", "plans");
  if (
    !relativePath.startsWith(plansDir) ||
    !relativePath.endsWith(".md") ||
    relativePath.includes("/done/") ||
    relativePath.includes("/reference/") ||
    relativePath.includes("/pipeline/") ||
    filePath.includes("TEMPLATE") ||
    filePath.includes("README")
  ) return;

  const planId = filePath.split("/").pop()?.replace(/\.md$/, "") || "unknown";
  bus.publish("plan.created", {
    planId,
    path: relativePath,
    title: planId.replace(/-/g, " "),
  });

  let fileContent = "";
  try {
    fileContent = readFileSync(filePath, "utf-8");
  } catch {
  }
  bus.publish("plan.file_changed", {
    planId,
    path: relativePath,
    content: fileContent,
  });
}

export function publishTypeSpecificEvents(
  artifactType: string,
  filePath: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (artifactType === "rule") {
    bus.publish("rule.triggered", {
      ruleId: basename(filePath).replace(/\.json$/, "") || "unknown",
      ruleDescription: "Rule file updated",
      actionsExecuted: 0,
      success: true,
    });
  }

  if (artifactType === "workflow" || artifactType === "config") {
    bus.publish("engineering_state.updated", {
      dimension: artifactType === "workflow" ? "governance" : "configuration",
      previousValue: null,
      newValue: filePath,
      source: "file-watcher",
    });
  }
}

export function handleDocSync(
  info: ChangeInfo,
  enableDocSync: boolean,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (!enableDocSync || !info.significance.shouldSync) return;
  if (info.significance.level === "high") {
    logger.info("file-watcher", `High significance change: ${info.relativePath} (${info.significance.score.toFixed(2)})`);
  }
  bus.publish("docs.sync.triggered", {
    path: info.filePath,
    relativePath: info.relativePath,
    significance: info.significance.score,
    level: info.significance.level,
    outputLevel: info.significance.outputLevel,
    reasons: info.significance.reasons,
  });
}

export function handlePlanChange(
  filePath: string,
  relativePath: string,
  newContent: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  if (isSyncWriteInProgress()) return;
  if (!relativePath.startsWith("governance/plans/") || !relativePath.endsWith(".md")) return;
  const fileName = basename(filePath);
  if (fileName === "TEMPLATE.md" || fileName === "README.md" || relativePath.includes("/done/") || relativePath.includes("/reference/")) return;
  bus.publish("plan.file_changed", { planId: fileName.replace(".md", ""), path: relativePath, content: newContent });
}

export function handleBacklogChange(
  filePath: string,
  newContent: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
): void {
  const fileName = basename(filePath);
  const isBacklogFile = fileName === "BACKLOG.md" ||
    (filePath.includes("/backlog/") && (fileName === "ACTIVE.md" || fileName === "DONE.md"));

  if (!isBacklogFile) return;
  import("../../../plan-backlog-sync.js").then(({ syncBacklogToPlan }) => {
    const sectionRegex = /### (BACKLOG-[A-Z_0-9]+)(?:\s*—\s*(.+))?/g;
    let match;
    while ((match = sectionRegex.exec(newContent)) !== null) {
      const backlogId = match[1] ?? "";
      const planId = backlogId.replace("BACKLOG-", "").toLowerCase().replace(/_/g, "-");
      const sectionStart = match.index;
      const nextSection = newContent.indexOf("\n### ", sectionStart + 1);
      const section = newContent.slice(sectionStart, nextSection !== -1 ? nextSection : undefined);
      const statusMatch = section.match(/\*\*Status\*\*\s*\|\s*([^|]+)/);
      syncBacklogToPlan(shitennoDir, planId, statusMatch?.[1]?.trim().toLowerCase() ?? "planeado");
    }
    bus.publish("backlog.updated", { path: filePath, timestamp: new Date().toISOString() });
  }).catch(() => { /* Import failed */ });
}

export function handleFileAdd(filePath: string, ctx: WatcherContext): void {
  if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

  const { shitennoDir, bus } = ctx;
  const addRelative = filePath.slice(shitennoDir.length + 1);
  if (addRelative.split(/[/\\]/).some((s) => s.startsWith(".") && s !== "")) return;

  const artifactType = detectArtifactType(filePath, shitennoDir);

  publishArtifactCreatedEvents(filePath, artifactType, bus);
  publishPlanFileEvents(filePath, shitennoDir, bus);

  bus.publish("asset.created", {
    assetId: filePath,
    assetType: artifactType,
    path: filePath,
  });

  if (filePath.includes("/src/")) {
    const sourceRelative = filePath.replace(/.*\/src\//, "src/");
    bus.publish("source.file_added", {
      path: filePath,
      relativePath: sourceRelative,
      timestamp: new Date().toISOString(),
    });
  }

  if (basename(filePath) === "package.json") {
    bus.publish("engineering_state.updated", {
      dimension: "configuration",
      previousValue: null,
      newValue: filePath,
      source: "file-watcher",
    });
  }
}

export function handleFileDelete(filePath: string, ctx: WatcherContext): void {
  if (!/\.(md|yaml|json|ts)$/.test(filePath)) return;

  const { shitennoDir, bus } = ctx;
  const relativePath = filePath.slice(shitennoDir.length + 1);
  if (relativePath.split(/[/\\]/).some((s) => s.startsWith(".") && s !== "")) return;

  const artifactType = detectArtifactType(filePath, shitennoDir);

  bus.publish("asset.archived", {
    assetId: filePath,
    assetType: artifactType,
    path: filePath,
  });

  if (filePath.includes("/src/")) {
    const sourceRelative = filePath.replace(/.*\/src\//, "src/");
    bus.publish("source.file_deleted", {
      path: filePath,
      relativePath: sourceRelative,
      timestamp: new Date().toISOString(),
    });
  }
}

export function handleFileChange(
  filePath: string,
  shitennoDir: string,
  bus: ReturnType<typeof getEventBus>,
  enableDocSync: boolean
): void {
  const relativePath = filePath.slice(shitennoDir.length + 1);
  const segments = relativePath.split(/[/\\]/);
  if (segments.some((s) => s.startsWith(".") && s !== "")) return;

  if (filePath.includes("/src/") && !filePath.includes("/src/commands")) {
    bus.publish("source.changed", {
      path: filePath,
      relativePath,
      timestamp: new Date().toISOString(),
    });
  }

  const artifactType = detectArtifactType(filePath, shitennoDir);
  const frequency = changeHistory.recordChange(filePath);

  let newContent: string;
  try { newContent = readFileSync(filePath, "utf-8"); } catch { newContent = ""; }

  const significance = calculateSignificance({ filePath, shitennoDir, oldContent: null, newContent, frequency });

  bus.publish("asset.updated", { assetId: filePath, assetType: artifactType, path: filePath, changes: ["content"] });
  publishTypeSpecificEvents(artifactType, filePath, bus);
  handleDocSync({ filePath, relativePath, significance }, enableDocSync, bus);
  handlePlanChange(filePath, relativePath, newContent, bus);
  handleBacklogChange(filePath, newContent, shitennoDir, bus);
}

export function publishGitEvent(filePath: string, bus: ReturnType<typeof getEventBus>): void {
  const isHead = filePath.endsWith(".git/HEAD");
  const isRef = filePath.includes(".git/refs/");

  if (isHead) {
    bus.publish("git.branch_changed", {
      path: filePath,
      timestamp: new Date().toISOString(),
      type: "head_updated",
    });
    bus.publish("git.commit_detected", {
      path: filePath,
      timestamp: new Date().toISOString(),
    });
  } else if (isRef) {
    const refName = filePath.split(".git/refs/")[1] ?? "unknown";
    bus.publish("git.ref_updated", {
      path: filePath,
      refName,
      timestamp: new Date().toISOString(),
      type: "ref_created_or_updated",
    });
  }
}
