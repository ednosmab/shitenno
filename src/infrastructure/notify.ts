/**
 * notify.ts — Cross-Platform Desktop Notifications for Shugo
 *
 * Supports: Linux (notify-send), macOS (osascript), Windows (PowerShell/msg.exe).
 * Falls back to persistent log when no desktop notification is available.
 *
 * All notifications (sent or throttled) are logged to notifications.jsonl
 * for audit via `shugo daemon notifications`.
 */

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { platform } from "node:os";
import type { ReminderPriority } from "../application/briefing.js";
import { logger } from "../shared/logger.js";

let warnedUnsupportedPlatform = false;

// ── Notification Log ──────────────────────────────────────────────────────

const MAX_LOG_BYTES = 500_000; // 500KB
const MAX_LOG_FILES = 3;

function getLogPath(shitennoDir: string): string {
  return join(shitennoDir, "daemon", "notifications.jsonl");
}

function rotateSingleLog(logPath: string, i: number): void {
  const src = `${logPath}.${i}`;
  const dst = `${logPath}.${i + 1}`;
  if (!existsSync(src)) return;
  if (i === MAX_LOG_FILES - 1 && existsSync(dst)) {
    try { unlinkSync(dst); } catch (err) {
      logger.debug("notify", `Failed to unlink old log file: ${err}`);
    }
  }
  renameSync(src, dst);
}

function rotateLogIfNeeded(logPath: string): void {
  try {
    if (!existsSync(logPath)) return;
    const stat = statSync(logPath);
    if (stat.size < MAX_LOG_BYTES) return;
    for (let i = MAX_LOG_FILES - 1; i >= 1; i--) rotateSingleLog(logPath, i);
    renameSync(logPath, `${logPath}.1`);
  } catch {
    // Silent — log rotation failure should not break notifications
  }
}

export interface NotificationEntry {
  shitennoDir: string;
  title: string;
  message: string;
  severity: string;
  delivered: boolean;
  channel: string;
}

function logNotification(entry: NotificationEntry): void {
  try {
    const daemonDir = join(entry.shitennoDir, "daemon");
    if (!existsSync(daemonDir)) mkdirSync(daemonDir, { recursive: true });
    const logPath = getLogPath(entry.shitennoDir);
    rotateLogIfNeeded(logPath);
    const record = JSON.stringify({
      ts: new Date().toISOString(),
      title: entry.title,
      message: entry.message,
      severity: entry.severity,
      delivered: entry.delivered,
      channel: entry.channel,
    });
    appendFileSync(logPath, record + "\n", "utf-8");
  } catch {
    // Silent — logging failure should not break notifications
  }
}

// ── Platform Detection ────────────────────────────────────────────────────

type PlatformNotifier = "linux" | "macos" | "windows" | "none";

function detectPlatform(): PlatformNotifier {
  const p = platform();
  if (p === "linux") return "linux";
  if (p === "darwin") return "macos";
  if (p === "win32") return "windows";
  return "none";
}

// ── Send Functions ────────────────────────────────────────────────────────

function sendLinux(title: string, message: string, urgency: string): boolean {
  try {
    execFileSync(
      "notify-send",
      [title, message, `--urgency=${urgency}`],
      { stdio: "pipe", timeout: 2000 },
    );
    return true;
  } catch {
    return false;
  }
}

function sendMacOS(title: string, message: string): boolean {
  try {
    const script = `display notification "${message.replace(/"/g, '\\"')}" with title "${title.replace(/"/g, '\\"')}"`;
    execFileSync("osascript", ["-e", script], { stdio: "pipe", timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function sendWindows(title: string, message: string): boolean {
  try {
    const psScript = `[System.Windows.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')`;
    execFileSync("powershell", ["-NoProfile", "-Command", psScript], { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    try {
      execFileSync("msg", ["*", `${title}: ${message}`], { stdio: "pipe", timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}

// ── Deduplication ─────────────────────────────────────────────────────────

const DEDUP_COOLDOWN_MS = 5_000; // 5 seconds between identical notifications
const notificationCache = new Map<string, number>();

function getNotificationHash(title: string, message: string): string {
  return `${title}::${message}`;
}

function isDuplicate(title: string, message: string): boolean {
  const hash = getNotificationHash(title, message);
  const lastSent = notificationCache.get(hash);
  if (lastSent && Date.now() - lastSent < DEDUP_COOLDOWN_MS) {
    return true;
  }
  notificationCache.set(hash, Date.now());
  return false;
}

// ── Main Entry ────────────────────────────────────────────────────────────

export function logNotificationOnly(
  shitennoDir: string,
  title: string,
  message: string,
  priority: ReminderPriority,
): void {
  logNotification({ shitennoDir, title, message, severity: priority, delivered: false, channel: "log" });
}

/**
 * Send a desktop notification with cross-platform support.
 * Falls back to persistent log when desktop notifications are unavailable.
 *
 * @param shitennoDir - Project's .shitenno directory for notification log
 * @param title - Notification title
 * @param message - Notification message body
 * @param priority - Priority level (affects urgency on supported platforms)
 * @returns true if a desktop notification was sent
 */
function deliverByPlatform(
  notifier: PlatformNotifier, title: string, message: string, urgency: string,
): { delivered: boolean; channel: string } {
  const map: Partial<Record<PlatformNotifier, { send: () => boolean; channel: string }>> = {
    linux: { send: () => sendLinux(title, message, urgency), channel: "notify-send" },
    macos: { send: () => sendMacOS(title, message), channel: "osascript" },
    windows: { send: () => sendWindows(title, message), channel: "powershell" },
  };
  const entry = map[notifier];
  if (!entry) {
    if (!warnedUnsupportedPlatform) {
      logger.debug("notify", `Desktop notifications not available on platform: ${platform()}. Notifications logged to disk.`);
      warnedUnsupportedPlatform = true;
    }
    return { delivered: false, channel: "log" };
  }
  const delivered = entry.send();
  return { delivered, channel: delivered ? entry.channel : "log" };
}

export function sendDesktopNotification(
  shitennoDir: string,
  title: string,
  message: string,
  priority: ReminderPriority = "medium",
): boolean {
  // Skip empty messages
  if (!message || message.trim() === "") {
    logger.debug("notify", `Skipped notification with empty message: ${title}`);
    return false;
  }

  // Deduplication check
  if (isDuplicate(title, message)) {
    logger.debug("notify", `Skipped duplicate notification: ${title}`);
    return false;
  }

  // Skip real OS notifications during tests — log only
  const isTest = process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
  const urgency = priority === "high" ? "critical" : priority === "low" ? "low" : "normal";
  const { delivered, channel } = isTest
    ? { delivered: false, channel: "log" as const }
    : deliverByPlatform(detectPlatform(), title, message, urgency);
  logNotification({ shitennoDir, title, message, severity: priority, delivered, channel });
  return delivered;
}

/**
 * Read notification history from the persistent log.
 * Used by `shugo daemon notifications`.
 */
export function readNotificationLog(
  shitennoDir: string,
  options: { last?: number; severity?: string } = {},
): Array<Record<string, unknown>> {
  const logPath = getLogPath(shitennoDir);
  if (!existsSync(logPath)) return [];

  try {
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    let entries = lines.map((line) => {
      try { return JSON.parse(line) as Record<string, unknown>; }
      catch { return null; }
    }).filter((e): e is Record<string, unknown> => e !== null);

    if (options.severity) {
      entries = entries.filter((e) => e.severity === options.severity);
    }

    if (options.last && options.last > 0) {
      entries = entries.slice(-options.last);
    }

    return entries;
  } catch {
    return [];
  }
}
