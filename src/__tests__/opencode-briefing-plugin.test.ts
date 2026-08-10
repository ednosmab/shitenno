import { describe, it, expect } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

interface ChatOutput {
  message: { system?: string };
  parts: Array<{ type: string; text?: string }>;
}

type PluginInstance = {
  "chat.message"?: (input: unknown, output: ChatOutput) => Promise<void>;
};

async function loadPluginInstance(directory: string): Promise<PluginInstance> {
  const plugin = await import("../templates/base/opencode/plugin/shitenno-briefing.js");
  const factory = plugin.default as (input: { directory: string }) => Promise<PluginInstance>;
  return factory({ directory });
}

describe("opencode plugin shitenno-briefing (template)", () => {
  it("loads as a valid plugin module", async () => {
    const plugin = await import("../templates/base/opencode/plugin/shitenno-briefing.js");
    expect(typeof plugin.default).toBe("function");
  });

  it("injects briefing into the system prompt on chat.message", async () => {
    const tmpRoot = join(tmpdir(), `shugo-plugin-test-${Date.now()}`);
    const shitennoDir = join(tmpRoot, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    writeFileSync(
      join(shitennoDir, "BRIEFING.md"),
      "# Pre-Session Briefing\n\nRisk: critical",
      "utf-8"
    );

    const instance = await loadPluginInstance(tmpRoot);
    const output: ChatOutput = {
      message: { system: "Existing system prompt" },
      parts: [{ type: "text", text: "fix the failing test" }],
    };

    await instance["chat.message"]?.({}, output);

    expect(output.message.system).toContain("Existing system prompt");
    expect(output.message.system).toContain("# Pre-Session Briefing");
    expect(output.message.system).toContain("shitenno-briefing-start");
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("skips injection when briefing file is missing", async () => {
    const tmpRoot = join(tmpdir(), `shugo-plugin-test-missing-${Date.now()}`);
    mkdirSync(tmpRoot, { recursive: true });

    const instance = await loadPluginInstance(tmpRoot);
    const output: ChatOutput = {
      message: { system: "System prompt" },
      parts: [{ type: "text", text: "fix the failing test" }],
    };

    await instance["chat.message"]?.({}, output);

    expect(output.message.system).toBe("System prompt");
    rmSync(tmpRoot, { recursive: true, force: true });
  });
});