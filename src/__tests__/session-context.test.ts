import { describe, it, expect, beforeEach } from "vitest";
import {
  setSessionContext,
  getSessionId,
  getSessionStartedAt,
  clearSessionContext,
} from "../shared/session-context.js";

beforeEach(() => {
  clearSessionContext();
});

describe("session-context", () => {
  it("returns null when no session is set", () => {
    expect(getSessionId()).toBeNull();
    expect(getSessionStartedAt()).toBeNull();
  });

  it("sets and gets session ID", () => {
    setSessionContext("session-123", "2026-07-08T00:00:00Z");
    expect(getSessionId()).toBe("session-123");
  });

  it("sets and gets session started at", () => {
    setSessionContext("session-123", "2026-07-08T00:00:00Z");
    expect(getSessionStartedAt()).toBe("2026-07-08T00:00:00Z");
  });

  it("clears session context", () => {
    setSessionContext("session-123", "2026-07-08T00:00:00Z");
    clearSessionContext();
    expect(getSessionId()).toBeNull();
    expect(getSessionStartedAt()).toBeNull();
  });

  it("overwrites previous session context", () => {
    setSessionContext("session-1", "2026-07-08T00:00:00Z");
    setSessionContext("session-2", "2026-07-08T01:00:00Z");
    expect(getSessionId()).toBe("session-2");
    expect(getSessionStartedAt()).toBe("2026-07-08T01:00:00Z");
  });
});
