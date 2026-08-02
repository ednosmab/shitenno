---
category: domain
lifecycle: Active
---

# Capability Model

> Install what you need, not what a label dictates.

## Definition

A Capability is a modular unit of governance functionality that represents a dimension of engineering maturity. Capabilities are not features — they are commitments to govern a specific aspect of engineering practice.

When a team installs a capability, it is accepting governance for a new dimension of its engineering practice. This acceptance must be earned through knowledge, not assumed through installation.

---

## The 9 Capabilities

Shugo functionality is organized into 9 modular capabilities:

| Capability | Dimensions Impacted | Dependencies | Always Installed |
|------------|-------------------|--------------|-----------------|
| `core` | — | — | Yes |
| `knowledge` | documentation, quality | core | No |
| `architecture` | architecture, documentation | core | No |
| `governance` | governance, documentation | core | No |
| `ai` | ai, governance | governance | No |
| `quality` | quality, automation | core | No |
| `metrics` | observability, quality | quality | No |
| `operations` | automation, governance | core | No |
| `compliance` | governance, quality | governance | No |

---

## Dependency Graph

```
                    ┌─────────┐
                    │  core   │
                    └────┬────┘
          ┌──────────────┼──────────────┐
          │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │knowledge│   │ quality │   │  ops    │
     └─────────┘   └────┬────┘   └─────────┘
                        │
                   ┌────┴────┐
                   │ metrics │
                   └─────────┘
          │              │              │
     ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
     │  arch   │   │ govern. │   │         │
     └─────────┘   └────┬────┘   └─────────┘
                   ┌────┴────┐
              ┌────┴────┐ ┌──┴──────┐
              │  ai     │ │ compli. │
              └─────────┘ └─────────┘
```

Dependencies flow downward. `ai` requires `governance`. `governance` requires `core`. You cannot install a capability before its dependencies.

---

## How Capabilities Are Recommended

Capabilities are recommended based on maturity dimension scores. Each capability impacts specific dimensions. When a dimension has a high score, the capabilities that strengthen it become relevant.

The recommendation process:
1. Evaluate each capability's relevance to current maturity dimensions
2. Check if dependencies are met
3. Recommend capabilities whose dependencies are satisfied and whose dimensions are relevant

This ensures that capabilities are recommended based on evidence, not arbitrary labels.

---

## How Capabilities Are Detected

Installed capabilities are detected by the presence of their expected artifacts:

| Capability | Detection Criteria |
|------------|-------------------|
| `knowledge` | Skills directory or agents documentation exists |
| `architecture` | ADRs, SDRs, or plans directory exists |
| `governance` | Workflow or context directory exists |
| `ai` | Agent contracts or cognition directory exists |
| `quality` | Validation scripts exist |
| `metrics` | Reports directory exists |
| `operations` | Close scripts or runbooks exist |
| `compliance` | Premortem or review documents exist |

If the artifacts exist, the capability is considered installed. This is a filesystem-based detection — no configuration required.

---

## Capability Lifecycle

A capability follows this lifecycle:

```
Dormant → Installed → Configured → Active → Optimized
```

1. **Dormant:** The capability is available but not installed.
2. **Installed:** The capability's artifacts have been created.
3. **Configured:** The capability has been customized for the project.
4. **Active:** The capability is being used in governance.
5. **Optimized:** The capability has been refined through feedback.

Not all capabilities need to reach Optimized. The lifecycle describes potential, not requirement.

---

## Capabilities and Maturity

Each capability impacts specific maturity dimensions:

```
Architecture ████████░░ 80
Governance   ██████░░░░ 60
Quality      █████████░ 90
Automation   ████░░░░░░ 40
AI           ██░░░░░░░░ 20
Documentation ███████░░░ 70
Observability ███░░░░░░░ 30
```

When a dimension is weak, the capabilities that strengthen it become higher priority. This ensures that governance investments target the most impactful areas.

---

## Invariants

1. Capabilities are modular units of governance, not features
2. Dependencies must be satisfied before installation
3. Detection is based on artifact presence, not configuration
4. Capabilities are recommended based on maturity evidence
5. The `core` capability is always installed
6. No capability can be installed without its dependencies

---

*This document defines the Capability Model. For the formal specification of capability-related concepts, see [ubiquitous-language.md](./ubiquitous-language.md). For implementation details, see [architecture/capability-engine.md](../architecture/capability-engine.md).*

*Last updated: 2026-06-28*
