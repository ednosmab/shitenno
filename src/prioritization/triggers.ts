/**
 * proactive-engine.ts — Proactive Engine for Shugo
 *
 * Subscribes to multiple event types and triggers
 * recommendations and challenges automatically.
 *
 * PRINCIPLE: Shugo should proactively suggest improvements,
 * not wait for the user to ask.
 */

import { getEventBus, type EventBus } from "../infrastructure/event-bus.js";
import { consolidateEngineeringState, type EngineeringState } from "../application/engineering-state.js";
import { generateForecast, type TrendForecast } from "../domain/rules/trend-engine.js";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";

// ── Rate Limiting & Dedup ──────────────────────────────────────────────────

interface ChallengeCooldown {
  lastGenerated: number;
  count: number;
}

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between same challenge type
const MAX_SAME_CHALLENGE_PER_HOUR = 3;
let challengeCooldowns = new Map<string, ChallengeCooldown>();

// ── Content-based Dedup ───────────────────────────────────────────────────

/** Cache of last-generated description per challenge type. Skips publish if unchanged. */
const lastChallengeDescriptions = new Map<string, string>();

/** Reset cooldowns and dedup state (for testing) */
export function resetChallengeCooldowns(): void {
  challengeCooldowns = new Map();
  lastChallengeDescriptions.clear();
}

function canGenerateChallenge(type: string): boolean {
  const now = Date.now();
  const cooldown = challengeCooldowns.get(type);

  if (!cooldown) return true;

  // Check cooldown period
  if (now - cooldown.lastGenerated < COOLDOWN_MS) {
    return false;
  }

  // Check hourly limit (reset count if hour has passed)
  if (now - cooldown.lastGenerated > 60 * 60 * 1000) {
    challengeCooldowns.delete(type);
    return true;
  }

  if (cooldown.count >= MAX_SAME_CHALLENGE_PER_HOUR) {
    return false;
  }

  return true;
}

function recordChallengeGenerated(type: string): void {
  const now = Date.now();
  const existing = challengeCooldowns.get(type);

  if (existing && now - existing.lastGenerated < 60 * 60 * 1000) {
    existing.lastGenerated = now;
    existing.count++;
  } else {
    challengeCooldowns.set(type, { lastGenerated: now, count: 1 });
  }
}

function safePublishChallenge(
  bus: EventBus,
  type: string,
  severity: string,
  description: string
): void {
  if (!canGenerateChallenge(type)) {
    logger.debug("proactive-engine", `Challenge "${type}" rate-limited — skipping`);
    return;
  }

  bus.publish("challenge.generated", { type, severity, description } as never);
  recordChallengeGenerated(type);
  logger.info("proactive-engine", `Challenge generated: ${type} (${severity})`);
}

/**
 * Content-based dedup: only publishes if the description changed since last time.
 * Prevents identical challenges from being generated on every state consolidation.
 */
function safePublishChallengeIfChanged(
  bus: EventBus,
  type: string,
  severity: string,
  description: string
): void {
  const lastDesc = lastChallengeDescriptions.get(type);
  if (lastDesc === description) {
    logger.debug("proactive-engine", `Challenge "${type}" unchanged — skipping`);
    return;
  }
  lastChallengeDescriptions.set(type, description);
  safePublishChallenge(bus, type, severity, description);
}

/**
 * Load historical engineering state snapshots for trend analysis.
 */
function loadHistoricalStates(shitennoDir: string): EngineeringState[] {
  const snapshotsDir = join(shitennoDir, "history", "snapshots");
  if (!existsSync(snapshotsDir)) return [];

  const files = readdirSync(snapshotsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  return files
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(snapshotsDir, f), "utf-8")) as EngineeringState;
      } catch {
        return null;
      }
    })
    .filter((s): s is EngineeringState => s !== null);
}

function processForecastTrends(bus: EventBus, state: EngineeringState, forecast: TrendForecast | null): void {
  if (forecast) {
    const entropyTrend = forecast.trends.find((t) => t.metric === "entropy");
    const healthTrend = forecast.trends.find((t) => t.metric === "health");

    if (entropyTrend?.direction === "degrading") {
      const desc = `Entropy is degrading at rate ${entropyTrend.rate.toFixed(1)}/snapshot`;
      safePublishChallengeIfChanged(bus, "entropy_reduction", entropyTrend.rate > 2 ? "high" : "medium", desc);
    }

    if (healthTrend?.direction === "degrading") {
      const desc = `Health score is degrading at rate ${healthTrend.rate.toFixed(1)}/snapshot`;
      safePublishChallengeIfChanged(bus, "knowledge_gap", healthTrend.rate > 3 ? "high" : "medium", desc);
    }
  } else if (state.entropy.score > 30) {
    const desc = `Entropy score is ${state.entropy.score}/100`;
    safePublishChallengeIfChanged(bus, "entropy_reduction", state.entropy.score > 50 ? "high" : "medium", desc);
  }
}

function handleStateConsolidated(bus: EventBus, projectRoot: string, shitennoDir: string): void {
  const state = consolidateEngineeringState(projectRoot, shitennoDir);
  const historicalStates = loadHistoricalStates(shitennoDir);
  const forecast = generateForecast(historicalStates);

  processForecastTrends(bus, state, forecast);

  if (state.knowledgeDebt && state.knowledgeDebt.totalGaps > 10) {
    const desc = `${state.knowledgeDebt.totalGaps} knowledge gaps detected`;
    safePublishChallengeIfChanged(bus, "knowledge_gap", state.knowledgeDebt.totalGaps > 20 ? "high" : "medium", desc);
  }

  if (state.capabilityDrift.detectedNotRegistered.length > 0) {
    const desc = `${state.capabilityDrift.detectedNotRegistered.length} capabilities detected but not registered`;
    safePublishChallengeIfChanged(bus, "capability_stale", "medium", desc);
  }
}

function handleDebtDetected(bus: EventBus, payload: unknown): void {
  const p = payload as { gapCount?: number; healthScore?: number } | undefined;
  const gapCount = p?.gapCount ?? 0;
  if (gapCount > 5) {
    safePublishChallenge(bus, "knowledge_gap", gapCount > 15 ? "high" : "medium",
      `knowledge_debt.detected: ${gapCount} gaps — consider addressing critical items`);
  }
}

function handlePlanStatusChanged(bus: EventBus, payload: unknown): void {
  const p = payload as { planId?: string; newStatus?: string; oldStatus?: string } | undefined;
  if (p?.newStatus === "done" && p?.oldStatus !== "done") {
    logger.info("proactive-engine", `Plan "${p.planId}" completed — recommending next steps`);
    safePublishChallenge(bus, "next_step", "low",
      `Plan "${p?.planId}" completed. Consider running health audit or starting next P0.`);
  }
}

function handleCapabilityInstalled(bus: EventBus, payload: unknown): void {
  const p = payload as { capabilityId?: string } | undefined;
  if (p?.capabilityId) {
    safePublishChallenge(bus, "capability_stale", "low",
      `New capability "${p.capabilityId}" installed — verify governance rules are updated`);
  }
}

function handleHealthChecked(bus: EventBus, payload: unknown): void {
  const p = payload as { score?: number } | undefined;
  if (p?.score !== undefined && p.score < 40) {
    safePublishChallenge(bus, "health_critical", "high",
      `Health score critically low: ${p.score}/100 — immediate action required`);
  }
}

function handleMaturityChanged(bus: EventBus, payload: unknown): void {
  const p = payload as { previousLevel?: string; newLevel?: string } | undefined;
  if (p?.previousLevel && p?.newLevel && p.previousLevel !== p.newLevel) {
    const maturityOrder = ["dormant", "installed", "configured", "active", "optimized"];
    const prevIndex = maturityOrder.indexOf(p.previousLevel);
    const newIndex = maturityOrder.indexOf(p.newLevel);
    const isRegression = newIndex < prevIndex || prevIndex === -1;
    const severity = isRegression ? "high" : "low";
    bus.publish("challenge.generated", {
      type: "maturity_regression",
      severity,
      description: `Maturity changed: ${p.previousLevel} → ${p.newLevel}`,
    } as never);
    recordChallengeGenerated("maturity_regression");
  }
}

/**
 * Initialize the Proactive Engine.
 * Subscribes to multiple event types and triggers
 * recommendations and challenges based on incoming events.
 * Returns an unsubscribe function for cleanup.
 */
export function initializeProactiveEngine(
  projectRoot: string,
  shitennoDir: string
): () => void {
  const bus = getEventBus();
  const unsubscribers: (() => void)[] = [];

  unsubscribers.push(bus.subscribe("engineering_state.consolidated", () => handleStateConsolidated(bus, projectRoot, shitennoDir)));
  unsubscribers.push(bus.subscribe("knowledge_debt.detected", (p) => handleDebtDetected(bus, p)));
  unsubscribers.push(bus.subscribe("plan.status_changed", (p) => handlePlanStatusChanged(bus, p)));
  unsubscribers.push(bus.subscribe("capability.installed", (p) => handleCapabilityInstalled(bus, p)));
  unsubscribers.push(bus.subscribe("health.checked", (p) => handleHealthChecked(bus, p)));
  unsubscribers.push(bus.subscribe("maturity.changed", (p) => handleMaturityChanged(bus, p)));

  logger.info("proactive-engine", `Initialized — ${unsubscribers.length} event subscriptions`);

  return () => {
    for (const unsub of unsubscribers) unsub();
    unsubscribers.length = 0;
  };
}
