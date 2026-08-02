import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendDesktopNotification, readNotificationLog } from "../notify.js";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("sendDesktopNotification", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `notify-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should log notification to file", () => {
    const result = sendDesktopNotification(shitennoDir, "Test Title", "Test message", "medium");
    
    // May return true or false depending on platform, but should log
    expect(typeof result).toBe("boolean");
    
    const logPath = join(shitennoDir, "daemon", "notifications.jsonl");
    expect(existsSync(logPath)).toBe(true);
    
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("Test Title");
    expect(content).toContain("Test message");
  });

  it("should handle empty message gracefully", () => {
    const result = sendDesktopNotification(shitennoDir, "Test Title", "", "medium");
    
    expect(result).toBe(false); // Empty messages should be skipped
    
    const logPath = join(shitennoDir, "daemon", "notifications.jsonl");
    // Should not log empty messages
    expect(existsSync(logPath)).toBe(false);
  });

  it("should deduplicate identical notifications within cooldown", () => {
    // First notification
    sendDesktopNotification(shitennoDir, "Duplicate Test", "Message 1", "medium");
    
    // Second identical notification (should be deduplicated)
    sendDesktopNotification(shitennoDir, "Duplicate Test", "Message 1", "medium");
    
    const logPath = join(shitennoDir, "daemon", "notifications.jsonl");
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    
    // Should only have one entry for the duplicate
    const duplicateEntries = lines.filter(line => 
      line.includes("Duplicate Test") && line.includes("Message 1")
    );
    expect(duplicateEntries.length).toBe(1);
  });

  it("should allow different notifications", () => {
    sendDesktopNotification(shitennoDir, "Notification 1", "Message 1", "medium");
    sendDesktopNotification(shitennoDir, "Notification 2", "Message 2", "medium");
    
    const logPath = join(shitennoDir, "daemon", "notifications.jsonl");
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("Notification 1");
    expect(lines[1]).toContain("Notification 2");
  });
});

describe("readNotificationLog", () => {
  let testDir: string;
  let shitennoDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `notify-log-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    shitennoDir = join(testDir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("should return empty array when no log exists", () => {
    const result = readNotificationLog(shitennoDir);
    expect(result).toEqual([]);
  });

  it("should read notification log", () => {
    // Create a test log
    const daemonDir = join(shitennoDir, "daemon");
    mkdirSync(daemonDir, { recursive: true });
    const logPath = join(daemonDir, "notifications.jsonl");
    
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      title: "Test",
      message: "Test message",
      severity: "medium",
      delivered: false,
      channel: "log"
    });
    
    require("node:fs").writeFileSync(logPath, entry + "\n");
    
    const result = readNotificationLog(shitennoDir);
    expect(result.length).toBe(1);
    expect(result[0]).toBeDefined();
    expect(result[0]?.title).toBe("Test");
  });
});
