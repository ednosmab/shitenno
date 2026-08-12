import { describe, it, expect, vi } from "vitest";
import { HookBus, getHookBus, type ShitennoPlugin } from "../infrastructure/plugin-system.js";

describe("PluginSystem", () => {
  function makeBus(): HookBus {
    return new HookBus();
  }

  describe("HookBus", () => {
    it("registers plugins", () => {
      const bus = makeBus();
      const plugin: ShitennoPlugin = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test plugin",
      };

      bus.registerPlugin(plugin);
      expect(bus.getPlugins()).toHaveLength(1);
      expect(bus.getPlugins()[0]!.name).toBe("test-plugin");
    });

    it("rejects duplicate plugins", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const bus = makeBus();
      const plugin: ShitennoPlugin = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test plugin",
      };

      bus.registerPlugin(plugin);
      bus.registerPlugin(plugin);

      expect(bus.getPlugins()).toHaveLength(1);
    });

    it("executeHook calls plugin hooks", async () => {
      const bus = makeBus();
      let called = false;

      const plugin: ShitennoPlugin = {
        name: "test-plugin",
        version: "1.0.0",
        description: "Test plugin",
        hooks: {
          "custom-check": () => {
            called = true;
            return [];
          },
        },
      };

      bus.registerPlugin(plugin);

      await bus.executeHook("custom-check", "/test", (p) => {
        return (p.hooks?.["custom-check"] as Function)();
      });

      expect(called).toBe(true);
    });

    it("executeHook transforms input through plugins", async () => {
      const bus = makeBus();

      const plugin1: ShitennoPlugin = {
        name: "plugin-1",
        version: "1.0.0",
        description: "Plugin 1",
        hooks: {
          "custom-metric": (input: unknown) => {
            const metrics = input as Record<string, number>;
            return { ...metrics, custom1: 42 };
          },
        },
      };

      const plugin2: ShitennoPlugin = {
        name: "plugin-2",
        version: "1.0.0",
        description: "Plugin 2",
        hooks: {
          "custom-metric": (input: unknown) => {
            const metrics = input as Record<string, number>;
            return { ...metrics, custom2: 84 };
          },
        },
      };

      bus.registerPlugin(plugin1);
      bus.registerPlugin(plugin2);

      const result = await bus.executeHook(
        "custom-metric",
        { existing: 10 } as Record<string, number>,
        (p, input) => (p.hooks?.["custom-metric"] as Function)(input)
      );

      expect(result).toEqual({ existing: 10, custom1: 42, custom2: 84 });
    });

    it("executeHook handles plugin errors gracefully", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const bus = makeBus();

      const failingPlugin: ShitennoPlugin = {
        name: "failing",
        version: "1.0.0",
        description: "Failing plugin",
        hooks: {
          "custom-check": () => {
            throw new Error("plugin error");
          },
        },
      };

      const successPlugin: ShitennoPlugin = {
        name: "success",
        version: "1.0.0",
        description: "Success plugin",
        hooks: {
          "custom-check": () => {
            return [{ issue: "test" }];
          },
        },
      };

      bus.registerPlugin(failingPlugin);
      bus.registerPlugin(successPlugin);

      // Should not throw
      const results = await bus.collectHook("custom-check", (p) => {
        return (p.hooks?.["custom-check"] as Function)();
      });

      expect(results).toHaveLength(1);
    });

    it("getPlugins returns copy of plugins", () => {
      const bus = makeBus();
      bus.registerPlugin({
        name: "test",
        version: "1.0.0",
        description: "test",
      });

      const plugins = bus.getPlugins();
      expect(plugins).toHaveLength(1);

      // Modifying the copy should not affect the original
      plugins.push({
        name: "hack",
        version: "1.0.0",
        description: "hack",
      });

      expect(bus.getPlugins()).toHaveLength(1);
    });
  });

  it("getHookBus returns the singleton instance", () => {
    const singleton = getHookBus();
    const other = getHookBus();
    expect(singleton).toBe(other);
  });
});
