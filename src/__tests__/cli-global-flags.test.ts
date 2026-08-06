/**
 * cli-global-flags.test.ts — Tests for --quiet and --no-color global CLI flags
 *
 * Tests:
 * 1. Logger respects SHITENNO_QUIET env var
 * 2. Logger still outputs errors in quiet mode
 * 3. Logger works normally without SHITENNO_QUIET
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, muteLogs } from "../shared/logger.js";

// ── Logger SHITENNO_QUIET tests ────────────────────────────────────────────────

describe("logger — SHITENNO_QUIET env var", () => {
  const originalEnv = process.env.SHITENNO_QUIET;

  beforeEach(() => {
    setLogLevel("info"); // Reset log level
  });

  afterEach(() => {
    // Restore env
    if (originalEnv === undefined) {
      delete process.env.SHITENNO_QUIET;
    } else {
      process.env.SHITENNO_QUIET = originalEnv;
    }
    vi.restoreAllMocks();
  });

  it("outputs debug/info/warn when SHITENNO_QUIET is not set", () => {
    delete process.env.SHITENNO_QUIET;
    setLogLevel("debug"); // Enable all levels

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("test", "debug message");
    logger.info("test", "info message");
    logger.warn("test", "warn message");
    logger.error("test", "error message");

    expect(stderrSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("suppresses debug/info/warn when SHITENNO_QUIET=1", () => {
    process.env.SHITENNO_QUIET = "1";

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("test", "should be suppressed");
    logger.info("test", "should be suppressed");
    logger.warn("test", "should be suppressed");
    logger.error("test", "should pass through");

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("still outputs error level when SHITENNO_QUIET=1", () => {
    process.env.SHITENNO_QUIET = "1";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("test", "critical error");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("respects both SHITENNO_QUIET and log level together", () => {
    process.env.SHITENNO_QUIET = "1";
    setLogLevel("debug"); // Would normally show debug

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("test", "should be suppressed by quiet");
    logger.error("test", "should pass through");

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});

// ── MuteLogs utility ────────────────────────────────────────────────────────

describe("logger — muteLogs utility", () => {
  beforeEach(() => {
    setLogLevel("info");
  });

  afterEach(() => {
    setLogLevel("info");
    vi.restoreAllMocks();
  });

  it("suppresses all output except error", () => {
    muteLogs();

    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.debug("test", "debug msg");
    logger.info("test", "info msg");
    logger.warn("test", "warn msg");
    logger.error("test", "error msg");

    expect(stderrSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]![0]!).toContain("error msg");
  });
});
