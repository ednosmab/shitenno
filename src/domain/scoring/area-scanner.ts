/**
 * area-scanner.ts — Area Metrics Collection
 *
 * Scans source files within an area to compute file count,
 * sensitive surface, and dependency depth metrics.
 */

import { existsSync } from "node:fs";
import { walkSourceFiles } from "../../infrastructure/utils.js";
import type { FileContentCache } from "../../infrastructure/utils.js";

// ── Area Metrics ────────────────────────────────────────────────────────────

export interface AreaMetrics {
  fileCount: number;
  sensitiveSurface: number;
  dependencyDepth: number;
}

export function batchScoreArea(
  areaPath: string,
  allAreas: string[],
  sensitiveKeywords: string[],
  cache: FileContentCache
): AreaMetrics {
  const result: AreaMetrics = { fileCount: 0, sensitiveSurface: 0, dependencyDepth: 0 };
  if (!existsSync(areaPath)) return result;

  const otherAreas = allAreas
    .filter((a) => !areaPath.includes(a))
    .map((a) => ({ full: a, short: a.split("/").pop()! }));

  const importRegex = /^(?:import|from)\s+.*["'](.*)["']/;

  walkSourceFiles(
    areaPath,
    (fullPath) => {
      result.fileCount++;
      const content = cache.get(fullPath);
      if (content === null) return;

      const lower = content.toLowerCase();
      for (const kw of sensitiveKeywords) {
        if (lower.includes(kw.toLowerCase())) {
          result.sensitiveSurface++;
          break;
        }
      }

      for (const line of content.split("\n")) {
        const match = line.match(importRegex);
        if (!match) continue;
        const importPath = match[1];
        if (!importPath) continue;
        for (const { full, short } of otherAreas) {
          if (
            importPath.includes(`../${short}/`) ||
            importPath.includes(`./${short}/`) ||
            importPath.includes(`../${full}/`) ||
            importPath.includes(`./${full}/`) ||
            importPath.startsWith(full + "/")
          ) {
            result.dependencyDepth++;
            break;
          }
        }
      }
    },
    { includeAll: true }
  );

  return result;
}
