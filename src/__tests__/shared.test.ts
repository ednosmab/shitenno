import { describe, it, expect, vi, afterEach } from "vitest";
import { guardInteractive } from "../shared/shared.js";

describe("guardInteractive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("returns true when answersFile is provided", () => {
    const result = guardInteractive({ answersFile: "test.json" }, false);
    expect(result).toBe(true);
  });

  it("returns true when stdin is TTY", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    const result = guardInteractive({}, false);
    expect(result).toBe(true);
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("returns false in non-interactive mode without answersFile", () => {
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    const result = guardInteractive({}, false);
    expect(result).toBe(false);
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });
});
