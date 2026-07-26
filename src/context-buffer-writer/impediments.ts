/**
 * impediments.ts — Impediment buffer operations.
 */

import { readBuffer, writeBuffer } from "./buffer-io.js";

export interface Impediment {
  description: string;
  priority: "high" | "medium" | "low";
  createdAt: string;
  category?: string;
}

export function addImpediment(
  shitennoDir: string,
  impediment: Impediment
): { success: boolean; message: string } {
  const content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found" };
  }

  const entry = `  - description: "${impediment.description}"
    priority: "${impediment.priority}"
    createdAt: "${impediment.createdAt}"
${impediment.category ? `    category: "${impediment.category}"\n` : ""}`;

  const impedimentsRegex = /^impediments:\s*\n/m;
  const match = impedimentsRegex.exec(content);

  if (match) {
    const insertPos = match.index + match[0].length;
    const updated = content.slice(0, insertPos) + entry + content.slice(insertPos);
    writeBuffer(shitennoDir, updated);
    return { success: true, message: `Impediment added: ${impediment.description}` };
  }

  const updated = content.trimEnd() + "\n\nimpediments:\n" + entry;
  writeBuffer(shitennoDir, updated);
  return { success: true, message: `Impediment added (new section): ${impediment.description}` };
}

export function clearImpediments(
  shitennoDir: string,
  pattern?: string
): { success: boolean; message: string; removed: number } {
  const content = readBuffer(shitennoDir);
  if (content === null) {
    return { success: false, message: "context_buffer.yaml not found", removed: 0 };
  }

  const impedimentsRegex = /^impediments:\s*\n((?:\s+- .*\n)*)/m;
  const match = impedimentsRegex.exec(content);

  if (!match?.[1]) {
    return { success: true, message: "No impediments found", removed: 0 };
  }

  const block = match[1];
  const entries = block.split(/(?=^\s+- )/m).filter((e) => e.trim().length > 0);

  if (!pattern) {
    const updated = content.replace(impedimentsRegex, "impediments: []\n");
    writeBuffer(shitennoDir, updated);
    return { success: true, message: `Cleared all ${entries.length} impediments`, removed: entries.length };
  }

  const kept = entries.filter((e) => !e.includes(pattern));
  const removed = entries.length - kept.length;

  if (removed === 0) {
    return { success: true, message: `No impediments matching "${pattern}"`, removed: 0 };
  }

  const newBlock = kept.length > 0 ? kept.join("") : "[]\n";
  const updated = content.replace(impedimentsRegex, `impediments:\n${newBlock}`);
  writeBuffer(shitennoDir, updated);
  return { success: true, message: `Cleared ${removed} impediments matching "${pattern}"`, removed };
}
