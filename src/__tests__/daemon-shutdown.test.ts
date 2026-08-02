import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { Server } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setupShutdown, type ShutdownTimers } from "../daemon/shutdown.js";
import { createDaemonState } from "../daemon/state.js";
import type { DaemonContext } from "../daemon/pid-manager.js";

/**
 * Regression: the daemon MUST register global error handlers (SIGTERM/SIGINT,
 * uncaughtException, unhandledRejection) with state persist + cleanup.
 * See: PLANO-MESTRE-UNICO-v2-2026-08-01.md — Item 2 (already implemented)
 */

let tempDir: string;
let logPath: string;

function makeTimers(): ShutdownTimers {
  return {
    stableTimer: setTimeout(() => {}, 60_000),
    checkNagTimer: setTimeout(() => {}, 60_000),
    persistTimer: setInterval(() => {}, 60_000),
    auditTimer: setInterval(() => {}, 60_000),
    consolidationTimer: setInterval(() => {}, 60_000),
    cleanupAudit: () => {},
  };
}

function makeContext(): DaemonContext {
  return {
    shitennoDir: tempDir,
    projectRoot: tempDir,
    daemonDir: join(tempDir, "daemon"),
    pidPath: join(tempDir, "daemon.pid"),
    sockPath: join(tempDir, "daemon.sock"),
    logPath,
    approvedPath: join(tempDir, "approved.json"),
    statePath: join(tempDir, "state.json"),
    state: createDaemonState(),
    socket: new Server(),
    stopProactive: () => {},
    stopWatcher: () => {},
  };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-shutdown-"));
  logPath = join(tempDir, "daemon.log");
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("setupShutdown — global error handler registration (Item 2)", () => {
  it("registers SIGTERM, SIGINT, uncaughtException and unhandledRejection handlers", () => {
    const registered: string[] = [];
    vi.spyOn(process, "on").mockImplementation(((event: string) => {
      registered.push(event);
      return process;
    }) as typeof process.on);

    setupShutdown(makeContext(), makeTimers());

    expect(registered).toContain("SIGTERM");
    expect(registered).toContain("SIGINT");
    expect(registered).toContain("uncaughtException");
    expect(registered).toContain("unhandledRejection");
  });

  it("logs unhandled rejections to the daemon log", () => {
    vi.spyOn(process, "on").mockImplementation(((event: string, cb: (reason: unknown) => void) => {
      if (event === "unhandledRejection") cb(new Error("boom-rejection"));
      return process;
    }) as typeof process.on);

    setupShutdown(makeContext(), makeTimers());

    const log = readFileSync(logPath, "utf-8");
    expect(log).toContain("Unhandled promise rejection");
    expect(log).toContain("boom-rejection");
  });
});
