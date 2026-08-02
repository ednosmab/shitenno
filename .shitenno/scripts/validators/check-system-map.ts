/**
 * Validator: regenerate SYSTEM_MAP directory tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SYSTEM_MAP_TREE, SHUGO, type ValidatorContext, type FixAction, pass, warn, error, dryLog } from "./shared.js";
import { walkDir } from "./shared.js";

export function checkSystemMap(ctx: ValidatorContext) {
  console.log("\n🗺️  Checking SYSTEM_MAP_TREE.md...\n");

  if (!existsSync(SYSTEM_MAP_TREE)) {
    warn(ctx, "SYSTEM_MAP_TREE.md not found — skipping");
    return;
  }

  const content = readFileSync(SYSTEM_MAP_TREE, "utf-8");
  const startMarker = "<!-- SYNC:START -->";
  const endMarker = "<!-- SYNC:END -->";

  if (!content.includes(startMarker) || !content.includes(endMarker)) {
    warn(ctx, "SYSTEM_MAP_TREE.md missing SYNC markers — cannot auto-regenerate");
    return;
  }

  const files = walkDir(SHUGO);
  const tree = files.map((f) => `│   ${f}`).join("\n");
  const newBlock = `${startMarker}\n\`\`\`\n${tree}\n\`\`\`\n${endMarker}`;
  const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, "g");
  const expected = content.replace(regex, newBlock);

  if (expected === content) {
    pass(ctx, "SYSTEM_MAP_TREE.md tree is up to date");
    return;
  }

  ctx.fixActions.push({
    file: "shitenno/governance/SYSTEM_MAP_TREE.md",
    description: "Regenerate directory tree in SYSTEM_MAP_TREE.md",
    apply: () => { writeFileSync(SYSTEM_MAP_TREE, expected, "utf-8"); },
  });

  if (ctx.DRY_RUN) {
    dryLog(ctx, "SYSTEM_MAP_TREE.md directory tree regeneration");
  } else if (ctx.FIX) {
    ctx.fixActions[ctx.fixActions.length - 1].apply();
    pass(ctx, "Fixed: SYSTEM_MAP_TREE.md tree regenerated");
  } else {
    error(ctx, "SYSTEM_MAP_TREE.md directory tree is outdated", "shitenno/governance/SYSTEM_MAP_TREE.md", true);
  }
}
