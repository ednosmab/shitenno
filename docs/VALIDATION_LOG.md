---
category: product
lifecycle: Active
---

# Validation Log — Cross-Project & Cross-Platform

This document records manual validation of Shitenno in third-party projects. The goal: verify the tool works end-to-end outside the author's own Node/TS repo.

> **Philosophy:** Don't trust the claim — trust the record. Same principle as `.verification.json` from Block F.

---

## Validation Protocol (H.4)

Before updating `README.md` from "not tested with real users yet" to any claim with a real number, the following steps must be completed:

1. **Choose a real project with a different stack** — not another Node/TS project. Examples: Python, Go, Rust, or a frontend-only repo using a different framework.
2. **Run `shugo init` from scratch** — no help from the original author. Follow only what the documentation says.
3. **Record every friction point**: confusing error messages, commands that assume something that doesn't exist in the target project (e.g. `package.json` in a Python repo), documentation that assumes prior knowledge.
4. **Use it for at least one week** — real usage, not just `init`. This is when the daemon, reminders, modular backlog, and Block F gate are truly exercised under real conditions.
5. **Only then update `README.md`** — and not before, because that sentence ("not tested with real users yet") is currently the most honest part of the project.

---

## Validation Records

<!-- Append new records below. Format:

### Validation #N — YYYY-MM-DD

- **Project:** <project name/type (anonymized if needed)>
- **Stack:** <language, framework, package manager>
- **OS:** <Linux/macOS/Windows>
- **Node version:** <version>
- **Shitenno version:** <version>

**Steps followed:**
1. <step-by-step what was done>

**Friction points found:**
- <issue 1>
- <issue 2>

**What was fixed because of this validation:**
- <fix 1> (commit: <hash> or plan reference)
- <none yet — recording for future fix>

**Outcome:** <passed / passed with caveats / failed — reasons>
-->

_No validations recorded yet. The first validation should be performed before any "team usage" claims are made in README.md._
