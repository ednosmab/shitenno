/**
 * orphaned-modules.test.ts — Tests that orphaned modules are activated (Phase E)
 */

import { describe, it, expect } from "vitest";

describe("Orphaned Modules Activation (Phase E)", () => {
  it("doc-engine.ts exports DocEngine class", async () => {
    const mod = await import("../infrastructure/doc-engine.js");
    expect(typeof mod.DocEngine).toBe("function");
  });

  it("context-buffer-writer.ts exports expected functions", async () => {
    const mod = await import("../application/context-buffer-writer.js");
    expect(typeof mod.updateSession).toBe("function");
  });

  it("advanced-infrastructure.ts exports DeadLetterQueue", async () => {
    const mod = await import("../infrastructure/advanced-infrastructure.js");
    expect(typeof mod.DeadLetterQueue).toBe("function");
  });

  it("doc-sync-hook.ts exports registerDocSyncHook", async () => {
    const mod = await import("../infrastructure/doc-sync-hook.js");
    expect(typeof mod.registerDocSyncHook).toBe("function");
  });

  it("validation.ts exports expected functions", async () => {
    const mod = await import("../infrastructure/validation.js");
    expect(typeof mod.safeJsonParse).toBe("function");
  });

  it("errors.ts exports expected functions", async () => {
    const mod = await import("../domain/types/errors.js");
    expect(typeof mod.ShitennoError).toBe("function");
  });

  it("engineering-state/access.ts exports getEngineeringState", async () => {
    const mod = await import("../engineering-state/access.js");
    expect(typeof mod.getEngineeringState).toBe("function");
    expect(typeof mod.clearEngineeringStateCache).toBe("function");
  });
});
