---
category: engineering
lifecycle: Active
---

# Manual Test: 5-Minute Onboarding

> **Objective:** Validate that a person with zero Shugo context can run `shugo init` and understand the output within 5 minutes, without asking anyone for help.
>
> **When to run:** After any change to README.md, dashboard `discover/` or `use/` pages, or onboarding-related content.
>
> **Estimated time:** 10 minutes (5 min test + 5 min debrief).

---

## Pre-conditions

- [ ] Dashboard is running: `pnpm --filter @shugo/dashboard dev`
- [ ] Shugo CLI is installed globally: `shugo --version` returns a version
- [ ] A test project exists (or create one with `mkdir /tmp/onboarding-test && cd /tmp/onboarding-test && git init`)
- [ ] Timer ready (phone, watch, or online timer)
- [ ] Participant has **never** used or read about Shugo before

---

## Test Script

### Step 1 — Present the entry point (0:00)

Give the participant ONE of these:
- **Option A:** The README.md link (open in browser)
- **Option B:** The dashboard URL (`http://localhost:5173`)

Say: *"This is a tool called Shugo. I want you to figure out what it does and try it. Go."*

Start the timer.

### Step 2 — Observe silently

Do **not** help the participant. Take notes on:

| Timestamp | What happened | Notes |
|---|---|---|
| 0:00 | Timer started | |
| | | |
| | | |

### Step 3 — Record the outcome

| Metric | Value |
|---|---|
| **Time to first command run** | ___:___ |
| **Command attempted** | |
| **Command succeeded?** | Yes / No |
| **Needed help?** | Yes / No — if yes, what was the question? |
| **Time to "I understand what this does"** | ___:___ |

---

## Pass / Fail Criteria

| Criterion | Pass | Fail |
|---|---|---|
| Found the install command | ≤ 60s | > 60s |
| Ran `shugo init` successfully | ≤ 3 min | > 3 min or gave up |
| Explained what Shugo does (1 sentence) | ≤ 5 min | > 5 min or couldn't |
| Did not ask for help | 0 questions | ≥ 1 question |

**Overall:** All 4 criteria pass = **PASS**. Any fail = **FAIL**.

---

## Post-test Questions (ask the participant)

1. *"In one sentence, what does Shugo do?"*
2. *"Who is this for?"*
3. *"Was anything confusing?"*
4. *"What would you change on this page?"*

Record answers:

| Question | Answer |
|---|---|
| What does it do? | |
| Who is it for? | |
| Confusing parts? | |
| Suggested changes? | |

---

## After the Test

| Action | Status |
|---|---|
| Record results in this file under "Results Log" | |
| If FAIL: identify the specific page/section that caused confusion | |
| If FAIL: create a fix and re-test | |
| Update backlog item status | |

---

## Results Log

| Date | Participant | Result | Time to first cmd | Time to understanding | Issues found |
|---|---|---|---|---|---|
| | | | | | |

---

*Last updated: 2026-07-03*
