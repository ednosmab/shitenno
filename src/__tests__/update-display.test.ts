/**
 * update-display.test.ts — displayDiff conflict reporting
 *
 * A file in conflict (customized locally AND changed in the template) must be
 * reported explicitly, never silently swallowed by the "Everything is up to
 * date" fallback.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { displayDiff } from "../commands/update/display.js";
import type { ManifestDiff } from "../manifest.js";

function makeDiff(overrides: Partial<ManifestDiff> = {}): ManifestDiff {
  return {
    added: [],
    removed: [],
    changed: [],
    unchanged: ["ok.txt"],
    conflict: [],
    ...overrides,
  };
}

describe("displayDiff — conflict reporting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports conflict files explicitly instead of 'up to date'", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const diff = makeDiff({ conflict: ["docs/AGENTS.md"] });
    displayDiff(diff, false);

    const output = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("file(s) in conflict");
    expect(output).toContain("docs/AGENTS.md");
    expect(output).not.toContain("Everything is up to date");
  });

  it("still reports 'up to date' when there are no changes and no conflicts", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    displayDiff(makeDiff(), false);

    const output = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("Everything is up to date");
  });

  it("truncates long conflict lists to 10 entries", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const conflict = Array.from({ length: 15 }, (_, i) => `file-${i}.md`);
    displayDiff(makeDiff({ conflict }), false);

    const output = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("file-9.md");
    expect(output).not.toContain("file-10.md");
    expect(output).toContain("... and 5 more");
  });

  it("reports a mix of added/changed/conflict without claiming 'up to date'", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const diff = makeDiff({ added: ["new.md"], changed: ["edit.md"], conflict: ["conflict.md"] });
    displayDiff(diff, false);

    const output = stdout.mock.calls.map((c) => String(c[0])).join("");
    expect(output).toContain("file(s) added");
    expect(output).toContain("file(s) changed");
    expect(output).toContain("file(s) in conflict");
    expect(output).not.toContain("Everything is up to date");
  });

  it("emits the full diff as JSON in json mode", () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    const diff = makeDiff({ conflict: ["docs/AGENTS.md"] });
    displayDiff(diff, true);

    const output = stdout.mock.calls.map((c) => String(c[0])).join("");
    const parsed = JSON.parse(output);
    expect(parsed.conflict).toEqual(["docs/AGENTS.md"]);
  });
});
