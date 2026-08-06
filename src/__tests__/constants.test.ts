import { describe, it, expect } from "vitest";
import { VIOLATION_KEYWORDS, COMMAND_GATES, GIT_TIMEOUT, RULE_SCRIPT_TIMEOUT, VALID_ACTION_TYPES } from "../domain/types/constants.js";

describe("VIOLATION_KEYWORDS", () => {
  it("is a non-empty array of strings", () => {
    expect(Array.isArray(VIOLATION_KEYWORDS)).toBe(true);
    expect(VIOLATION_KEYWORDS.length).toBeGreaterThan(0);
    expect(VIOLATION_KEYWORDS.every((k) => typeof k === "string")).toBe(true);
  });

  it("contains common violation terms", () => {
    expect(VIOLATION_KEYWORDS).toContain("bug");
    expect(VIOLATION_KEYWORDS).toContain("fix");
    expect(VIOLATION_KEYWORDS).toContain("rollback");
    expect(VIOLATION_KEYWORDS).toContain("regressão");
  });
});

describe("COMMAND_GATES", () => {
  it("maps init to uninitialized", () => {
    expect(COMMAND_GATES.init).toBe("uninitialized");
  });

  it("maps status to discovered", () => {
    expect(COMMAND_GATES.status).toBe("discovered");
  });

  it("maps upgrade to assessed", () => {
    expect(COMMAND_GATES.upgrade).toBe("assessed");
  });

  it("has at least 14 command entries", () => {
    expect(Object.keys(COMMAND_GATES).length).toBeGreaterThanOrEqual(14);
  });
});

describe("Timeouts", () => {
  it("GIT_TIMEOUT is 5000ms", () => {
    expect(GIT_TIMEOUT).toBe(5000);
  });

  it("RULE_SCRIPT_TIMEOUT is 30000ms", () => {
    expect(RULE_SCRIPT_TIMEOUT).toBe(30000);
  });
});

describe("VALID_ACTION_TYPES", () => {
  it("contains all 21 action types", () => {
    expect(VALID_ACTION_TYPES).toHaveLength(21);
  });

  it("includes all required action types", () => {
    expect(VALID_ACTION_TYPES).toContain("update_context_buffer");
    expect(VALID_ACTION_TYPES).toContain("create_reminder");
    expect(VALID_ACTION_TYPES).toContain("log_event");
    expect(VALID_ACTION_TYPES).toContain("run_shugo_command");
    expect(VALID_ACTION_TYPES).toContain("auto_populate_next_p0");
  });
});
