/**
 * Validator: check undocumented directories exist.
 *
 * Instead of a hardcoded list, this validator parses the GUIDE's
 * section 10 ("Directórios do Projecto") to extract documented
 * directory names, then compares with actual directories.
 * Hidden directories (starting with '.') are ignored.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { SHUGO, TEMPLATE_DOCS, type ValidatorContext, pass, warn } from "./shared.js";

/**
 * Extract directory names mentioned in the GUIDE's section 10.
 * Parses both the code block tree and the capability table.
 */
function extractDocumentedDirs(guidePath: string): string[] {
  if (!existsSync(guidePath)) return [];

  const content = readFileSync(guidePath, "utf-8");
  const dirs = new Set<string>();

  // 1. Parse the code block tree (lines like "├── dirname/" or "│    ├── dirname/")
  const treeRegex = /[├└]──\s+(\w[\w-]*)\//gm;
  let match;
  while ((match = treeRegex.exec(content)) !== null) {
    if (match[1]) dirs.add(match[1]);
  }

  // 2. Parse the architecture diagram (lines like "│    ├── dirname/" or "│    └── dirname/")
  const archRegex = /│\s*[├└]──\s+(\w[\w-]*)\//gm;
  while ((match = archRegex.exec(content)) !== null) {
    if (match[1]) dirs.add(match[1]);
  }

  // 3. Parse the capability table (lines like "| `dirname/` |")
  const tableRegex = /\|\s*`(\w[\w-]*)\/`\s*\|/gm;
  while ((match = tableRegex.exec(content)) !== null) {
    if (match[1]) dirs.add(match[1]);
  }

  return Array.from(dirs);
}

export function checkUndocumentedDirectories(ctx: ValidatorContext) {
  console.log("\n🔍 Checking for undocumented directories...\n");

  // Use the template GUIDE as the source of truth (not the installed GUIDE which can be customized)
  const guidePath = join(TEMPLATE_DOCS, "Shitenno_GUIDE.md");
  const documentedDirs = extractDocumentedDirs(guidePath);

  if (documentedDirs.length === 0) {
    warn(ctx, "Could not extract documented directories from GUIDE — skipping check");
    return;
  }

  pass(ctx, `Found ${documentedDirs.length} documented directories in GUIDE`);

  const shitennoDirs = readdirSync(SHUGO).filter((f) => {
    try { return statSync(join(SHUGO, f)).isDirectory(); }
    catch { return false; }
  });

  for (const dir of shitennoDirs) {
    // Skip hidden directories (start with .)
    if (dir.startsWith(".")) continue;

    if (!documentedDirs.includes(dir)) {
      warn(ctx, `Directory exists but not documented in GUIDE: ${dir}/`);
    }
  }
}
