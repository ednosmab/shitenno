import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { ANY_TYPE_SEVERITY_THRESHOLD } from "../constants.js";
import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectTypeSafetyIssues(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  let anyCount = 0;
  const anyFiles: string[] = [];

  for (const file of files) {
    const matches = file.content.match(/:\s*any\b|as\s+any\b|<any>/g);
    if (matches && matches.length > 0) {
      anyCount += matches.length;
      anyFiles.push(file.relPath);
    }
  }

  if (anyCount > 0) {
    issues.push({
      type: "any_type_usage",
      severity: anyCount > ANY_TYPE_SEVERITY_THRESHOLD ? 2 : 1,
      description: `${anyCount} uso(s) de \`any\` em ${anyFiles.length} arquivo(s) source`,
      location: anyFiles.slice(0, 3).join(", ") + (anyFiles.length > 3 ? ` (+${anyFiles.length - 3})` : ""),
      recommendation: "Substituir \`any\` por tipos adequados para melhorar type safety",
      confidence: 0.8,
    });
  }

  const tsconfigPath = join(projectRoot, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return issues;

  try {
    execSync("npx tsc --noEmit 2>&1", {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = String(e.stdout || e.stderr || "");
    const errorCount = (output.match(/error TS\d+:/g) || []).length;
    if (errorCount > 0) {
      issues.push({
        type: "type_error",
        severity: 2,
        description: `TypeScript compilador encontrou ${errorCount} erro(s) de tipo`,
        location: "src/",
        recommendation: "Corrigir erros de tipo TypeScript — execute 'npx tsc --noEmit' para detalhes",
        confidence: 0.8,
      });
    }
  }

  return issues;
}
