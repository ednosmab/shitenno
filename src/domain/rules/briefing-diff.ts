/**
 * briefing-diff.ts — Briefing diff logic
 *
 * Generates human-readable diffs between two Briefing objects.
 */

import type { Briefing } from "../../application/briefing.js";

function diffSetChanges<T>(
  oldSet: Set<T>,
  newSet: Set<T>,
  addLabel: string,
  removeLabel: string,
): string[] {
  const lines: string[] = [];
  for (const item of newSet) {
    if (!oldSet.has(item)) lines.push(`+ ${addLabel}: ${item}`);
  }
  for (const item of oldSet) {
    if (!newSet.has(item)) lines.push(`- ${removeLabel}: ${item}`);
  }
  return lines;
}

interface DiffArrayInput<T> {
  oldArr: T[];
  newArr: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  label: string;
}

function diffArrayChanges<T>(input: DiffArrayInput<T>): string[] {
  const { oldArr, newArr, getKey, getLabel, label } = input;
  const oldIds = new Set(oldArr.map(getKey));
  return newArr
    .filter((item) => !oldIds.has(getKey(item)))
    .map((item) => `+ ${label}: ${getLabel(item)}`);
}

export function generateDiff(oldBriefing: Briefing, newBriefing: Briefing): string {
  const lines: string[] = ["# Briefing Diff", ""];
  let hasChanges = false;

  if (oldBriefing.risks.overall !== newBriefing.risks.overall) {
    lines.push(`- Risk level changed: ${oldBriefing.risks.overall} → ${newBriefing.risks.overall}`);
    hasChanges = true;
  }

  const riskChanges = diffSetChanges(
    new Set(oldBriefing.risks.criticalAreas),
    new Set(newBriefing.risks.criticalAreas),
    "New critical area",
    "Removed critical area",
  );
  if (riskChanges.length > 0) { lines.push(...riskChanges); hasChanges = true; }

  const testChanges = diffSetChanges(
    new Set(oldBriefing.tests.areasWithoutTests),
    new Set(newBriefing.tests.areasWithoutTests),
    "New area without tests",
    "Area now has tests",
  );
  if (testChanges.length > 0) { lines.push(...testChanges); hasChanges = true; }

  const ruleChanges = diffArrayChanges({
    oldArr: oldBriefing.contextRules,
    newArr: newBriefing.contextRules,
    getKey: (r) => r.id,
    getLabel: (r) => `[${r.area}] ${r.rule}`,
    label: "New rule",
  });
  if (ruleChanges.length > 0) { lines.push(...ruleChanges); hasChanges = true; }

  const dynamicChanges = diffArrayChanges({
    oldArr: oldBriefing.dynamicRules,
    newArr: newBriefing.dynamicRules,
    getKey: (r) => r.id,
    getLabel: (r) => `[${r.severity}] ${r.rule}`,
    label: "New dynamic rule",
  });
  if (dynamicChanges.length > 0) { lines.push(...dynamicChanges); hasChanges = true; }

  const oldRecs = new Set(oldBriefing.recommendations);
  for (const rec of newBriefing.recommendations) {
    if (!oldRecs.has(rec)) { lines.push(`+ New recommendation: ${rec}`); hasChanges = true; }
  }

  if (!hasChanges) lines.push("No changes detected.");
  return lines.join("\n");
}
