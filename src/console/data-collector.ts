/**
 * data-collector.ts — Collects all data from Shugo modules for the Console
 *
 * Reads from engineering-state, maturity-profile, knowledge-graph,
 * knowledge-debt, goal-engine, decision-engine, session-tracker,
 * event-bus, growth-profile, and health-auditor.
 *
 * PRINCIPLE: Single data source for all console tabs.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { detectLifecycleState, type ShitennoLifecycleState } from "../infrastructure/shitenno-state-machine.js";
import { getSessionMetrics, type SessionMetrics } from "../infrastructure/session-tracker.js";
import { getEventBus, type EventEnvelope } from "../infrastructure/event-bus.js";
import type { GrowthProfile } from "../infrastructure/growth-profile.js";
import type { EngineeringState } from "../application/engineering-state.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ConsoleData {
  timestamp: string;
  projectRoot: string;
  shitennoDir: string;

  // Lifecycle
  lifecycle: ShitennoLifecycleState;

  // Engineering State
  engineering: import("../application/engineering-state.js").EngineeringState;

  // Maturity
  maturity: import("../application/maturity-profile.js").MaturityProfile | null;

  // Knowledge Graph
  graph: import("../infrastructure/knowledge-graph.js").GraphAnalysis;

  // Knowledge Debt
  debt: import("../application/knowledge-debt.js").KnowledgeDebtReport | null;

  // Capabilities
  capabilities: import("../application/maturity-profile.js").Capability[];
  capabilityEntities: import("../application/capability-engine.js").CapabilityEntity[];

  // Goals (raw JSON files)
  goals: GoalData[];

  // Decisions (raw JSON files)
  decisions: DecisionData[];

  // Session Metrics
  session: SessionMetrics;

  // Recent Events
  recentEvents: EventEnvelope[];

  // Growth Profile
  growth: GrowthProfile | null;

  // Entropy
  entropy: {
    orphanedAssets: number;
    staleAssets: number;
    missingDependencies: number;
    score: number;
  };

  // Health Scores
  health: {
    overall: number;
    knowledgeDebt: number;
    knowledgeGraph: number;
    entropy: number;
  };

  // Quick Stats
  stats: {
    totalAssets: number;
    totalRules: number;
    totalSkills: number;
    totalAdrs: number;
    totalContracts: number;
    totalSessions: number;
    totalEvents: number;
    totalGoals: number;
    totalDecisions: number;
  };
}

export interface GoalData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  progress: number;
  targets: string[];
  criteria: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionData {
  id: string;
  request: { action: string; category: string };
  scores: Array<{ evaluator: string; score: number; reasoning: string }>;
  compositeScore: number;
  recommendation: string;
  confidence: number;
  decidedAt: string;
}

// ── Data Collection ────────────────────────────────────────────────────────

export async function collectConsoleData(projectRoot: string, shitennoDir: string): Promise<ConsoleData> {
  const timestamp = new Date().toISOString();
  const lifecycle = detectLifecycleState(projectRoot, shitennoDir);

  // Lazy-load heavy modules
  const { loadMaturityProfile, detectCapabilitySignalsFromFilesystem } = await import("../application/maturity-profile.js");
  const { consolidateEngineeringState } = await import("../application/engineering-state.js");
  const { loadArtifacts, loadRelations, analyzeGraph } = await import("../infrastructure/knowledge-graph.js");
  const { detectKnowledgeDebt } = await import("../application/knowledge-debt.js");
  const { evaluateCapabilities } = await import("../application/capability-engine.js");
  const { loadGrowthProfile } = await import("../infrastructure/growth-profile.js");

  const maturity = loadMaturityProfile(shitennoDir);
  const engineering = consolidateEngineeringState(projectRoot, shitennoDir, maturity);

  const artifacts = loadArtifacts(shitennoDir);
  const relations = loadRelations(shitennoDir);
  const graph = analyzeGraph(artifacts, relations);

  const debt = detectKnowledgeDebt(projectRoot, shitennoDir);
  const capabilities = detectCapabilitySignalsFromFilesystem(shitennoDir);
  const capabilityResult = evaluateCapabilities(engineering, shitennoDir);
  const capabilityEntities = capabilityResult.capabilities;

  const goals = loadGoals(shitennoDir);
  const decisions = loadDecisions(shitennoDir);
  const session = getSessionMetrics(shitennoDir);
  const recentEvents = getEventBus().getHistory().slice(-20);
  const growth = loadGrowthProfile(shitennoDir);
  const entropy = engineering.entropy;
  const health = buildHealth(engineering);
  const stats = buildStats({ engineering, artifacts, session, recentEvents, goals, decisions });

  return {
    timestamp,
    projectRoot,
    shitennoDir,
    lifecycle,
    engineering,
    maturity,
    graph,
    debt,
    capabilities,
    capabilityEntities,
    goals,
    decisions,
    session,
    recentEvents,
    growth,
    entropy,
    health,
    stats,
  };
}

// ── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: ConsoleData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Get cached data or collect fresh data.
 * TTL defaults to 5 seconds to avoid excessive file I/O during rapid tab switches.
 */
export async function getOrCollectConsoleData(
  projectRoot: string,
  shitennoDir: string,
  ttlMs: number = 5000,
): Promise<ConsoleData> {
  const key = `${projectRoot}:${shitennoDir}`;
  const now = Date.now();
  const entry = cache.get(key);

  if (entry && now - entry.timestamp < ttlMs) {
    return entry.data;
  }

  const data = await collectConsoleData(projectRoot, shitennoDir);
  cache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Clear the data cache (useful after write operations).
 */
export function clearConsoleDataCache(): void {
  cache.clear();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildHealth(engineering: EngineeringState): ConsoleData["health"] {
  return {
    overall: engineering.healthScores.overall,
    knowledgeDebt: engineering.healthScores.knowledgeDebt,
    knowledgeGraph: engineering.healthScores.knowledgeGraph,
    entropy: 100 - engineering.entropy.score,
  };
}

interface BuildStatsOptions {
  engineering: EngineeringState;
  artifacts: Array<{ type: string }>;
  session: SessionMetrics;
  recentEvents: EventEnvelope[];
  goals: GoalData[];
  decisions: DecisionData[];
}

function buildStats(options: BuildStatsOptions): ConsoleData["stats"] {
  return {
    totalAssets: options.engineering.assets.length,
    totalRules: options.engineering.activeRules,
    totalSkills: countByType(options.artifacts, "skill"),
    totalAdrs: countByType(options.artifacts, "adr"),
    totalContracts: countByType(options.artifacts, "contract"),
    totalSessions: options.session.totalSessions,
    totalEvents: options.recentEvents.length,
    totalGoals: options.goals.length,
    totalDecisions: options.decisions.length,
  };
}

function countByType(artifacts: Array<{ type: string }>, type: string): number {
  return artifacts.filter((a) => a.type === type).length;
}

function loadGoals(shitennoDir: string): GoalData[] {
  const goalsDir = join(shitennoDir, "governance", "goals");
  if (!existsSync(goalsDir)) return [];

  return readdirSync(goalsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(goalsDir, f), "utf-8")) as GoalData;
      } catch {
        return null;
      }
    })
    .filter((g): g is GoalData => g !== null);
}

function loadDecisions(shitennoDir: string): DecisionData[] {
  const decisionsDir = join(shitennoDir, "governance", "decisions");
  if (!existsSync(decisionsDir)) return [];

  return readdirSync(decisionsDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(decisionsDir, f), "utf-8")) as DecisionData;
      } catch {
        return null;
      }
    })
    .filter((d): d is DecisionData => d !== null);
}
