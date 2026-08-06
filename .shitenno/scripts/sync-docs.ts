#!/usr/bin/env npx tsx
/**
 * sync-docs.ts — Documentation Sync & Validation (orchestrator)
 *
 * Validates documentation structure and optionally auto-fixes discrepancies.
 *
 * Flags:
 *   (none)       Validate only (read-only, exit 1 on errors)
 *   --fix        Validate + apply auto-fixes
 *   --dry-run    Validate + show what --fix would change (no writes)
 *   --quiet / -q Minimal output
 *   --verbose / -v  Detailed output
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { SHUGO, type ValidatorContext } from "./validators/shared.js";
import { checkDocumentedDirectories } from "./validators/check-documented-dirs.js";
import { checkUndocumentedDirectories } from "./validators/check-undocumented-dirs.js";
import { checkCLICommands } from "./validators/check-cli-commands.js";
import { checkSkillsCount } from "./validators/check-skills-count.js";
import { checkBrokenReferences } from "./validators/check-broken-refs.js";
import { checkSystemMap } from "./validators/check-system-map.js";
import { checkREADMEStatistics } from "./validators/check-readme-stats.js";
import { checkVersionConsistency } from "./validators/check-version-consistency.js";
import { checkScriptReferences } from "./validators/check-script-refs.js";
import { checkDocsFrontmatter } from "./validators/check-docs-frontmatter.js";
import { checkBacklogIntegrity } from "./validators/check-backlog-integrity.js";

// ── CLI Flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ctx: ValidatorContext = {
  discrepancies: [],
  fixActions: [],
  QUIET: args.includes("--quiet") || args.includes("-q"),
  VERBOSE: args.includes("--verbose") || args.includes("-v"),
  FIX: args.includes("--fix"),
  DRY_RUN: args.includes("--dry-run"),
};
const AUTO = args.includes("--auto");

function log(message: string) {
  if (!ctx.QUIET) console.log(message);
}

function generateReport() {
  const report = {
    generated_at: new Date().toISOString(),
    mode: ctx.DRY_RUN ? "dry-run" : ctx.FIX ? "fix" : AUTO ? "auto" : "validate",
    total_discrepancies: ctx.discrepancies.length,
    errors: ctx.discrepancies.filter((d) => d.severity === "error").length,
    warnings: ctx.discrepancies.filter((d) => d.severity === "warning").length,
    fixable: ctx.discrepancies.filter((d) => d.fixable).length,
    fix_actions_applied: ctx.FIX ? ctx.fixActions.length : 0,
    discrepancies: ctx.discrepancies,
  };

  const reportsDir = resolve(SHUGO, "reports");
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  const date = new Date().toISOString().split("T")[0];
  writeFileSync(resolve(reportsDir, `doc-sync-${date}.json`), JSON.stringify(report, null, 2));
  log(`\n📄 Report saved to: reports/doc-sync-${date}.json`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const modeLabel = ctx.DRY_RUN ? "DRY RUN" : ctx.FIX ? "VALIDATE + FIX" : "VALIDATE ONLY";
  log(`\n🔄 SYNC DOCS — ${modeLabel}\n`);

  // ── Semantic drift check — runs before SYSTEM_MAP so feedback records
  // created here are captured by the directory tree ───────────────────────
  try {
    const { runSemanticDocSync } = await import("../../src/infrastructure/doc-semantic-sync.js");
    const semanticResult = runSemanticDocSync({ projectRoot: resolve(SHUGO, "..", ".."), shitennoDir: SHUGO });
    if (!ctx.QUIET && semanticResult.driftFound > 0) {
      log(`\n🧠 Drift semântico: ${semanticResult.driftFound} doc(s) desalinhado(s). ${semanticResult.remindersWritten} reminder(s) novo(s) escrito(s) em context_buffer.yaml.`);
    }
  } catch {
    if (ctx.VERBOSE) log("\n⚠️  Semantic drift check skipped (module not available)");
  }

  checkDocumentedDirectories(ctx);
  checkUndocumentedDirectories(ctx);
  checkCLICommands(ctx);
  checkSkillsCount(ctx);
  checkBrokenReferences(ctx);
  checkSystemMap(ctx);
  checkREADMEStatistics(ctx);
  checkVersionConsistency(ctx);
  checkScriptReferences(ctx);
  checkDocsFrontmatter(ctx);
  checkBacklogIntegrity(ctx);

  const errors = ctx.discrepancies.filter((d) => d.severity === "error").length;
  const warnings = ctx.discrepancies.filter((d) => d.severity === "warning").length;
  const fixable = ctx.discrepancies.filter((d) => d.fixable).length;

  if (ctx.DRY_RUN) log(`\n📊 Dry run: ${ctx.fixActions.length} fixes would be applied`);
  else if (ctx.FIX) log(`\n📊 Applied ${ctx.fixActions.length} fixes`);

  log(`\n📊 Summary: ${errors} errors, ${warnings} warnings (${fixable} fixable)`);

  generateReport();

  if (errors > 0 && !ctx.FIX) {
    log("\n❌ Documentation sync failed — run with --fix to auto-fix");
    process.exit(1);
  } else if (errors > 0 && ctx.FIX) {
    log("\n⚠️  Some issues require manual intervention");
    process.exit(1);
  } else if (warnings > 0) {
    log("\n⚠️  Documentation sync passed with warnings\n");
    process.exit(0);
  } else {
    log("\n✅ Documentation fully synced\n");
    process.exit(0);
  }
}

main();
