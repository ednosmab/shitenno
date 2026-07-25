import { describe, it, expect, vi, beforeEach } from "vitest";
import { installMiddleware, type MiddlewareContext } from "../cli-middleware.js";

vi.mock("../plugin-system.js", () => ({
  loadPlugins: vi.fn().mockResolvedValue([]),
  getHookBus: vi.fn().mockReturnValue({
    registerPlugin: vi.fn(),
    executeHook: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("../session-tracker.js", () => ({
  trackCommand: vi.fn(),
}));

vi.mock("../event-bus.js", () => ({
  getEventBus: vi.fn().mockReturnValue({
    publish: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── installMiddleware ──────────────────────────────────────────────────────

describe("installMiddleware", () => {
  it("registers preAction and postAction hooks on program", () => {
    const mockHook = vi.fn();
    const program = { hook: mockHook } as any;
    const ctx: MiddlewareContext = {
      projectRoot: "/project",
      shitennoDir: "/project/shitenno",
      sessionId: "session-123",
    };

    installMiddleware(program, ctx);

    expect(mockHook).toHaveBeenCalledTimes(3);
    const hookCalls = mockHook.mock.calls.map((c) => c[0]);
    expect(hookCalls.filter((e: string) => e === "preAction")).toHaveLength(2);
    expect(hookCalls.filter((e: string) => e === "postAction")).toHaveLength(1);
  });

  it("preAction handler calls trackCommand when sessionId is provided", async () => {
    const handlers: Record<string, Function[]> = {};
    const mockHook = vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    });
    const program = { hook: mockHook } as any;
    const ctx: MiddlewareContext = {
      projectRoot: "/project",
      shitennoDir: "/project/shitenno",
      sessionId: "session-abc",
    };

    installMiddleware(program, ctx);

    // Call first preAction handler with mock (thisCommand=program, actionCommand=executed)
    const mockProgram = { name: vi.fn().mockReturnValue("shugo") };
    const mockActionCommand = { name: vi.fn().mockReturnValue("status"), args: [] };
    for (const handler of handlers["preAction"] || []) {
      await handler.call(mockProgram, mockProgram, mockActionCommand);
    }

    const { trackCommand } = await import("../session-tracker.js");
    expect(vi.mocked(trackCommand)).toHaveBeenCalledWith(
      "/project/shitenno",
      "session-abc",
      "status"
    );
  });

  it("preAction handler does not track when sessionId is null", async () => {
    const handlers: Record<string, Function[]> = {};
    const mockHook = vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    });
    const program = { hook: mockHook } as any;
    const ctx: MiddlewareContext = {
      projectRoot: "/project",
      shitennoDir: "/project/shitenno",
      sessionId: null,
    };

    installMiddleware(program, ctx);

    const mockProgram = { name: vi.fn().mockReturnValue("shugo") };
    const mockActionCommand = { name: vi.fn().mockReturnValue("status"), args: [] };
    for (const handler of handlers["preAction"] || []) {
      await handler.call(mockProgram, mockProgram, mockActionCommand);
    }

    const { trackCommand } = await import("../session-tracker.js");
    expect(vi.mocked(trackCommand)).not.toHaveBeenCalled();
  });

  it("postAction handler publishes command.completed event", async () => {
    const handlers: Record<string, Function[]> = {};
    const mockHook = vi.fn((event: string, handler: Function) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    });
    const program = { hook: mockHook } as any;
    const ctx: MiddlewareContext = {
      projectRoot: "/project",
      shitennoDir: "/project/shitenno",
      sessionId: "session-123",
    };

    installMiddleware(program, ctx);

    // Call postAction handler
    const mockThisCommand = { name: vi.fn().mockReturnValue("audit") };
    for (const handler of handlers["postAction"] || []) {
      await handler.call(mockThisCommand, mockThisCommand);
    }

    const { getEventBus } = await import("../event-bus.js");
    const bus = vi.mocked(getEventBus)();
    expect(bus.publish).toHaveBeenCalledWith(
      "command.completed",
      expect.objectContaining({ command: "audit", projectRoot: "/project" })
    );
  });
});
