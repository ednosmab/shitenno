---
category: implementation
lifecycle: Active
---

# 22 — README REFACTOR

> Plan to rewrite the README with the new architecture.

## Current State

The current README is 269 lines and covers:
- Basic CLI commands
- Installation instructions
- Simple examples

It does NOT cover:
- The three-tier state model
- The capability system
- The knowledge lifecycle
- The event-driven architecture
- The governance model
- AI agent integration
- The plugin system

## Target State

The new README should be a single-page overview that answers:

1. **What is Shugo?** — One paragraph
2. **Why does it exist?** — Problem statement
3. **How does it work?** — Mental model diagram
4. **Quick start** — 5-minute guide
5. **Architecture overview** — Link to docs/architecture/
6. **Commands reference** — Table of all commands
7. **For AI agents** — How to use Shugo as context
8. **Contributing** — Link to CONTRIBUTING.md

## Structure

```markdown
# Shitenno

> AI governance framework that grows with your project

## What is Shugo
[One paragraph]

## Why Shugo
[Problem + solution]

## Quick Start
[5-minute guide]

## Architecture
[Overview + link to docs/architecture/]

## Commands
[Table]

## For AI Agents
[Context hierarchy + governance rules]

## Contributing
[Link]

## License
[MIT]
```

## Principles

1. **Concise:** Under 200 lines
2. **Visual:** Use diagrams (Mermaid) over text
3. **Linked:** Detailed docs in docs/architecture/
4. **Updated:** Reflect current state, not future plans

## Implementation

- **File:** `README.md`
- **Lines:** ~150-200
- **Diagrams:** 2-3 Mermaid diagrams
- **Links:** 15+ links to architecture docs
