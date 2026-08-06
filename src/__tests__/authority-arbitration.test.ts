/**
 * authority-arbitration.test.ts — CLI ↔ Daemon Authority Arbitration
 *
 * Validates PLAN-2026-07-16-cli-daemon-authority-arbitration:
 *   - Tier classification (Fase 1) — exhaustiveness enforced by ACTION_TIER type
 *   - Resource claim deferral for Tier 2 actions (Fase 2)
 *   - Tier 3 actions require human confirmation unless rule.autonomous (Fase 3)
 *   - Rule schema `autonomous` field (Fase 4)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";
import {
  checkPrecedence,
  getResourceId,
} from "../decision-core/precedence.js";
import { ACTION_TIER } from "../decision-core/tiers.js";
import { validateRule } from "../rule-engine/validation.js";
import type { ActionType } from "../domain/rules/rule.js";

const ALL_ACTION_TYPES: ActionType[] = [
  "update_context_buffer", "create_reminder", "remove_reminder", "update_quick_board",
  "create_adr", "create_skill", "log_event", "send_notification",
  "trigger_assessment", "trigger_health_check", "update_backlog", "run_local_script",
  "run_script", "run_shugo_command", "update_file", "create_file", "remove_file",
  "update_backlog_status", "archive_plan", "auto_populate_next_p0", "apply_autofix",
];

describe("Fase 1 — Action Tier classification", () => {
  it("assigns every ActionType to a tier (exhaustiveness)", () => {
    for (const t of ALL_ACTION_TYPES) {
      expect(ACTION_TIER[t]).toBeDefined();
      expect([1, 2, 3]).toContain(ACTION_TIER[t]);
    }
  });

  it("places irreversible mutations in Tier 3 and cheap read-only in Tier 1", () => {
    expect(ACTION_TIER["remove_file"]).toBe(3);
    expect(ACTION_TIER["run_shugo_command"]).toBe(3);
    expect(ACTION_TIER["apply_autofix"]).toBe(3);
    expect(ACTION_TIER["log_event"]).toBe(1);
    expect(ACTION_TIER["send_notification"]).toBe(1);
  });
});

describe("Fase 2 — Resource claim deferral (Tier 2)", () => {
  beforeEach(() => resetEventBus());
  afterEach(() => resetEventBus());

  it("derives resource IDs for Tier 2 actions", () => {
    expect(getResourceId("archive_plan", { planId: "P1" })).toBe("plan:P1");
    expect(getResourceId("update_backlog_status", { taskId: "T1" })).toBe("task:T1");
    expect(getResourceId("auto_populate_next_p0", {})).toBe("backlog:next-p0");
  });

  it("defers a Tier 2 action on a claimed resource and emits a challenge", () => {
    const challenges: unknown[] = [];
    getEventBus().subscribe("challenge.generated", (p) => { challenges.push(p); });

    const claimed = new Set(["plan:P1"]);
    const result = checkPrecedence("archive_plan", "autonomous", {
      resourceClaimed: (id) => claimed.has(id),
      params: { planId: "P1" },
    });

    expect(result.allowed).toBe(false);
    expect(result.tier).toBe(2);
    expect(challenges).toHaveLength(1);
  });

  it("allows a Tier 2 action when its resource is not claimed", () => {
    const claimed = new Set(["plan:OTHER"]);
    const result = checkPrecedence("archive_plan", "autonomous", {
      resourceClaimed: (id) => claimed.has(id),
      params: { planId: "P1" },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("Fase 3 — Tier 3 human confirmation", () => {
  beforeEach(() => resetEventBus());
  afterEach(() => resetEventBus());

  it("proposes (challenge) a Tier 3 action without autonomous flag", () => {
    const challenges: unknown[] = [];
    getEventBus().subscribe("challenge.generated", (p) => { challenges.push(p); });

    const result = checkPrecedence("run_shugo_command", "autonomous", {
      ruleAutonomousFlag: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.tier).toBe(3);
    expect(challenges).toHaveLength(1);
  });

  it("executes a Tier 3 action when the rule opts in with autonomous:true", () => {
    const result = checkPrecedence("run_shugo_command", "autonomous", {
      ruleAutonomousFlag: true,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows everything in deliberate (human-initiated) mode", () => {
    expect(checkPrecedence("run_shugo_command", "deliberate").allowed).toBe(true);
  });
});

describe("Fase 4 — Rule schema `autonomous`", () => {
  it("accepts an explicit autonomous boolean", () => {
    const result = validateRule({
      id: "RULE-X",
      trigger: "session_start",
      conditions: [],
      actions: [{ type: "log_event", params: { event: "e", message: "m" } }],
      priority: 1,
      dependencies: [],
      enabled: true,
      autonomous: false,
      tags: [],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a non-boolean autonomous field", () => {
    const result = validateRule({
      id: "RULE-X",
      trigger: "session_start",
      conditions: [],
      actions: [{ type: "log_event", params: { event: "e", message: "m" } }],
      priority: 1,
      dependencies: [],
      enabled: true,
      autonomous: "yes",
      tags: [],
    } as unknown);
    expect(result.valid).toBe(false);
  });
});
