---
category: architecture
lifecycle: Active
---

# Capability Engine

> Implementation of the Capability Model in software.

## Domain Concept

The [Capability Model](../domain/capability-model.md) defines capabilities as modular units of governance functionality. This document describes how that concept is implemented.

---

## Implementation Structure

### Capability Definitions

Each capability is defined as a data structure containing:

```
Capability {
  id: string           // Unique identifier (e.g., "core", "ai", "governance")
  name: string         // Human-readable name
  dimensions: Map      // Maturity dimensions impacted with weights
  requires: List       // Dependencies (other capabilities)
  alwaysInstalled: bool // Whether it's installed by default
}
```

### Capability Mapping

Each capability maps to specific filesystem artifacts:

```
CapabilityMapping {
  capability: string     // Capability ID
  directories: List      // Expected directories
  files: List            // Expected files
  detectionCriteria: Map // How to detect if capability is installed
}
```

### Detection Logic

Installed capabilities are detected by checking for the presence of their expected artifacts:

```
function detectInstalledCapabilities(projectRoot):
  installed = []
  for each capability in CAPABILITIES:
    if capability.alwaysInstalled:
      installed.add(capability.id)
      continue
    if artifactsExist(projectRoot, capability.mapping):
      installed.add(capability.id)
  return installed
```

### Recommendation Logic

Capabilities are recommended based on maturity dimension scores:

```
function recommendCapabilities(dimensions, installed):
  recommended = []
  for each capability in CAPABILITIES:
    if capability.alwaysInstalled: continue
    if capability.id in installed: continue
    
    relevance = computeRelevance(capability, dimensions)
    if relevance >= THRESHOLD:
      if dependenciesMet(capability, installed, recommended):
        recommended.add(capability.id)
  
  return recommended
```

The relevance is computed by comparing the capability's dimension weights against the team's current dimension scores.

---

## Key Files

| File | Responsibility |
|------|---------------|
| `src/maturity-profile.ts` | Capability definitions, detection, recommendation |
| `src/capability-mapping.ts` | Filesystem artifact mappings |
| `src/commands/upgrade.ts` | Capability installation |

---

## Data Flow

```
Maturity Profile → Capability Engine → Recommendations
                        ↓
                  Detection Logic
                        ↓
                  Installed Capabilities
```

---

## Invariants

1. Capabilities are defined as data, not code
2. Detection is filesystem-based (no configuration required)
3. Recommendations are based on maturity evidence
4. Dependencies must be satisfied before installation
5. The `core` capability is always installed

---

*This document describes the implementation of the Capability Model. For the conceptual definition, see [../domain/capability-model.md](../domain/capability-model.md).*

*Last updated: 2026-06-28*
