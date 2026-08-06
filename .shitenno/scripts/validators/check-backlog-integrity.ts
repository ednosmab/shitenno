/**
 * Validator: check backlog integrity.
 *
 * Guards against the failure mode found while validating the MCP's
 * getBacklog/getBriefing output against docs/backlog/ACTIVE.md: a table
 * block with no "### ID Titulo" header of its own gets excluded from
 * parsing (since the backlog-parser.ts fix) instead of silently corrupting
 * the preceding item's state/description — but excluded is still wrong
 * data sitting in the file. This check makes that failure loud at
 * `validate:docs` / CI time, instead of only surfacing reactively the next
 * time someone calls the MCP's getBacklog tool.
 */

import { resolve } from "node:path";
import { parseBacklogWithIntegrity } from "../../../src/application/backlog-core.js";
import { SHUGO, type ValidatorContext, error, pass } from "./shared.js";

export function checkBacklogIntegrity(ctx: ValidatorContext) {
  console.log("\n📋 Checking backlog integrity...\n");

  const activePath = resolve(SHUGO, "docs", "backlog", "ACTIVE.md");
  const donePath = resolve(SHUGO, "docs", "backlog", "DONE.md");

  let totalIssues = 0;

  for (const path of [activePath, donePath]) {
    const { issues } = parseBacklogWithIntegrity(path);
    totalIssues += issues.length;
    for (const issue of issues) {
      error(
        ctx,
        `Orphan table block without a "### " header right after ${issue.precedingItemId} (line ${issue.line + 1}, repeated field: ${issue.repeatedField}) — content excluded from parse; review and remove it or give it its own ID.`,
        path,
        false,
      );
    }
  }

  if (totalIssues === 0) {
    pass(ctx, "Backlog has no orphan blocks (all items have their own header)");
  }
}
