---
category: architecture
lifecycle: Active
---

# 19 — PLUGIN SYSTEM

> Hooks and extensibility.

## The Problem

Today, extending Shugo requires modifying core code. If a team wants custom checks, custom recommendations, or custom capabilities, they must fork the repository.

The plugin system allows extension without modification.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   SHUGO CORE                        │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Analysis   │  │  Governance │  │  Evolution  │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │         │
│         └────────────────┼────────────────┘         │
│                          │                          │
│                   ┌──────┴──────┐                   │
│                   │  HOOK BUS   │                   │
│                   └──────┬──────┘                   │
│                          │                          │
└──────────────────────────┼──────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
       ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
       │ Plugin A│   │ Plugin B│   │ Plugin C│
       └─────────┘   └─────────┘   └─────────┘
```

## Hook Types

| Hook | When It Fires | Input | Output |
|------|--------------|-------|--------|
| `pre-analysis` | Before project analysis | Project root | Modified options |
| `post-analysis` | After project analysis | Analysis result | Enriched analysis |
| `pre-scaffold` | Before scaffolding | Capabilities, answers | Modified capabilities |
| `post-scaffold` | After scaffolding | Scaffold result | Additional actions |
| `custom-check` | During health audit | Shugo dir | Additional issues |
| `custom-recommendation` | During evolution | State, debt | Additional recommendations |
| `custom-metric` | During scoring | Metrics | Additional metrics |

## The Plugin Interface

```typescript
interface ShitennoPlugin {
  name: string;
  version: string;
  description: string;
  
  // Lifecycle hooks
  hooks?: {
    "pre-analysis"?: (ctx: PipelineContext) => Promise<PipelineContext>;
    "post-analysis"?: (ctx: PipelineContext) => Promise<PipelineContext>;
    "pre-scaffold"?: (ctx: ScaffoldContext) => Promise<ScaffoldContext>;
    "post-scaffold"?: (ctx: ScaffoldResult) => Promise<ScaffoldResult>;
    "custom-check"?: (shitennoDir: string) => Promise<HealthIssue[]>;
    "custom-recommendation"?: (state: ShitennoState) => Promise<EvolutionRecommendation[]>;
    "custom-metric"?: (metrics: MetricSet) => Promise<MetricSet>;
  };
}
```

## Plugin Discovery

Plugins are discovered from two locations:

### 1. Project-Level Plugins

```
project-root/
└── shitenno/
    ├── plugins/
    │   ├── my-custom-check/
    │   │   └── plugin.ts
    │   └── my-scoring-metric/
    │   │   └── plugin.ts
    └── opencode.json
```

### 2. Global Plugins

```
~/.config/shugo/plugins/
├── shared-plugin-a/
│   └── plugin.ts
└── shared-plugin-b/
    └── plugin.ts
```

## Plugin Loading

```typescript
function loadPlugins(projectRoot: string): ShitennoPlugin[] {
  const plugins: ShitennoPlugin[] = [];
  
  // Load project-level plugins
  const projectPluginsDir = join(projectRoot, "shitenno", "plugins");
  if (existsSync(projectPluginsDir)) {
    const dirs = readdirSync(projectPluginsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    
    for (const dir of dirs) {
      const pluginPath = join(projectPluginsDir, dir.name, "plugin.ts");
      if (existsSync(pluginPath)) {
        const plugin = await import(pluginPath);
        plugins.push(plugin.default);
      }
    }
  }
  
  // Load global plugins
  const globalPluginsDir = join(homedir(), ".config", "shugo", "plugins");
  if (existsSync(globalPluginsDir)) {
    // Similar loading logic
  }
  
  return plugins;
}
```

## Hook Execution

```typescript
class HookBus {
  private plugins: ShitennoPlugin[] = [];

  registerPlugin(plugin: ShitennoPlugin): void {
    this.plugins.push(plugin);
  }

  async executeHook<T>(
    hookName: keyof ShitennoPlugin["hooks"],
    input: T,
    transformer: (plugin: ShitennoPlugin, input: T) => Promise<T>
  ): Promise<T> {
    let current = input;
    
    for (const plugin of this.plugins) {
      if (plugin.hooks?.[hookName]) {
        current = await transformer(plugin, current);
      }
    }
    
    return current;
  }
}
```

## Usage Example

### Custom Health Check Plugin

```typescript
// shitenno/plugins/my-check/plugin.ts
import type { ShitennoPlugin } from "shitenno";

const plugin: ShitennoPlugin = {
  name: "my-custom-check",
  version: "1.0.0",
  description: "Checks for custom governance rules",
  
  hooks: {
    "custom-check": async (shitennoDir) => {
      const issues = [];
      
      // Check for custom rule
      const customRulePath = join(shitennoDir, "governance", "CUSTOM_RULE.md");
      if (!existsSync(customRulePath)) {
        issues.push({
          type: "missing_docs",
          severity: "medium",
          description: "Custom governance rule not found",
          recommendation: "Create CUSTOM_RULE.md",
        });
      }
      
      return issues;
    },
  },
};

export default plugin;
```

### Custom Scoring Metric Plugin

```typescript
// shitenno/plugins/my-metric/plugin.ts
const plugin: ShitennoPlugin = {
  name: "my-scoring-metric",
  version: "1.0.0",
  description: "Adds custom scoring metric",
  
  hooks: {
    "custom-metric": async (metrics) => {
      metrics.custom = {
        myMetric: calculateMyMetric(),
      };
      return metrics;
    },
  },
};

export default plugin;
```

## Safety

- Plugins run in the same process as Shugo (no sandboxing)
- Plugin errors are caught and logged, not propagated
- Plugins cannot modify Shugo core
- Plugins are loaded once at startup

## Plugin Manifest (Optional)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "shitennoVersion": ">=0.1.0",
  "hooks": ["custom-check", "custom-recommendation"],
  "author": "Me"
}
```

## Implementation

- **File:** `src/plugin-system.ts` (~200 lines)
- **Hook bus:** `HookBus` class
- **Plugin loader:** `loadPlugins()`
- **Integration:** Pipeline stages execute hooks
