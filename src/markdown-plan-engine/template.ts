/**
 * template.ts — Template generation for markdown plan engine
 *
 * Handles plan ID generation and markdown template creation.
 */

import { stringify as stringifyYaml } from "yaml";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreatePlanInput {
  title: string;
  description?: string;
  priority?: string;
  estimatedTime?: string;
  owner?: string;
  content?: string;
}

export interface PlanTemplateInput extends CreatePlanInput {
  id: string;
  createdAt: string;
}

// ── ID Generation ──────────────────────────────────────────────────────────

export function generateId(title: string): string {
  const date = new Date().toISOString().split("T")[0];
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 50);
  return `${date}-${slug}`;
}

// ── Template Generation ────────────────────────────────────────────────────

export function generateTemplate(input: PlanTemplateInput): string {
  const { title, description, priority, estimatedTime, owner, content, createdAt } = input;

  const frontmatter = stringifyYaml({
    status: "andamento",
    date: createdAt.split("T")[0],
    priority: priority || "P1",
    owner: owner || "AI Agent",
    estimated_time: estimatedTime || "TBD",
    updated_at: createdAt,
  }).trimEnd();

  return `---
${frontmatter}
---

# ${title}

## Context

${description || "TBD"}

---

## Steps

### Step 1: TBD

| # | Action | Verification |
|---|--------|--------------|
| 1.1 | TBD | TBD |

---

## Notes

${content || ""}
`;
}
