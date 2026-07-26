import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectJSDocCoverage(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const exportRegex = /^export\s+(?:function|const|class|interface|type|enum)\s+(\w+)/gm;
  const jsdocBlockRegex = /\/\*\*[\s\S]*?\*\/\s*$/m;

  let totalExports = 0;
  let missingJSDoc = 0;
  const missingFiles: string[] = [];

  for (const file of files) {
    if (file.basename === "index") continue;
    if (file.fullPath.includes("/bin/")) continue;

    const lines = file.content.split("\n");
    let fileMissing = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const match = exportRegex.exec(line);
      if (match) {
        totalExports++;
        const prevLines = lines.slice(Math.max(0, i - 5), i).join("\n");
        if (!jsdocBlockRegex.test(prevLines)) {
          fileMissing++;
          missingJSDoc++;
        }
      }
      exportRegex.lastIndex = 0;
    }

    if (fileMissing > 0 && missingFiles.length < 5) {
      missingFiles.push(`${file.relPath} (${fileMissing} exports)`);
    }
  }

  if (missingJSDoc > 0 && totalExports > 0) {
    const pct = Math.round((1 - missingJSDoc / totalExports) * 100);
    issues.push({
      type: "missing_jsdoc",
      severity: missingJSDoc > 10 ? 2 : 1,
      description: `${missingJSDoc}/${totalExports} exports sem JSDoc (${pct}% cobertura) — DESDO §4 requer JSDoc em todas as funções exportadas`,
      location: missingFiles.join(", "),
      recommendation: "Adicionar JSDoc com @param e @returns em todas as funções exportadas.",
      confidence: 0.7,
    });
  }

  return issues;
}
