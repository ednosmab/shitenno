---
category: architecture
lifecycle: Active
---

# 21 — COMMAND ARCHITECTURE

> Command patterns, shared infrastructure.

## The Problem

Today, each Shugo command duplicates:
- Initialization guard (~20 lines each)
- Banner display (~5 lines each)
- JSON output mode (~10 lines each)
- Cache read/write (~15 lines each)
- Report writing (~20 lines each)

Total: ~280 lines of duplicated code across 13 commands.

## The Solution: Shared Infrastructure

### 1. resolveProjectContext()

Replaces the duplicated initialization guard in every command:

```typescript
interface ProjectContext {
  projectRoot: string;
  shitennoDir: string;
  isInitialized: boolean;
  hasMaturityProfile: boolean;
}

function resolveProjectContext(options: { dir?: string }): ProjectContext {
  const projectRoot = options.dir || process.cwd();
  const shitennoDir = join(projectRoot, "shitenno");
  
  const isInitialized = existsSync(join(projectRoot, "opencode.json")) 
    && existsSync(shitennoDir);
  
  const hasMaturityProfile = existsSync(join(shitennoDir, "maturity-profile.json"));
  
  return { projectRoot, shitennoDir, isInitialized, hasMaturityProfile };
}
```

### 2. createCommand()

Wraps command creation with common patterns:

```typescript
function createCommand(
  name: string,
  description: string,
  action: (ctx: ProjectContext, options: Record<string, unknown>) => Promise<void>
): Command {
  const cmd = new Command(name)
    .description(description)
    .option("-d, --dir <path>", "Project directory")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const isJson = options.json === true;
      
      if (!isJson) {
        console.log(`\n╔══╗  ${name.toUpperCase()}`);
        console.log(`╚══╝  ${description}\n`);
      }
      
      try {
        const ctx = resolveProjectContext(options);
        
        if (!ctx.isInitialized) {
          const error = { error: "not_initialized", message: "Run `shugo init` first" };
          if (isJson) {
            console.log(JSON.stringify(error));
          } else {
            console.error(error.message);
          }
          process.exit(1);
        }
        
        await action(ctx, options);
      } catch (error) {
        const err = { error: "unknown", message: String(error) };
        if (isJson) {
          console.log(JSON.stringify(err));
        } else {
          console.error(err.message);
        }
        process.exit(1);
      }
    });
  
  return cmd;
}
```

### 3. withCache()

Wraps cache read/write:

```typescript
async function withCache<T>(
  projectRoot: string,
  shitennoDir: string,
  key: string,
  compute: () => Promise<T>,
  options?: { force?: boolean }
): Promise<{ data: T; cacheHit: boolean }> {
  if (!options?.force) {
    const cached = getCached(projectRoot, shitennoDir, key);
    if (cached) {
      return { data: cached as T, cacheHit: true };
    }
  }
  
  const data = await compute();
  setCache(projectRoot, shitennoDir, key, data);
  return { data, cacheHit: false };
}
```

### 4. writeReport()

Replaces duplicated report writing:

```typescript
function writeReport(
  shitennoDir: string,
  prefix: string,
  report: Record<string, unknown>
): string | null {
  const reportsDir = join(shitennoDir, "reports");
  if (!existsSync(reportsDir)) return null;
  
  const date = new Date().toISOString().split("T")[0];
  const existing = readdirSync(reportsDir).filter(f => f.startsWith(`${prefix}-${date}`));
  const sessionNum = existing.length + 1;
  
  const filename = `${prefix}-${date}-session${sessionNum}.json`;
  const filepath = join(reportsDir, filename);
  
  writeFileSync(filepath, JSON.stringify(report, null, 2));
  return filename;
}
```

### 5. Rendering Functions

Extract duplicated display logic:

```typescript
// formatting.ts additions

function renderDimensionBars(
  dimensions: Record<string, number>,
  previous?: Record<string, number>
): string {
  // Renders the 7-dimension maturity bar chart
}

function renderCapabilityList(
  installed: string[],
  recommended: string[],
  future: string[]
): string {
  // Renders capability list with icons
}

function renderCheckResults(
  checks: Array<{ name: string; status: "pass" | "warn" | "fail"; message: string }>
): string {
  // Renders pass/warn/fail results
}
```

## Before/After

### Before (status command init guard)

```typescript
// Duplicated in 8 commands (~20 lines each)
const projectRoot = options.dir || process.cwd();
const shitennoDir = join(projectRoot, "shitenno");

if (!existsSync(join(projectRoot, "opencode.json"))) {
  if (isJson) {
    console.log(JSON.stringify({ error: "not_initialized", message: "..." }));
  } else {
    console.error("Project not initialized. Run `shugo init` first.");
  }
  process.exit(1);
}

if (!existsSync(shitennoDir)) {
  if (isJson) {
    console.log(JSON.stringify({ error: "not_initialized", message: "..." }));
  } else {
    console.error("shitenno/ directory not found. Run `shugo init`.");
  }
  process.exit(1);
}
```

### After (status command)

```typescript
const cmd = createCommand("status", "Health check + complexity scoring", async (ctx) => {
  // Just the business logic, no boilerplate
  const { data: report, cacheHit } = await withCache(
    ctx.projectRoot, ctx.shitennoDir, "complexity",
    () => calculateComplexityScore(ctx.projectRoot, ctx.shitennoDir)
  );
  
  if (isJson) {
    outputJson({ ...report, cacheHit });
  } else {
    displayReport(report);
  }
});
```

## Implementation

- **File:** `src/shared.ts` (~200 lines)
- **Rendering:** Additions to `src/formatting.ts`
- **Refactor:** Update all 13 commands to use shared infrastructure
- **Tests:** `src/__tests__/shared.test.ts`
