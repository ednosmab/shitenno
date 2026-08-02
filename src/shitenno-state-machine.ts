/**
 * shitenno-state-machine.ts — Lifecycle State Machine
 *
 * Governs the lifecycle of the Shitenno itself.
 * Tracks states and validates transitions.
 *
 * PRINCIPLE: The system that governs should govern itself.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";

// ── Types (re-exported from domain entities) ────────────────────────────────

import type { ShitennoLifecycleState, StateTransition } from "./domain/entities/engineering-state.js";

export type { ShitennoLifecycleState, StateTransition } from "./domain/entities/engineering-state.js";

interface StateMachineFile {
  currentState: ShitennoLifecycleState;
  history: StateTransition[];
  lastUpdated: string;
}

// ── Valid Transitions ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ShitennoLifecycleState, ShitennoLifecycleState[]> = {
  uninitialized: ["discovered"],
  discovered: ["assessed"],
  assessed: ["governed"],
  governed: ["evolved", "assessed"],
  evolved: ["governed", "assessed"],
};

/** Check if a transition is valid. */
export function isValidTransition(
  from: ShitennoLifecycleState,
  to: ShitennoLifecycleState
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// ── State Detection ──────────────────────────────────────────────────────────

/** Detect the current lifecycle state from filesystem. */
export function detectLifecycleState(
  _projectRoot: string,
  shitennoDir: string
): ShitennoLifecycleState {
  // Check: uninitialized
  if (!existsSync(shitennoDir)) {
    return "uninitialized";
  }

  // Check: discovered (has maturity profile)
  if (!existsSync(join(shitennoDir, "maturity-profile.json"))) {
    return "discovered";
  }

  // Check: assessed (has governance workflow)
  if (!existsSync(join(shitennoDir, "governance", "WORKFLOW.md"))) {
    return "assessed";
  }

  // Check: evolved (has evolution report)
  const reportsDir = join(shitennoDir, "reports");
  if (existsSync(reportsDir)) {
    const evolutionReports = readdirSync(reportsDir).filter(
      (f) => f.startsWith("evolution-") && f.endsWith(".json")
    );
    if (evolutionReports.length > 0) {
      return "evolved";
    }
  }

  return "governed";
}

// ── State Machine ────────────────────────────────────────────────────────────

export interface ShitennoStateMachine {
  getState(): ShitennoLifecycleState;
  canTransition(to: ShitennoLifecycleState): boolean;
  transition(
    to: ShitennoLifecycleState,
    trigger: string
  ): boolean;
  getHistory(): StateTransition[];
  save(): void;
}

function getStateFilePath(shitennoDir: string): string {
  return join(shitennoDir, "lifecycle-state.json");
}

function loadPersistedState(stateFilePath: string): { state: ShitennoLifecycleState; history: StateTransition[] } {
  if (!existsSync(stateFilePath)) {
    return { state: "uninitialized", history: [] };
  }
  try {
    const file: StateMachineFile = JSON.parse(readFileSync(stateFilePath, "utf-8"));
    return { state: file.currentState, history: file.history || [] };
  } catch {
    return { state: "uninitialized", history: [] };
  }
}

function persistState(stateFilePath: string, shitennoDir: string, currentState: ShitennoLifecycleState, history: StateTransition[]): void {
  const dir = join(shitennoDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file: StateMachineFile = { currentState, history, lastUpdated: new Date().toISOString() };
  writeFileSync(stateFilePath, JSON.stringify(file, null, 2));
}

export function createStateMachine(shitennoDir: string): ShitennoStateMachine {
  const stateFilePath = getStateFilePath(shitennoDir);
  const initial = loadPersistedState(stateFilePath);
  let currentState = initial.state;
  const history = initial.history;

  return {
    getState() { return currentState; },
    canTransition(to: ShitennoLifecycleState) { return isValidTransition(currentState, to); },

    transition(to: ShitennoLifecycleState, trigger: string): boolean {
      if (!isValidTransition(currentState, to)) return false;
      const from = currentState;
      currentState = to;
      history.push({ from, to, trigger, timestamp: new Date().toISOString() });
      this.save();
      getEventBus().publish("lifecycle.state_changed", {
        capabilityId: "lifecycle", previousState: from, newState: to, reason: trigger,
      });
      return true;
    },

    getHistory() { return [...history]; },
    save() { persistState(stateFilePath, shitennoDir, currentState, history); },
  };
}

// ── Gate Enforcement ─────────────────────────────────────────────────────────

import { COMMAND_GATES } from "./constants.js";

/** Check if a command is allowed in the current state. */
export function canRunCommand(
  command: string,
  currentState: ShitennoLifecycleState
): boolean {
  const requiredState = COMMAND_GATES[command] as ShitennoLifecycleState | undefined;
  if (!requiredState) return true; // Unknown commands are allowed

  const stateOrder: ShitennoLifecycleState[] = [
    "uninitialized",
    "discovered",
    "assessed",
    "governed",
    "evolved",
  ];

  const currentIdx = stateOrder.indexOf(currentState);
  const requiredIdx = stateOrder.indexOf(requiredState);

  // init can only run from uninitialized (exact match)
  if (command === "init") {
    return currentIdx === requiredIdx;
  }

  // Other commands can run from required state or later
  return currentIdx >= requiredIdx;
}
