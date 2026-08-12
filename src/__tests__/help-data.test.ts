import { describe, it, expect } from "vitest";
import {
  COMMAND_CATEGORIES,
  findCommand,
} from "../domain/types/help-data.js";

// ── COMMAND_CATEGORIES ─────────────────────────────────────────────────────

describe("COMMAND_CATEGORIES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(COMMAND_CATEGORIES)).toBe(true);
    expect(COMMAND_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("each category has name, description, and commands", () => {
    for (const cat of COMMAND_CATEGORIES) {
      expect(typeof cat.name).toBe("string");
      expect(typeof cat.description).toBe("string");
      expect(Array.isArray(cat.commands)).toBe(true);
      expect(cat.commands.length).toBeGreaterThan(0);
    }
  });

  it("each command has name, description, usage, and examples", () => {
    for (const cat of COMMAND_CATEGORIES) {
      for (const cmd of cat.commands) {
        expect(typeof cmd.name).toBe("string");
        expect(typeof cmd.description).toBe("string");
        expect(typeof cmd.usage).toBe("string");
        expect(Array.isArray(cmd.examples)).toBe(true);
        expect(cmd.examples.length).toBeGreaterThan(0);
      }
    }
  });

  it("no duplicate command names across categories", () => {
    const names = COMMAND_CATEGORIES.flatMap((cat) => cat.commands.map((c) => c.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it("contains expected core commands", () => {
    const names = COMMAND_CATEGORIES.flatMap((cat) => cat.commands.map((c) => c.name));
    expect(names).toContain("init");
    expect(names).toContain("status");
    expect(names).toContain("audit");
    expect(names).toContain("plan");
    expect(names).toContain("feedback");
    expect(names).toContain("briefing");
  });
});

// ── findCommand ────────────────────────────────────────────────────────────

describe("findCommand", () => {
  it("finds existing command by name", () => {
    const cmd = findCommand("init");
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe("init");
    expect(cmd!.usage).toContain("shugo init");
  });

  it("finds command in nested category", () => {
    const cmd = findCommand("doctor");
    expect(cmd).toBeDefined();
    expect(cmd!.name).toBe("doctor");
  });

  it("returns undefined for non-existent command", () => {
    expect(findCommand("nonexistent")).toBeUndefined();
  });

  it("finds feedback command", () => {
    const cmd = findCommand("feedback");
    expect(cmd).toBeDefined();
    expect(cmd!.description).toContain("session outcome");
  });

  it("finds validate command", () => {
    const cmd = findCommand("validate");
    expect(cmd).toBeDefined();
    expect(cmd!.usage).toContain("shugo validate");
  });

  it("finds docs-audit command", () => {
    const cmd = findCommand("docs-audit");
    expect(cmd).toBeDefined();
    expect(cmd!.examples.length).toBeGreaterThan(0);
  });
});
