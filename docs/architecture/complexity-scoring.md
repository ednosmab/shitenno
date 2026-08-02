---
category: architecture
lifecycle: Active
---

# 09 — COMPLEXITY EVOLUTION

> Scoring engine — static + behavioral, per area.

## The Scoring Model

Shugo computes complexity from two categories of metrics:

### Static Metrics (project structure)

| Metric | Weight | Description |
|--------|--------|-------------|
| Package count | 25 | Number of packages in the project |
| App count | 15 | Number of applications |
| Source file count | 20 | Number of .ts/.js files |
| Dependency count | 20 | Number of npm dependencies |
| Monorepo | 10 | Whether it's a monorepo |
| TypeScript | 10 | Whether TypeScript is used |

### Behavioral Metrics (team behavior)

| Metric | Weight | Description |
|--------|--------|-------------|
| Validation failures | 20 | Failed validation sessions |
| ADR count | 15 | Architecture decisions recorded |
| Open branches | 10 | Unmerged feature branches |
| Commits per week | 15 | Activity level |
| Sessions without close | 15 | Incomplete sessions |
| Bug fix commits | 10 | Maintenance activity |
| Agent count | 5 | AI agents configured |
| Skill count | 10 | Patterns extracted |

## Complexity Levels

| Score Range | Level | Meaning |
|-------------|-------|---------|
| 0-34 | Junior | Simple project, minimal governance |
| 35-64 | Pleno | Moderate complexity, some governance |
| 65-100 | Senior | High complexity, full governance needed |

## Per-Area Scoring

Each project subdirectory (area) gets its own complexity score:

```typescript
interface AreaScore {
  area: string;
  score: number;
  churn: number;        // How often files change
  violations: number;   // How often rules are broken
  sensitiveSurface: number; // Critical file count
  dependencyDepth: number;  // Import layers
  incidentFreeAge: number;  // Days since last issue
  contextPressure: number;  // Context needed
}
```

### Area Score Formula

```
areaScore = (churn * 0.25) + (violations * 0.25) + 
            (sensitiveSurface * 0.20) + (dependencyDepth * 0.15) +
            (incidentFreeAge * 0.10) + (contextPressure * 0.05)
```

## Performance Optimizations

The scoring engine is optimized for large projects:

1. **Batch git log:** Single `git log` call instead of per-file queries
2. **Pre-read history:** History is read once, shared across area scorers
3. **Parallel scoring:** Areas are scored in parallel using `Promise.all` + `setImmediate`
4. **Cache:** Results are cached with SHA256 checksums

### Benchmark Results

| Scale | Files | Areas | Time (no cache) | Time (cache) |
|-------|-------|-------|-----------------|--------------|
| Small | 20 | 3 | ~15ms | <1ms |
| Medium | 100 | 8 | ~45ms | <1ms |
| Large | 500 | 20 | ~106ms | <1ms |

## Report Output

Reports are written to `shitenno/reports/` as JSON:

```json
{
  "projectRoot": "/path/to/project",
  "overallScore": 67,
  "level": "pleno",
  "staticScore": 55,
  "behaviorScore": 79,
  "areaScores": [...],
  "reasons": [...],
  "suggestions": [...],
  "computedAt": "2026-06-27T19:00:00.000Z"
}
```

## Implementation

- **Main function:** `calculateComplexityScore()` in `src/scorer.ts:128`
- **Static metrics:** `src/scorer.ts:446-551`
- **Behavioral metrics:** `src/scorer.ts:554-690`
- **Area scoring:** `src/scorer.ts:264-415`
- **Report writer:** `writeComplexityReport()` in `src/scorer.ts:874-917`
