import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectDuplicateCode(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skipPatterns = [/\.test\.ts$/, /\.spec\.ts$/, /__tests__/];

  const lineBuckets = new Map<string, { file: string; line: number }[]>();
  const MAX_BUCKETS = 5_000;

  for (const file of files) {
    if (lineBuckets.size > MAX_BUCKETS) break;
    if (skipPatterns.some((p) => p.test(file.relPath))) continue;

    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length - 4; i++) {
      const block = lines.slice(i, i + 5).join("\n").trim();
      if (block.length < 50 || block.startsWith("//")) continue;

      const existing = lineBuckets.get(block);
      if (existing) {
        existing.push({ file: file.relPath, line: i + 1 });
      } else if (lineBuckets.size < MAX_BUCKETS) {
        lineBuckets.set(block, [{ file: file.relPath, line: i + 1 }]);
      }
    }
  }

  let duplicateBlocks = 0;
  const duplicateLocations: string[] = [];

  for (const [, locations] of lineBuckets) {
    if (locations.length > 1) {
      const uniqueFiles = new Set(locations.map((l) => l.file));
      if (uniqueFiles.size > 1) {
        duplicateBlocks++;
        if (duplicateLocations.length < 3) {
          duplicateLocations.push(locations.map((l) => `${l.file}:${l.line}`).join(" vs "));
        }
      }
    }
  }

  if (duplicateBlocks > 0) {
    issues.push({
      type: "duplicate_code",
      severity: duplicateBlocks > 5 ? 2 : 1,
      description: `${duplicateBlocks} bloco(s) de código duplicado(s) entre módulos`,
      location: duplicateLocations.join("; "),
      recommendation: "Extrair código duplicado para função partilhada (princípio DRY).",
      confidence: 0.65,
    });
  }

  return issues;
}
