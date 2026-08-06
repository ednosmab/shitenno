import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeAction } from "../rule-engine/actions.js";
import { getEventBus, resetEventBus } from "../infrastructure/event-bus.js";
import type { RuleAction, RuleContext } from "../domain/rules/rule.js";

/**
 * executeUpdateBacklogStatus — publishes task.completed ONLY on terminal states.
 *
 * Regression test for: task.completed event should fire when toState is
 * "concluído" or "encerrado", and NOT fire for non-terminal transitions.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase C.15
 */

vi.mock("../application/backlog-state-machine.js", () => ({
  transitionTask: vi.fn((_shitennoDir: string, taskId: string, fromState: string, toState: string) => {
    return { success: true, message: `Transitioned ${taskId}: ${fromState} → ${toState}` };
  }),
}));

function createAction(type: string, params: Record<string, string | number | boolean>): RuleAction {
  return { type: type as RuleAction["type"], params };
}

function createContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    trigger: "manual",
    eventData: {},
    projectRoot: "/mock",
    shitennoDir: "/mock/.shitenno",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("executeUpdateBacklogStatus — task.completed event publishing", () => {
  beforeEach(() => {
    resetEventBus();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("publishes task.completed when toState is terminal (concluído)", async () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);

    const action = createAction("update_backlog_status", {
      taskId: "T1",
      fromState: "em implementação",
      toState: "concluído",
    });

    const result = await executeAction(action, createContext());

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "T1",
        fromState: "em implementação",
        toState: "concluído",
      }),
    );
  });

  it("publishes task.completed when toState is terminal (encerrado)", async () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);

    const action = createAction("update_backlog_status", {
      taskId: "T2",
      fromState: "planeado",
      toState: "encerrado",
    });

    const result = await executeAction(action, createContext());

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "T2",
        toState: "encerrado",
      }),
    );
  });

  it("does NOT publish task.completed for non-terminal transition", async () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);

    const action = createAction("update_backlog_status", {
      taskId: "T3",
      fromState: "planeado",
      toState: "em implementação",
    });

    const result = await executeAction(action, createContext());

    expect(result.success).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });

  it("does NOT publish task.completed when transition fails", async () => {
    const { transitionTask } = await import("../application/backlog-state-machine.js");
    vi.mocked(transitionTask).mockReturnValueOnce({
      success: false,
      message: "Invalid transition",
    });

    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);

    const action = createAction("update_backlog_status", {
      taskId: "T4",
      fromState: "planeado",
      toState: "concluído",
    });

    const result = await executeAction(action, createContext());

    expect(result.success).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns error when required params are missing", async () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);

    const action = createAction("update_backlog_status", {
      taskId: "T5",
    });

    const result = await executeAction(action, createContext());

    expect(result.success).toBe(false);
    expect(result.message).toContain("Missing required params");
    expect(spy).not.toHaveBeenCalled();
  });
});
