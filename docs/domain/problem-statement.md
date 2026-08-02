---
category: domain
lifecycle: Active
---

# Problem Statement

> The problem that the Shitenno exists to solve.

## The Problem

Engineering teams accumulate knowledge but fail to govern it.

Every team writes Architecture Decision Records (ADRs). Every team documents skills. Every team defines workflows. But this knowledge:

1. **Lives in isolation** — an ADR doesn't connect to the skill it produced
2. **Decays silently** — a stale ADR is worse than no ADR
3. **Is never validated** — decisions are documented but never checked against implementation
4. **Lacks context** — each session starts from zero, re-reading everything
5. **Doesn't compound** — knowledge doesn't build on itself, it just accumulates

This creates **Knowledge Debt**: the invisible cost of undocumented, disconnected, and decaying engineering knowledge.

---

## Who Has This Problem

- **Solo developers** who lose context between sessions
- **Small teams** (2-5) where knowledge lives in one person's head
- **Growing teams** (5-15) where onboarding is painful
- **AI-assisted teams** where agents lack governance context

The problem is not limited to large enterprises. It affects any team that makes decisions and does not record them, detects patterns and does not formalize them, or uses AI agents without governed context.

---

## What Shugo Does

Shugo provides a systematic approach to engineering governance:

| Without Shugo | With Shugo |
|---------------|------------|
| Knowledge is documented but disconnected | Knowledge is graphed with explicit relations |
| Complexity is felt but not measured | Complexity is scored with static + behavioral metrics |
| Patterns are noticed but not tracked | Patterns are detected from history automatically |
| Governance is manual and inconsistent | Governance is automated through rules |
| AI agents operate without context | AI agents receive governed, hierarchical context |
| Evolution is ad-hoc | Evolution is recommended based on state |

---

## Non-Goals

Shugo explicitly does NOT:

1. **Replace engineering judgment** — It recommends; humans decide
2. **Enforce processes** — It suggests; teams choose
3. **Monitor runtime** — It analyzes governance, not uptime
4. **Manage tickets** — It tracks knowledge, not tasks
5. **Auto-apply changes** — It proposes; the principle "Shugo proposes, never applies" is absolute
6. **Replace CI/CD** — It complements; it does not compete
7. **Work for non-software projects** — It is an engineering governance tool, not a general project manager

---

## Success Criteria

Shugo is successful when:

1. A team can explain their engineering state in real-time
2. Knowledge Debt is detected before it compounds
3. AI agents respect governance rules without human enforcement
4. New team members onboard in hours, not weeks
5. The system recommends its own improvements and learns from acceptance

---

## Constraints

- **Must work with existing tools** — integrates with git, npm, TypeScript projects
- **Must respect team maturity** — adapts to junior/advanced teams without forcing workflow changes
- **Must be non-invasive** — reads and recommends, never auto-applies changes
- **Must support AI agents** — provides governed context for LLM-powered tools

---

## Relationship to Other Domain Concepts

The Problem Statement defines why the following concepts exist:

- **Knowledge Debt** — the problem that must be detected and resolved
- **Engineering State** — the measurement that makes the problem visible
- **Capabilities** — the units of governance that address the problem
- **Knowledge Lifecycle** — the process that transforms knowledge from tacit to operational

Without this problem, Shugo would not exist.

---

*This document defines the problem domain. For the formal specification of related concepts, see [ubiquitous-language.md](./ubiquitous-language.md).*

*Last updated: 2026-06-28*
