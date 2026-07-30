import { readdirSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const commandsWithFsAccess = new Set([
  "init.ts",
  "clean.ts",
  "briefing.ts",
  "reminders.ts",
  "upgrade.ts",
  "sync.ts",
  "update.ts",
  "validate.ts",
  "assess.ts",
  "status.ts",
  "bench.ts",
  "digest.ts",
  "mcp.ts",
  "doctor.ts",
  "handbook.ts",
  "plan.ts",
  "daemon.ts",  // daemon logs command reads log files
  "hooks.ts",  // Hooks installer legitimately needs fs for reading/writing hook files
  "audit.ts",  // --full-sweep writes last-verify.json
  "skill.ts",  // Skill management needs fs for creating/reading/validating skill files
]);

describe("boundary: commands do not read filesystem directly", () => {
  const commandsDir = "src/commands";

  for (const file of readdirSync(commandsDir).filter((f) => f.endsWith(".ts"))) {
    if (commandsWithFsAccess.has(file)) continue;

    it(`${file} does not import node:fs`, () => {
      const content = readFileSync(`${commandsDir}/${file}`, "utf-8");
      expect(/from ["']node:fs["']/.test(content)).toBe(false);
    });
  }
});
