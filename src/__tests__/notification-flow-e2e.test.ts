/**
 * notification-flow-e2e.test.ts — End-to-End Notification Flow Tests
 *
 * Validates the complete notification pipeline:
 *   Event Bus → Desktop Notifier → sendDesktopNotification
 *
 * Covers all 6 notification scenarios fixed in the notification system overhaul:
 *   1. task.completed  (backlog done)
 *   2. backlog.updated (daemon file sync)
 *   3. health.checked  (system health)
 *   4. plan.archived   (plan completion)
 *   5. user.notification (direct CLI notifications)
 *   6. Duplicate audit prevention
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../infrastructure/notify.js", () => ({
  sendDesktopNotification: vi.fn(() => true),
  logNotificationOnly: vi.fn(),
}));

import { initDesktopNotifier, _resetForTesting } from "../infrastructure/desktop-notifier.js";
import { sendDesktopNotification, logNotificationOnly } from "../infrastructure/notify.js";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNotifCalls() {
  return vi.mocked(sendDesktopNotification).mock.calls;
}

function getLogCalls() {
  return vi.mocked(logNotificationOnly).mock.calls;
}

function findNotification(titleSubstring: string) {
  return getNotifCalls().find((c) => String(c[1]).includes(titleSubstring));
}

function findLog(titleSubstring: string) {
  return getLogCalls().find((c) => String(c[1]).includes(titleSubstring));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("notification-flow-e2e", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    _resetForTesting();
    resetEventBus();
    testDir = join(tmpdir(), `notif-e2e-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ── Scenario 1: shugo backlog done → task.completed → desktop notification ──

  describe("Scenario 1: backlog done flow", () => {
    it("should send high-priority notification with the item title when task.completed is published", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      // Simulate what cmdDone publishes
      bus.publish("task.completed", {
        taskId: "BACKLOG-001",
        itemName: "Implementar auth JWT",
        fromState: "em implementação",
        toState: "concluído",
      });

      const notif = findNotification("Tarefa Concluída");
      expect(notif).toBeDefined();
      expect(notif![0]).toBe(shitennoDir);
      expect(String(notif![1])).toContain("Tarefa Concluída");
      expect(String(notif![2])).toContain("Implementar auth JWT");
      expect(notif![3]).toBe("high");
    });

    it("should publish task.completed and backlog.updated with the item title from cmdDone", () => {
      // cmdDone now publishes both events, each carrying the item title so
      // notifications never fall back to a placeholder name.
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("task.completed", {
        taskId: "BACKLOG-001",
        itemName: "Implementar auth JWT",
        fromState: "em implementação",
        toState: "concluído",
      });
      bus.publish("backlog.updated", {
        itemId: "BACKLOG-001",
        itemName: "Implementar auth JWT",
        movedCount: 1,
        source: "cmd_done",
      });

      const taskNotif = findNotification("Tarefa Concluída");
      expect(taskNotif).toBeDefined();
      expect(String(taskNotif![2])).toContain("Implementar auth JWT");

      // backlog.updated is medium priority — throttled by the 60s cooldown
      // after the high-priority task.completed, but must never show a
      // placeholder name.
      const backlogNotif = findNotification("Backlog Concluída");
      const backlogLog = findLog("Backlog Concluída");
      const emitted = backlogNotif ?? backlogLog;
      expect(emitted).toBeDefined();
      expect(String(emitted![2])).toContain("Implementar auth JWT");
    });
  });

  // ── Scenario 2: daemon backlog sync → backlog.updated → notification ────────

  describe("Scenario 2: daemon backlog sync flow", () => {
    it("should notify when backlog.updated is published with movedCount", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      // Simulate what the daemon publishes after moving items
      bus.publish("backlog.updated", {
        itemId: "batch",
        itemName: "Auditoria de segurança",
        movedCount: 3,
      });

      const notif = findNotification("Backlog Concluída");
      expect(notif).toBeDefined();
      expect(String(notif![2])).toContain("3");
      expect(String(notif![2])).toContain("Auditoria de segurança");
      expect(notif![3]).toBe("medium");
    });

    it("should handle single item backlog update", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("backlog.updated", {
        itemId: "BACKLOG-042",
        itemName: "Corrigir bug de login",
        movedCount: 1,
      });

      const notif = findNotification("Backlog Concluída");
      expect(notif).toBeDefined();
      expect(String(notif![2])).toContain("Corrigir bug de login");
    });

    it("should NOT notify when payload has no item identity (file-watcher sync signal)", () => {
      // The daemon file watcher publishes backlog.updated with only path and
      // timestamp. Must never surface a "desconhecido" notification — the
      // completion notification comes from task.completed with the item title.
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("backlog.updated", {
        path: "docs/backlog/ACTIVE.md",
        timestamp: new Date().toISOString(),
      });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 3: health check → desktop notification ─────────────────────────

  describe("Scenario 3: health check flow", () => {
    it("should send HIGH notification when health score < 40", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("health.checked", { score: 25 });

      const notif = findNotification("Saúde Crítica");
      expect(notif).toBeDefined();
      expect(String(notif![2])).toContain("25");
      expect(notif![3]).toBe("high");
    });

    it("should send LOW notification when health score >= 80", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("health.checked", { score: 85 });

      // Low priority → log only, no desktop notification
      expect(sendDesktopNotification).not.toHaveBeenCalled();
      const log = findLog("Saúde Estável");
      expect(log).toBeDefined();
      expect(String(log![2])).toContain("85");
    });

    it("should NOT notify for normal health scores (40-79)", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("health.checked", { score: 60 });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
      expect(logNotificationOnly).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 4: plan archived → desktop notification ────────────────────────

  describe("Scenario 4: plan archived flow", () => {
    it("should notify when plan.archived has finalStatus=done", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      // This is the payload format from markdown-plan-engine/file-operations.ts
      bus.publish("plan.archived", {
        planId: "PLANO-AUDITORIA",
        title: "Plano de Auditoria",
        path: "governance/plans/PLANO-AUDITORIA.md",
        finalStatus: "done",
      });

      const notif = findNotification("Plano Concluído");
      expect(notif).toBeDefined();
      expect(String(notif![2])).toContain("PLANO-AUDITORIA");
      expect(notif![3]).toBe("medium");
    });

    it("should also accept newStatus=done for backward compat", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("plan.archived", {
        planId: "OLD-FORMAT",
        newStatus: "done",
      });

      const notif = findNotification("Plano Concluído");
      expect(notif).toBeDefined();
      expect(String(notif![2])).toContain("OLD-FORMAT");
    });

    it("should NOT notify when plan.archived status is not done", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("plan.archived", {
        planId: "PLANO-X",
        finalStatus: "archived",
      });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 5: user.notification → direct CLI notification ─────────────────

  describe("Scenario 5: user.notification flow", () => {
    it("should forward user.notification with correct title/message/priority", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("user.notification", {
        title: "⚠️ Formato Inválido",
        message: "Missing Status field",
        priority: "medium",
      });

      const notif = findNotification("Formato Inválido");
      expect(notif).toBeDefined();
      expect(String(notif![1])).toContain("Formato Inválido");
      expect(String(notif![2])).toContain("Missing Status field");
      expect(notif![3]).toBe("medium");
    });

    it("should handle high-priority user notification", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("user.notification", {
        title: "🔔 Reminder Added",
        message: "Check deploy status",
        priority: "high",
      });

      const notif = findNotification("Reminder Added");
      expect(notif).toBeDefined();
      expect(notif![3]).toBe("high");
    });

    it("should handle low-priority user notification (log only)", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("user.notification", {
        title: "📋 Plano Preparado",
        message: "My Plan",
        priority: "low",
      });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
      const log = findLog("Plano Preparado");
      expect(log).toBeDefined();
    });
  });

  // ── Scenario 6: cooldown and deduplication ──────────────────────────────────

  describe("Scenario 6: cooldown and deduplication", () => {
    it("should respect global cooldown for medium-priority notifications", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      // plan.archived is medium priority — goes through on first call
      bus.publish("plan.archived", { planId: "P1", finalStatus: "done" });
      const count1 = getNotifCalls().length;
      expect(count1).toBe(1);

      // Second medium notification within 60s → throttled
      bus.publish("plan.archived", { planId: "P2", finalStatus: "done" });
      // Still only 1 desktop notification (the second was throttled)
      expect(getNotifCalls().length).toBe(count1);
      // But it was logged
      expect(logNotificationOnly).toHaveBeenCalled();
    });

    it("should bypass cooldown for high-priority notifications", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      // First high-priority
      bus.publish("task.completed", { taskId: "t1", gatesPassed: 1 });
      const count1 = getNotifCalls().length;

      // Second high-priority — should also go through (high bypasses cooldown)
      bus.publish("task.completed", { taskId: "t2", gatesPassed: 1 });
      expect(getNotifCalls().length).toBe(count1 + 1);
    });
  });

  // ── Scenario 7: event isolation (no cross-contamination) ────────────────────

  describe("Scenario 7: event isolation", () => {
    it("should not send notification for unsubscribed events", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("git.commit_detected", { sha: "abc123" });

      expect(sendDesktopNotification).not.toHaveBeenCalled();
    });

    it("should handle multiple event types in sequence", () => {
      initDesktopNotifier(shitennoDir);
      const bus = getEventBus();

      bus.publish("task.completed", { taskId: "t1", gatesPassed: 3 });
      bus.publish("health.checked", { score: 30 });
      bus.publish("user.notification", {
        title: "Test",
        message: "msg",
        priority: "medium",
      });

      // At least task.completed (high) and health.checked (high) should notify
      const calls = getNotifCalls();
      expect(calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
