import { describe, it, expect, vi } from "vitest";
import {
  healthBar,
  outputJson,
  statusIcon,
  banner,
} from "../shared/formatting.js";

// ── healthBar ────────────────────────────────────────────────────────────────

describe("healthBar", () => {
  it("renders a full bar at 100%", () => {
    const bar = healthBar(20, 20);
    expect(bar).toContain("█");
    expect(bar).toContain("100%");
  });

  it("renders an empty bar at 0%", () => {
    const bar = healthBar(0, 20);
    expect(bar).toContain("░");
    expect(bar).toContain("0%");
  });

  it("renders a half bar at 50%", () => {
    const bar = healthBar(10, 20);
    expect(bar).toContain("50%");
    expect(bar).toContain("█");
    expect(bar).toContain("░");
  });

  it("clamps to 100% when score exceeds max", () => {
    const bar = healthBar(50, 20);
    expect(bar).toContain("100%");
  });

  it("handles negative score gracefully", () => {
    const bar = healthBar(-5, 20);
    expect(bar).toContain("0%");
  });

  it("uses default max=100 when not specified", () => {
    const bar = healthBar(80);
    expect(bar).toContain("80%");
  });

  it("uses custom width", () => {
    const bar = healthBar(50, 100, 10);
    expect(bar).toContain("50%");
  });
});

// ── outputJson ───────────────────────────────────────────────────────────────

describe("outputJson", () => {
  it("outputs valid JSON to stdout", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    outputJson({ key: "value", num: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const raw = spy.mock.calls[0]![0] as string;
    const output = JSON.parse(raw.replace(/\n$/, ""));
    expect(output).toEqual({ key: "value", num: 42 });
    spy.mockRestore();
  });

  it("outputs nested objects", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    outputJson({ arr: [1, 2], nested: { a: true } });
    const raw = spy.mock.calls[0]![0] as string;
    const output = JSON.parse(raw.replace(/\n$/, ""));
    expect(output.arr).toEqual([1, 2]);
    expect(output.nested.a).toBe(true);
    spy.mockRestore();
  });
});

// ── statusIcon ───────────────────────────────────────────────────────────────

describe("statusIcon", () => {
  it("returns ✔ for pass", () => {
    const { icon } = statusIcon("pass");
    expect(icon).toBe("✔");
  });

  it("returns ⚠ for warn", () => {
    const { icon } = statusIcon("warn");
    expect(icon).toBe("⚠");
  });

  it("returns ✘ for fail", () => {
    const { icon } = statusIcon("fail");
    expect(icon).toBe("✘");
  });

  it("returns a function (chalk color) for each status", () => {
    expect(typeof statusIcon("pass").color).toBe("function");
    expect(typeof statusIcon("warn").color).toBe("function");
    expect(typeof statusIcon("fail").color).toBe("function");
  });
});

// ── banner ───────────────────────────────────────────────────────────────────

describe("banner", () => {
  it("prints a 3-line box containing the title and subtitle", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    banner("shugo status", "Health Check");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("shugo status — Health Check");
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it("box width adapts to content length", () => {
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    banner("shugo init", "Setup");
    const lines = spy.mock.calls.map((c) => (c[0] as string).replace(/\n$/, ""));
    const label = "shugo init — Setup";
    const expectedWidth = label.length + 4;
    expect(lines[0]).toContain("═".repeat(expectedWidth));
    spy.mockRestore();
  });
});
