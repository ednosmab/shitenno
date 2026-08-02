import type { Socket } from "node:net";
import { appendFileSync } from "node:fs";
import { logger } from "../logger.js";
import { type DaemonState, type TimerInfo, type TimerInfoResponse, MAX_EVENTS, MAX_SESSIONS } from "./state.js";

export interface IpcMessage {
  type: string;
  version?: string;
  [key: string]: unknown;
}

export function sendJson(socket: Socket, obj: object): void {
  try {
    socket.write(JSON.stringify(obj) + "\n");
  } catch {
    logger.debug("daemon", "Failed to write to socket — may have closed");
  }
}

function daemonLog(logPath: string, level: string, msg: string): void {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}\n`;
  try {
    appendFileSync(logPath, line, "utf-8");
  } catch {
    logger.debug("daemon", `Failed to write log: ${msg}`);
  }
}

export interface HandleMessageOptions {
  msg: IpcMessage;
  socket: Socket;
  shitennoDir: string;
  sockPath: string;
  startedAt: number;
  logPath: string;
  state: DaemonState;
  projectRoot: string;
  daemonVersion: string;
}

function handlePing(opts: HandleMessageOptions): void {
  sendJson(opts.socket, { type: "pong", version: opts.daemonVersion });
}

function handleHandshake(opts: HandleMessageOptions): void {
  if (opts.msg.version !== opts.daemonVersion) {
    sendJson(opts.socket, {
      type: "error",
      code: "VERSION_MISMATCH",
      daemonVersion: opts.daemonVersion,
      clientVersion: opts.msg.version,
    });
  } else {
    sendJson(opts.socket, { type: "handshake_ok", version: opts.daemonVersion });
  }
}

function computeTimerInfo(timer: TimerInfo): TimerInfoResponse {
  const nextFireAt = timer.lastFiredAt
    ? new Date(new Date(timer.lastFiredAt).getTime() + timer.intervalMs).toISOString()
    : null;
  return { lastFiredAt: timer.lastFiredAt, intervalMs: timer.intervalMs, nextFireAt };
}

function buildTimerResponse(timers: DaemonState["timers"]): { audit: TimerInfoResponse; consolidation: TimerInfoResponse; proactiveDigest: TimerInfoResponse } | null {
  if (!timers) return null;
  return {
    audit: computeTimerInfo(timers.audit),
    consolidation: computeTimerInfo(timers.consolidation),
    proactiveDigest: computeTimerInfo(timers.proactiveDigest),
  };
}

function handleStatus(opts: HandleMessageOptions): void {
  const { socket, state, sockPath, shitennoDir, startedAt, daemonVersion } = opts;
  const uptimeSec = Math.round((Date.now() - startedAt) / 1000);
  const activeSessions = state.sessions.filter((s) => !s.endedAt).length;
  const lastSession = state.sessions.length > 0 ? state.sessions[state.sessions.length - 1] : null;

  sendJson(socket, {
    type: "status",
    pid: process.pid,
    version: daemonVersion,
    shitennoDir,
    socketPath: sockPath,
    uptimeSeconds: uptimeSec,
    eventsRecorded: state.events.length,
    activeSessions,
    lastSession: lastSession ? { id: lastSession.id, startedAt: lastSession.startedAt, duration: lastSession.duration } : null,
    drift: state.drift,
    health: state.health,
    challengesQueued: state.challenges.length,
    debt: state.debt,
    proactiveEngine: state.proactiveEngine ?? null,
    audit: state.audit ?? null,
    timers: buildTimerResponse(state.timers),
    notificationStats: state.notificationStats ?? null,
  });
}

function handleStop(logPath: string): void {
  daemonLog(logPath, "INFO", "Stop requested via IPC");
  process.kill(process.pid, "SIGTERM");
}

function handleQueryEvents(opts: HandleMessageOptions): void {
  const limit = Math.min(Number(opts.msg.limit) || 20, MAX_EVENTS);
  const events = opts.state.events.slice(-limit);
  sendJson(opts.socket, { type: "events", events, count: events.length });
}

function handleQueryHealth(opts: HandleMessageOptions): void {
  const { state, startedAt, socket } = opts;
  const health = state.health;
  let trend: "improving" | "stable" | "degrading" | "critical" | "unknown" = "unknown";
  if (health) {
    if (health.score < 40) {
      trend = "critical";
    } else if (health.previousScore != null) {
      const delta = health.score - health.previousScore;
      trend = delta > 5 ? "improving" : delta < -5 ? "degrading" : "stable";
    } else {
      trend = "stable";
    }
  }
  const uptimeSeconds = Math.round((Date.now() - startedAt) / 1000);
  sendJson(socket, {
    type: "health",
    score: state.health?.score ?? null,
    checkedAt: state.health?.checkedAt ?? null,
    trend,
    uptimeSeconds,
    pid: process.pid,
    activeSessions: state.sessions.filter((s) => !s.endedAt).length,
    lastCommand: state.lastCommandName ?? null,
    lastCommandAt: state.lastCommandAt ?? null,
  });
}

function handleQueryDrift(opts: HandleMessageOptions): void {
  sendJson(opts.socket, { type: "drift", drift: opts.state.drift });
}

function handleQuerySessions(opts: HandleMessageOptions): void {
  const limit = Math.min(Number(opts.msg.limit) || 10, MAX_SESSIONS);
  const sessions = opts.state.sessions.slice(-limit);
  sendJson(opts.socket, {
    type: "sessions",
    sessions,
    total: opts.state.sessions.length,
    active: opts.state.sessions.filter((s) => !s.endedAt).length,
  });
}

function handleQueryChallenges(opts: HandleMessageOptions): void {
  sendJson(opts.socket, {
    type: "challenges",
    challenges: opts.state.challenges,
    count: opts.state.challenges.length,
  });
}

function handleQueryDebt(opts: HandleMessageOptions): void {
  sendJson(opts.socket, { type: "debt", debt: opts.state.debt });
}

async function handleQueryBriefing(opts: HandleMessageOptions): Promise<void> {
  const { state, shitennoDir, projectRoot, logPath, socket } = opts;
  if (!state.briefingCache) {
    try {
      const { collectContext } = await import("../context-collector.js");
      const snapshot = collectContext(projectRoot, shitennoDir);
      state.briefingCache = {
        computedAt: new Date().toISOString(),
        data: snapshot.briefing,
      };
      daemonLog(logPath, "INFO", "Briefing cache warmed via IPC query");
    } catch (err) {
      daemonLog(logPath, "ERROR", `Failed to compute briefing: ${err}`);
      sendJson(socket, { type: "error", message: "Failed to compute briefing" });
      return;
    }
  }
  sendJson(socket, { type: "briefing", ...state.briefingCache });
}

async function handleQueryRiskmap(opts: HandleMessageOptions): Promise<void> {
  const { state, shitennoDir, projectRoot, logPath, socket } = opts;
  if (!state.riskMapCache) {
    try {
      const { generateRiskMap } = await import("../risk-map.js");
      const riskMap = generateRiskMap(projectRoot, shitennoDir);
      state.riskMapCache = {
        computedAt: new Date().toISOString(),
        data: riskMap,
      };
      daemonLog(logPath, "INFO", "Risk map cache warmed via IPC query");
    } catch (err) {
      daemonLog(logPath, "ERROR", `Failed to compute risk map: ${err}`);
      sendJson(socket, { type: "error", message: "Failed to compute risk map" });
      return;
    }
  }
  sendJson(socket, { type: "riskmap", ...state.riskMapCache });
}

export async function handleMessage(opts: HandleMessageOptions): Promise<void> {
  switch (opts.msg.type) {
    case "ping":
      return handlePing(opts);
    case "handshake":
      return handleHandshake(opts);
    case "status":
      return handleStatus(opts);
    case "stop":
      sendJson(opts.socket, { type: "stopping" });
      return handleStop(opts.logPath);
    case "query_events":
      return handleQueryEvents(opts);
    case "query_health":
      return handleQueryHealth(opts);
    case "query_drift":
      return handleQueryDrift(opts);
    case "query_sessions":
      return handleQuerySessions(opts);
    case "query_challenges":
      return handleQueryChallenges(opts);
    case "query_debt":
      return handleQueryDebt(opts);
    case "query_briefing":
      return handleQueryBriefing(opts);
    case "query_riskmap":
      return handleQueryRiskmap(opts);
    default:
      sendJson(opts.socket, { type: "error", message: `Unknown message type: ${opts.msg.type}` });
  }
}
