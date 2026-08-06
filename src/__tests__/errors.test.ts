import { describe, it, expect } from "vitest";
import {
  ShitennoError,
  NotInitializedError,
  InvalidRuleError,
  ScriptNotAllowedError,
} from "../domain/types/errors.js";

describe("ShitennoError", () => {
  it("has name, message, and code", () => {
    const err = new ShitennoError("something broke", "E_FAIL");
    expect(err.name).toBe("ShitennoError");
    expect(err.message).toBe("something broke");
    expect(err.code).toBe("E_FAIL");
    expect(err.exitCode).toBe(1);
    expect(err).toBeInstanceOf(Error);
  });

  it("accepts custom exitCode", () => {
    const err = new ShitennoError("fail", "E_FAIL", 2);
    expect(err.exitCode).toBe(2);
  });
});

describe("NotInitializedError", () => {
  it("is a ShitennoError with default message", () => {
    const err = new NotInitializedError();
    expect(err).toBeInstanceOf(ShitennoError);
    expect(err.name).toBe("ShitennoError");
    expect(err.code).toBe("NOT_INITIALIZED");
    expect(err.message).toContain("not initialized");
  });
});

describe("InvalidRuleError", () => {
  it("is a ShitennoError", () => {
    const err = new InvalidRuleError("bad rule");
    expect(err).toBeInstanceOf(ShitennoError);
    expect(err.code).toBe("INVALID_RULE");
    expect(err.message).toContain("bad rule");
  });
});

describe("ScriptNotAllowedError", () => {
  it("is a ShitennoError", () => {
    const err = new ScriptNotAllowedError("evil.sh");
    expect(err).toBeInstanceOf(ShitennoError);
    expect(err.code).toBe("SCRIPT_NOT_ALLOWED");
    expect(err.message).toContain("evil.sh");
  });
});
