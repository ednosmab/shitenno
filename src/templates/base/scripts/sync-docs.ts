#!/usr/bin/env npx tsx
/**
 * sync-docs.ts — Documentation Sync Script (Template)
 *
 * Regenerates SYSTEM_MAP_TREE.md from the current directory structure
 * under shitenno/. Called automatically by doc-sync-hook or
 * manually via `shugo sync-docs`.
 *
 * PRINCIPLE: Documentation stays in sync with actual structure.
 *
 * This is the template version installed via `shugo init`.
 * The full-featured version lives in the shitenno-cli repo.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────

const ROOT = join(__dirname, "..", "..");
const SHITENNO_DIR = join(ROOT, "shitenno");
const SYSTEM_MAP_TREE_PATH = join(SHITENNO_DIR, "governance", "SYSTEM_MAP_TREE.md");
const MANDATORY_CONTEXT_PATH = join(SHITENNO_DIR, "governance", "MANDATORY_CONTEXT.md");

// ── Helpers ─────────────────────────────────────────────────────────────

const RUNTIME_DIRS = new Set(["executions", "records", "telemetry", "daemon", "checkpoints"]);

function walkDir(dir: string, prefix = ""): string[] {
  const entries: string[] = [];

  if (!existsSync(dir)) return entries;

  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    const relPath = prefix ? `${prefix}/${item.name}` : item.name;

    if (item.isDirectory()) {
      if (RUNTIME_DIRS.has(item.name)) continue;
      entries.push(`${relPath}/`);
      entries.push(...walkDir(join(dir, item.name), relPath));
    } else {
      entries.push(relPath);
    }
  }

  return entries;
}

// ── SYSTEM_MAP Regeneration ─────────────────────────────────────────────

function regenerateSystemMap(): boolean {
  if (!existsSync(SHITENNO_DIR)) {
    console.log("  ⚠ shitenno/ not found, skipping");
    return false;
  }

  if (!existsSync(SYSTEM_MAP_TREE_PATH)) {
    console.log("  ⚠ SYSTEM_MAP_TREE.md not found, skipping");
    return false;
  }

  const files = walkDir(SHITENNO_DIR);
  const tree = files
    .map((f) => `│   ${f}`)
    .join("\n");

  let content = readFileSync(SYSTEM_MAP_TREE_PATH, "utf-8");

  const startMarker = "<!-- SYNC:START -->";
  const endMarker = "<!-- SYNC:END -->";

  if (content.includes(startMarker) && content.includes(endMarker)) {
    const regex = new RegExp(
      `${startMarker}[\\s\\S]*?${endMarker}`,
      "g"
    );
    content = content.replace(
      regex,
      `${startMarker}\n\`\`\`\n${tree}\n\`\`\`\n${endMarker}`
    );
  }

  writeFileSync(SYSTEM_MAP_TREE_PATH, content, "utf-8");
  return true;
}

// ── MANDATORY_CONTEXT.md Regeneration ───────────────────────────────────

type ManifestEntry = { id: string; path: string; mandatory?: boolean; when?: Record<string, string> };

function finalizeEntry(current: Record<string, string>, when: Record<string, string> | undefined): ManifestEntry | null {
  if (!current.id) return null;
  return {
    id: current.id,
    path: current.path || "",
    mandatory: current.mandatory === "true" ? true : undefined,
    when,
  };
}

function parseManifestLine(
  line: string,
  state: { inBlock: boolean; inWhen: boolean; indent: number; current: Record<string, string>; when: Record<string, string> | undefined },
  key: string,
  entries: ManifestEntry[],
): "continue" | "break" {
  const trimmed = line.trim();

  if (trimmed === `${key}:`) {
    state.inBlock = true;
    return "continue";
  }
  if (!state.inBlock) return "continue";

  if (trimmed.startsWith("- id:")) {
    const finalized = finalizeEntry(state.current, state.when);
    if (finalized) entries.push(finalized);
    state.current = { id: trimmed.replace("- id:", "").trim() };
    state.when = undefined;
    state.inWhen = false;
    state.indent = line.search(/\S/);
    return "continue";
  }

  if (line.search(/\S/) <= state.indent && trimmed && !trimmed.startsWith("-")) {
    const finalized = finalizeEntry(state.current, state.when);
    if (finalized) entries.push(finalized);
    return "break";
  }

  if (trimmed === "when:") {
    state.inWhen = true;
    state.when = {};
    return "continue";
  }

  if (trimmed.includes(":")) {
    const [k, ...v] = trimmed.split(":");
    if (!k || !v.length) return "continue";
    const value = v.join(":").trim();
    if (state.inWhen) {
      state.when![k.trim()] = value;
    } else {
      state.current[k.trim()] = value;
      if (trimmed.startsWith("when:")) {
        state.inWhen = true;
        state.when = {};
      }
    }
  }
  return "continue";
}

function readManifestEntries(manifestPath: string, key: string): ManifestEntry[] {
  if (!existsSync(manifestPath)) return [];
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    const entries: ManifestEntry[] = [];
    const state = { inBlock: false, inWhen: false, indent: 0, current: {} as Record<string, string>, when: undefined as Record<string, string> | undefined };

    for (const line of raw.split("\n")) {
      if (parseManifestLine(line, state, key, entries) === "break") break;
    }
    const last = finalizeEntry(state.current, state.when);
    if (last) entries.push(last);
    return entries;
  } catch {
    return [];
  }
}

function regenerateMandatoryContext(): boolean {
  if (!existsSync(SHITENNO_DIR)) return false;

  const rules = readManifestEntries(
    join(SHITENNO_DIR, "governance", "rule-manifest.yaml"),
    "rules"
  );
  const skills = readManifestEntries(
    join(SHITENNO_DIR, "governance", "skill-manifest.yaml"),
    "skills"
  );

  // Only unconditional mandatory (mandatory + no `when`)
  const unconditionalRules = rules.filter((r) => r.mandatory && !r.when);
  const unconditionalSkills = skills.filter((s) => s.mandatory && !s.when);

  if (unconditionalRules.length === 0 && unconditionalSkills.length === 0) {
    if (existsSync(MANDATORY_CONTEXT_PATH)) {
      writeFileSync(MANDATORY_CONTEXT_PATH, "<!-- No unconditional mandatory entries found -->\n", "utf-8");
    }
    return false;
  }

  const sections: string[] = [
    "# MANDATORY CONTEXT — Always-Applicable Rules & Skills",
    "",
    "> **Generated file.** Do not edit manually. Re-generated by `shugo sync`.",
    "> This file concatenates every rule and skill that is mandatory with no `when`",
    "> condition — i.e., applies to literally every session.",
    "> Task-scoped mandatory entries are resolved at runtime via MCP `getSkills`.",
    "",
  ];

  if (unconditionalRules.length > 0) {
    sections.push("## Mandatory Rules (always active)", "");
    for (const rule of unconditionalRules) {
      const contentPath = join(SHITENNO_DIR, rule.path);
      if (existsSync(contentPath)) {
        const content = readFileSync(contentPath, "utf-8");
        sections.push(`### ${rule.id}`, "", content.trim(), "");
      } else {
        sections.push(`### ${rule.id}`, "", `> ⚠️ File not found: \`${rule.path}\``, "");
      }
    }
  }

  if (unconditionalSkills.length > 0) {
    sections.push("## Mandatory Skills (always active)", "");
    for (const skill of unconditionalSkills) {
      const contentPath = join(SHITENNO_DIR, skill.path);
      if (existsSync(contentPath)) {
        const content = readFileSync(contentPath, "utf-8");
        sections.push(`### ${skill.id}`, "", content.trim(), "");
      } else {
        sections.push(`### ${skill.id}`, "", `> ⚠️ File not found: \`${skill.path}\``, "");
      }
    }
  }

  writeFileSync(MANDATORY_CONTEXT_PATH, sections.join("\n"), "utf-8");
  return true;
}

// ── Main ────────────────────────────────────────────────────────────────

function main(): void {
  const quiet = process.argv.includes("--quiet");

  if (!quiet) {
    console.log("\n📄 sync-docs — Regenerating documentation...\n");
  }

  const updated = regenerateSystemMap();

  if (updated && !quiet) {
    console.log("  ✔ SYSTEM_MAP_TREE.md updated");
  }

  // Phase 4: Generate MANDATORY_CONTEXT.md from manifests
  const mandatoryUpdated = regenerateMandatoryContext();
  if (mandatoryUpdated && !quiet) {
    console.log("  ✔ MANDATORY_CONTEXT.md updated");
  }

  if (!quiet) {
    console.log("\n✅ Documentation sync complete\n");
  }
}

main();
