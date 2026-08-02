import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("mcp stdio protocol", () => {
  it("stdout must contain only JSON-RPC — no non-JSON lines before the first response", async () => {
    const binPath = join(process.cwd(), "dist", "bin", "shugo.js");
    if (!existsSync(binPath)) return; // skip if not built yet

    const proc = spawn("node", [binPath, "mcp"], { cwd: process.cwd() });

    let stdout = "";
    proc.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    // Give the process time to start and emit any stray output
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Send a proper initialize request via stdin
    const request = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    proc.stdin.write(request + "\n");

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 500));
    proc.kill();

    // Every non-empty line in stdout must be valid JSON
    const lines = stdout.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow(); // every line must be valid JSON
    }
  }, 10_000);
});
