/**
 * mcp-server-handlers-skills.test.ts — MCP integration tests for handleGetSkills
 *
 * Layer 3 of PLAN_skill_routing_verification.md:
 * Proves the MCP surface delivers what the logic resolved.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Mock daemon-client to avoid real daemon calls
vi.mock("../daemon-client.js", () => ({
  isDaemonRunning: vi.fn(() => false),
  queryDaemon: vi.fn(() => Promise.resolve(null)),
}));

import { handleGetSkills } from "../mcp-server-handlers.js";

describe("handleGetSkills — scope-aware resolution", () => {
  let shitennoDir: string;

  beforeEach(() => {
    shitennoDir = mkdtempSync(join(tmpdir(), "shitenno-test-"));
    mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
    mkdirSync(join(shitennoDir, "governance"), { recursive: true });

    writeFileSync(
      join(shitennoDir, "docs", "skills", "tdd_workflow.md"),
      "---\nname: tdd_workflow\ndescription: TDD guide\n---\n\n# TDD Workflow\nRed-Green-Refactor."
    );
    writeFileSync(
      join(shitennoDir, "docs", "skills", "clean_code.md"),
      "---\nname: clean_code\ndescription: Clean code standards\n---\n\n# Clean Code\nWrite readable code."
    );
    writeFileSync(
      join(shitennoDir, "governance", "skill-manifest.yaml"),
      "skills:\n" +
      "  - id: tdd_workflow\n" +
      "    path: docs/skills/tdd_workflow.md\n" +
      "    mandatory: true\n" +
      "    priority: 0\n" +
      "    when:\n" +
      "      task: implementation\n" +
      "  - id: clean_code\n" +
      "    path: docs/skills/clean_code.md\n" +
      "    mandatory: false\n" +
      "    priority: 1\n" +
      "    when:\n" +
      "      task: implementation\n"
    );
  });

  afterEach(() => {
    rmSync(shitennoDir, { recursive: true, force: true });
  });

  it("inlines mandatory skill content when task metadata matches", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "implementation" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("[MANDATORY] tdd_workflow");
    expect(text).toContain("Red-Green-Refactor");
  });

  it("does not include tdd_workflow when task doesn't match", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "audit" });
    const text = result.content[0]?.text ?? "";
    expect(text).not.toContain("tdd_workflow");
  });

  it("lists contextual skills by id only when task matches", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "implementation" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("clean_code (available");
    // Contextual should NOT have full content inlined
    expect(text).not.toContain("# Clean Code");
  });

  it("falls back to flat listing when no scope args are given", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, {});
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("tdd_workflow");
    expect(text).toContain("clean_code");
  });

  it("direct name lookup still works", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { name: "tdd_workflow" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("Red-Green-Refactor");
    expect(text).not.toContain("[MANDATORY]");
  });

  it("returns error for unknown skill name", async () => {
    const result = await handleGetSkills("/fake/root", shitennoDir, { name: "nonexistent" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("not found");
  });

  it("returns fallback list when no manifest exists", async () => {
    rmSync(join(shitennoDir, "governance", "skill-manifest.yaml"));
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "implementation" });
    const text = result.content[0]?.text ?? "";
    expect(text).toContain("tdd_workflow");
  });

  it("handles malformed manifest gracefully", async () => {
    writeFileSync(
      join(shitennoDir, "governance", "skill-manifest.yaml"),
      "not valid yaml {{{"
    );
    const result = await handleGetSkills("/fake/root", shitennoDir, { task: "implementation" });
    const text = result.content[0]?.text ?? "";
    // Should fall back to flat listing
    expect(text).toContain("tdd_workflow");
  });
});
