/**
 * plan-backlog-sync/checklist.ts — Checklist extraction from plan content
 */

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

/**
 * Extract checklist items from plan content.
 * Looks for `- [ ]` and `- [x]` items within `## Checklist` section.
 */
export function extractChecklist(content: string): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const lines = content.split("\n");
  let inChecklistSection = false;

  for (const line of lines) {
    if (line.trim() === "## Checklist") {
      inChecklistSection = true;
      continue;
    }

    if (inChecklistSection && line.startsWith("## ")) {
      break;
    }

    if (inChecklistSection) {
      const uncheckedMatch = line.match(/^- \[ \]\s*(.+)$/);
      const checkedMatch = line.match(/^- \[x\]\s*(.+)$/);

      if (uncheckedMatch?.[1]) {
        items.push({ text: uncheckedMatch[1], checked: false });
      } else if (checkedMatch?.[1]) {
        items.push({ text: checkedMatch[1], checked: true });
      }
    }
  }

  return items;
}
