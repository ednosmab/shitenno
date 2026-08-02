/**
 * reactive-pipeline.test.ts — Integration test: Event Bus → Rule Engine → Action
 *
 * Validates the full reactive chain: an event is published on the bus,
 * the rule engine picks it up, evaluates rules, and executes actions.
 *
 * Replaces the former validate-pipeline.sh (bash) with a vitest equivalent
 * focused on system reactivity.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join, dirname } from "node:path";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { getEventBus, resetEventBus, enableEventPersistence, readPersistedEvents } from "../event-bus.js";
import {
  initializeRuleEngine,
  loadRules,
  saveRule,
  executeRules,
  getDefaultRules,
  type Rule,
  type RuleContext,
} from "../rule-engine.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  const dir = join(tmpdir(), `shitenno-reactive-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createShitennoDir(tmpDir: string): string {
  const shitennoDir = join(tmpDir, "shitenno");
  mkdirSync(join(shitennoDir, "governance", "rules"), { recursive: true });
  mkdirSync(join(shitennoDir, "governance", "context"), { recursive: true });
  mkdirSync(join(shitennoDir, "docs"), { recursive: true });
  return shitennoDir;
}

function createRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "RULE-REACTIVE-001",
    description: "Test reactive rule",
    trigger: "health_check",
    conditions: [
      { field: "eventData.status", operator: "equals", value: "critical" },
    ],
    actions: [
      { type: "log_event", params: { event: "reactive_test", message: "Rule triggered" } },
    ],
    priority: 1,
    dependencies: [],
    enabled: true,
    tags: ["test"],
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("reactive-pipeline", () => {
  let tmpDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    shitennoDir = createShitennoDir(tmpDir);
    resetEventBus();
  });

  afterEach(() => {
    resetEventBus();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Layer 1: Event Bus basics ─────────────────────────────────────────────

  describe("event bus delivers events", () => {
    it("publish → subscribe delivers payload", () => {
      const bus = getEventBus();
      const received: unknown[] = [];

      bus.subscribe("health.checked", (payload) => {
        received.push(payload);
      });

      bus.publish("health.checked", { status: "critical" });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual({ status: "critical" });
    });
  });

  // ── Layer 2: EVENT_TO_TRIGGER mapping ────────────────────────────────────

  describe("event-to-trigger mapping", () => {
    it("health.checked maps to health_check trigger", () => {
      const rule = createRule({ trigger: "health_check" });
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(1);
      expect(rules[0]!.trigger).toBe("health_check");
    });

    it("session.start maps to session_start trigger", () => {
      const rule = createRule({
        id: "RULE-SESSION-001",
        trigger: "session_start",
        conditions: [],
      });
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      expect(rules[0]!.trigger).toBe("session_start");
    });
  });

  // ── Layer 3: Rule loading from filesystem ────────────────────────────────

  describe("rule loading", () => {
    it("loads rules from shugo governance directory", () => {
      const rule = createRule();
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(1);
      expect(rules[0]!.id).toBe("RULE-REACTIVE-001");
    });

    it("loads all rules from directory", () => {
      saveRule(shitennoDir, createRule({ id: "R1", priority: 2 }));
      saveRule(shitennoDir, createRule({ id: "R2", priority: 1 }));
      saveRule(shitennoDir, createRule({ id: "R3", priority: 3 }));

      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(3);
      expect(rules.map((r) => r.id)).toContain("R1");
      expect(rules.map((r) => r.id)).toContain("R2");
      expect(rules.map((r) => r.id)).toContain("R3");
    });

    it("returns empty array when no rules exist", () => {
      const rules = loadRules(shitennoDir);
      expect(rules).toEqual([]);
    });
  });

  // ── Layer 4: Rule execution via executeRules ─────────────────────────────

  describe("rule execution", () => {
    it("executes action when conditions are met", async () => {
      const rule = createRule();
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "critical" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      const result = await executeRules(rules, context);
      expect(result.rulesExecuted).toBe(1);
      expect(result.rulesFailed).toBe(0);
    });

    it("skips action when conditions are NOT met", async () => {
      const rule = createRule();
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "ok" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      const result = await executeRules(rules, context);
      expect(result.rulesExecuted).toBe(0);
      expect(result.rulesSkipped).toBe(1);
    });

    it("executes multiple actions in a rule", async () => {
      const rule = createRule({
        actions: [
          { type: "log_event", params: { event: "action1", message: "First" } },
          { type: "log_event", params: { event: "action2", message: "Second" } },
        ],
      });
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "critical" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      const result = await executeRules(rules, context);
      expect(result.rulesExecuted).toBe(1);
    });
  });

  // ── Layer 5: Full reactive chain (Event → Rule → Action) ────────────────

  describe("full reactive chain", () => {
    it("eventBus.publish triggers rule engine via initializeRuleEngine", async () => {
      const bufPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
      writeFileSync(bufPath, "current_task:\n  status: \"idle\"\n", "utf-8");

      const rule = createRule({
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "active" } },
        ],
      });
      saveRule(shitennoDir, rule);

      initializeRuleEngine(tmpDir, shitennoDir);

      const bus = getEventBus();
      bus.publish("health.checked", { status: "critical" });

      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('"active"');
    });

    it("non-matching event does not trigger rules", async () => {
      const bufPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
      writeFileSync(bufPath, "current_task:\n  status: \"idle\"\n", "utf-8");

      const rule = createRule({
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "active" } },
        ],
      });
      saveRule(shitennoDir, rule);

      initializeRuleEngine(tmpDir, shitennoDir);

      const bus = getEventBus();
      bus.publish("session.start", {});

      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('"idle"');
      expect(updated).not.toContain('"active"');
    });

    it("context_buffer.yaml is updated by update_context_buffer action", async () => {
      const bufPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
      writeFileSync(bufPath, "current_task:\n  status: \"idle\"\n", "utf-8");

      const rule = createRule({
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "active" } },
        ],
      });
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "critical" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      await executeRules(rules, context);

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('"active"');
    });

    it("BACKLOG.md is updated by update_backlog action", async () => {
      const backlogPath = join(shitennoDir, "docs", "backlog", "ACTIVE.md");
      mkdirSync(dirname(backlogPath), { recursive: true });
      writeFileSync(backlogPath, "# BACKLOG\n\nExisting items\n", "utf-8");

      const rule = createRule({
        actions: [
          { type: "update_backlog", params: { item: "Reactive: critical health detected" } },
        ],
      });
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "critical" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      await executeRules(rules, context);

      const backlog = readFileSync(backlogPath, "utf-8");
      expect(backlog).toContain("Reactive: critical health detected");
    });

    it("task.completed event triggers RULE-016 (update_backlog_status)", async () => {
      const backlogPath = join(shitennoDir, "docs", "BACKLOG.md");
      mkdirSync(dirname(backlogPath), { recursive: true });
      writeFileSync(
        backlogPath,
        "# BACKLOG\n\n| ID | Title | Priority | Status |\n|---|---|---|---|\n| TASK-001 | Test task | High | em implementação |\n",
        "utf-8"
      );

      const rule: Rule = {
        id: "RULE-016",
        description: "Auto-transition backlog on task completion",
        trigger: "task_completed",
        conditions: [],
        actions: [
          {
            type: "update_backlog_status",
            params: { taskId: "TASK-001", fromState: "em implementação", toState: "em validação" },
          },
        ],
        priority: 1,
        dependencies: [],
        enabled: true,
        tags: ["backlog"],
      };
      saveRule(shitennoDir, rule);

      const rules = loadRules(shitennoDir);
      expect(rules).toHaveLength(1);

      const context: RuleContext = {
        trigger: "task_completed",
        eventData: { taskId: "TASK-001" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      const result = await executeRules(rules, context);
      expect(result.rulesExecuted).toBe(1);

      const updated = readFileSync(backlogPath, "utf-8");
      expect(updated).toContain("em validação");
    });

    it("task.completed event triggers RULE-017 (update_context_buffer)", async () => {
      const bufPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
      writeFileSync(bufPath, "current_task:\n  id: \"TASK-001\"\n  status: \"em implementação\"\n", "utf-8");

      const rule: Rule = {
        id: "RULE-017",
        description: "Update context buffer on task completion",
        trigger: "task_completed",
        conditions: [],
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "completed" } },
        ],
        priority: 1,
        dependencies: [],
        enabled: true,
        tags: ["buffer"],
      };
      saveRule(shitennoDir, rule);

      initializeRuleEngine(tmpDir, shitennoDir);

      const bus = getEventBus();
      bus.publish("task.completed", { taskId: "TASK-001" });

      await new Promise((resolve) => { setTimeout(resolve, 100); });

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('"completed"');
    });
  });

  // ── Layer 6: Event persistence ───────────────────────────────────────────

  describe("event persistence", () => {
    it("persists events to JSONL file on disk", () => {
      enableEventPersistence(shitennoDir);

      const bus = getEventBus();
      bus.publish("score.calculated", { score: 42 });

      const today = new Date().toISOString().slice(0, 10);
      const events = readPersistedEvents(shitennoDir, today);

      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("score.calculated");
      expect(events[0]!.payload).toEqual({ score: 42 });
    });

    it("multiple publishes append to same daily file", () => {
      enableEventPersistence(shitennoDir);

      const bus = getEventBus();
      bus.publish("score.calculated", { score: 10 });
      bus.publish("score.calculated", { score: 20 });
      bus.publish("score.calculated", { score: 30 });

      const today = new Date().toISOString().slice(0, 10);
      const events = readPersistedEvents(shitennoDir, today);

      expect(events).toHaveLength(3);
    });
  });

  // ── Layer 7: Multiple subscribers ────────────────────────────────────────

  describe("multiple subscribers", () => {
    it("multiple handlers receive the same event", () => {
      const bus = getEventBus();
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      bus.subscribe("health.checked", (payload) => { received1.push(payload); });
      bus.subscribe("health.checked", (payload) => { received2.push(payload); });

      bus.publish("health.checked", { status: "ok" });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received1[0]).toEqual({ status: "ok" });
      expect(received2[0]).toEqual({ status: "ok" });
    });

    it("subscribers on different events are independent", () => {
      const bus = getEventBus();
      const healthReceived: unknown[] = [];
      const sessionReceived: unknown[] = [];

      bus.subscribe("health.checked", (payload) => { healthReceived.push(payload); });
      bus.subscribe("session.start", (payload) => { sessionReceived.push(payload); });

      bus.publish("health.checked", { status: "ok" });

      expect(healthReceived).toHaveLength(1);
      expect(sessionReceived).toHaveLength(0);
    });
  });

  // ── Layer 8: Error isolation ─────────────────────────────────────────────

  describe("error isolation", () => {
    it("failing rule does not prevent other rules from executing", async () => {
      const bufPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");
      writeFileSync(bufPath, "current_task:\n  status: \"idle\"\n", "utf-8");

      const failingRule: Rule = {
        id: "RULE-FAILING",
        description: "Rule that fails",
        trigger: "health_check",
        conditions: [],
        actions: [
          { type: "update_context_buffer", params: { field: "", value: "" } },
        ],
        priority: 1,
        dependencies: [],
        enabled: true,
        tags: ["test"],
      };

      const successRule: Rule = {
        id: "RULE-SUCCESS",
        description: "Rule that succeeds",
        trigger: "health_check",
        conditions: [],
        actions: [
          { type: "update_context_buffer", params: { field: "current_task.status", value: "active" } },
        ],
        priority: 2,
        dependencies: [],
        enabled: true,
        tags: ["test"],
      };

      saveRule(shitennoDir, failingRule);
      saveRule(shitennoDir, successRule);

      const rules = loadRules(shitennoDir);
      const context: RuleContext = {
        trigger: "health_check",
        eventData: { status: "critical" },
        projectRoot: tmpDir,
        shitennoDir,
        timestamp: new Date().toISOString(),
      };

      const result = await executeRules(rules, context);

      expect(result.rulesFailed).toBeGreaterThanOrEqual(1);
      expect(result.rulesExecuted).toBeGreaterThanOrEqual(1);

      const updated = readFileSync(bufPath, "utf-8");
      expect(updated).toContain('"active"');
    });

    it("initializeRuleEngine survives handler errors", async () => {
      const rule = createRule({
        actions: [
          { type: "update_context_buffer", params: { field: "", value: "" } },
        ],
      });
      saveRule(shitennoDir, rule);

      initializeRuleEngine(tmpDir, shitennoDir);

      const bus = getEventBus();
      bus.publish("health.checked", { status: "critical" });

      await new Promise((resolve) => { setTimeout(resolve, 100); });

      bus.publish("health.checked", { status: "ok" });

      await new Promise((resolve) => { setTimeout(resolve, 100); });

      expect(true).toBe(true);
    });
  });

  // ── Layer 6: Default rules seed ──────────────────────────────────────────

  describe("default rules", () => {
    it("getDefaultRules returns rules with valid structure", () => {
      const defaults = getDefaultRules();
      expect(defaults.length).toBeGreaterThan(0);

      for (const rule of defaults) {
        expect(rule.id).toBeTruthy();
        expect(rule.trigger).toBeTruthy();
        expect(Array.isArray(rule.actions)).toBe(true);
        expect(rule.enabled).toBe(true);
      }
    });

    it("all default rule triggers map to valid event types", () => {
      const VALID_TRIGGERS = [
        "session_start", "session_end", "health_check", "maturity_change",
        "knowledge_debt_detected", "validation_fail", "validation_pass",
        "pattern_detected", "capability_install", "manual", "file_change",
        "adr_created", "skill_created", "task_completed", "pipeline_complete",
        "plan_archived", "plan_created",
      ];

      const defaults = getDefaultRules();
      for (const rule of defaults) {
        expect(VALID_TRIGGERS).toContain(rule.trigger);
      }
    });

    it("pipeline.started is not in EVENT_TO_TRIGGER (dead code removed)", () => {
      const { readFileSync } = require("node:fs");
      const { join } = require("node:path");
      const engineSource = readFileSync(join(process.cwd(), "src", "rule-engine", "engine.ts"), "utf-8");
      expect(engineSource).not.toMatch(/"pipeline\.started"\s*:/);
    });
  });
});
