/**
 * daemon-client.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:net";
import {
  shouldSkipDaemon,
  isDaemonRunning,
  getPidPath,
  stopDaemon,
  queryDaemon,
  pingDaemon,
  queryDaemonStatus,
  getSocketPath,
} from "../infrastructure/daemon-client.js";

const TEST_DIR = join(__dirname, ".test-daemon-client");

describe("daemon-client", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });
    vi.stubEnv("SHITENNO_NO_DAEMON", "");
    vi.stubEnv("CI", "");
    vi.stubEnv("SHITENNO_CHILD", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  describe("shouldSkipDaemon", () => {
    it("returns false by default", () => {
      expect(shouldSkipDaemon()).toBe(false);
    });

    it("returns true if SHITENNO_NO_DAEMON=1", () => {
      vi.stubEnv("SHITENNO_NO_DAEMON", "1");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if CI=true", () => {
      vi.stubEnv("CI", "true");
      expect(shouldSkipDaemon()).toBe(true);
    });

    it("returns true if SHITENNO_CHILD=1", () => {
      vi.stubEnv("SHITENNO_CHILD", "1");
      expect(shouldSkipDaemon()).toBe(true);
    });
  });

  describe("isDaemonRunning", () => {
    it("returns false if pid file does not exist", () => {
      expect(isDaemonRunning(TEST_DIR)).toBe(false);
    });

    it("returns false if pid file has invalid content", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, "not-a-number", "utf-8");
      expect(isDaemonRunning(TEST_DIR)).toBe(false);
    });

    it("returns true if process exists (mocked)", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, String(process.pid), "utf-8"); // We know our own process is running
      expect(isDaemonRunning(TEST_DIR)).toBe(true);
    });
  });

  describe("stopDaemon", () => {
    it("returns false if pid file does not exist", () => {
      expect(stopDaemon(TEST_DIR)).toBe(false);
    });

    it("handles error when process kill fails (invalid pid)", () => {
      const pidPath = getPidPath(TEST_DIR);
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      writeFileSync(pidPath, "999999999", "utf-8"); // Hope this doesn't exist
      
      const spy = vi.spyOn(process, "kill").mockImplementation(() => {
        throw new Error("Process not found");
      });
      
      expect(stopDaemon(TEST_DIR)).toBe(false);
      spy.mockRestore();
    });
  });

  describe("queryDaemon", () => {
    it("returns null when socket does not exist", async () => {
      const result = await queryDaemon(TEST_DIR, { type: "ping" });
      expect(result).toBeNull();
    });

    it("returns null on malformed JSON response", async () => {
      mkdirSync(join(TEST_DIR, "daemon"), { recursive: true });
      const socketPath = getSocketPath(TEST_DIR);

      const server = createServer((socket) => {
        socket.on("data", () => {
          socket.write("not-json\n");
        });
      });
      await new Promise<void>((resolve) => server.listen(socketPath, resolve));

      const result = await queryDaemon(TEST_DIR, { type: "ping" });
      expect(result).toBeNull();

      await new Promise<void>((resolve) => server.close(() => resolve()));
    });
  });

  describe("pingDaemon", () => {
    it("returns false when daemon is not running", async () => {
      const result = await pingDaemon(TEST_DIR);
      expect(result).toBe(false);
    });
  });

  describe("queryDaemonStatus", () => {
    it("returns null when daemon is not running", async () => {
      const result = await queryDaemonStatus(TEST_DIR);
      expect(result).toBeNull();
    });
  });
});
