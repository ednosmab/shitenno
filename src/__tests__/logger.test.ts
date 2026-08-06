import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, setLogLevel, muteLogs } from "../shared/logger.js";

describe("logger", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: { warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    consoleSpy = {
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
    setLogLevel("info");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("info writes to stderr", () => {
    logger.info("TestModule", "hello");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]![0]).toContain("[TestModule]");
    expect(stderrSpy.mock.calls[0]![0]).toContain("hello");
  });

  it("info does not write to stdout", () => {
    logger.info("TestModule", "hello");
    expect(stdoutSpy).not.toHaveBeenCalled();
  });

  it("warn logs to console.warn", () => {
    logger.warn("TestModule", "warning");
    expect(consoleSpy.warn).toHaveBeenCalledOnce();
  });

  it("error logs to console.error", () => {
    setLogLevel("error");
    logger.error("TestModule", "fail");
    expect(consoleSpy.error).toHaveBeenCalledOnce();
  });

  it("debug does not log when level is info", () => {
    logger.debug("TestModule", "hidden");
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it("debug writes to stderr when level is debug", () => {
    setLogLevel("debug");
    logger.debug("TestModule", "visible");
    expect(stderrSpy).toHaveBeenCalledOnce();
    expect(stderrSpy.mock.calls[0]![0]).toContain("[TestModule]");
    expect(stderrSpy.mock.calls[0]![0]).toContain("visible");
  });

  it("muteLogs suppresses all except error", () => {
    muteLogs();
    logger.info("TestModule", "suppressed");
    logger.warn("TestModule", "suppressed");
    logger.debug("TestModule", "suppressed");
    logger.error("TestModule", "visible");
    expect(consoleSpy.error.mock.calls.length).toBe(1);
    expect(consoleSpy.error.mock.calls[0]![0]!).toContain("visible");
    expect(consoleSpy.warn).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
