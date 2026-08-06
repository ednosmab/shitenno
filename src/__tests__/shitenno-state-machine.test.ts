import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  isValidTransition,
  detectLifecycleState,
  createStateMachine,
  canRunCommand,
} from "../infrastructure/shitenno-state-machine.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-state-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("ShitennoStateMachine", () => {
  describe("isValidTransition", () => {
    it("allows uninitialized -> discovered", () => {
      expect(isValidTransition("uninitialized", "discovered")).toBe(true);
    });

    it("allows discovered -> assessed", () => {
      expect(isValidTransition("discovered", "assessed")).toBe(true);
    });

    it("allows assessed -> governed", () => {
      expect(isValidTransition("assessed", "governed")).toBe(true);
    });

    it("allows governed -> evolved", () => {
      expect(isValidTransition("governed", "evolved")).toBe(true);
    });

    it("allows evolved -> governed (regression)", () => {
      expect(isValidTransition("evolved", "governed")).toBe(true);
    });

    it("blocks uninitialized -> assessed", () => {
      expect(isValidTransition("uninitialized", "assessed")).toBe(false);
    });

    it("blocks uninitialized -> governed", () => {
      expect(isValidTransition("uninitialized", "governed")).toBe(false);
    });

    it("blocks discovered -> evolved", () => {
      expect(isValidTransition("discovered", "evolved")).toBe(false);
    });
  });

  describe("detectLifecycleState", () => {
    it("returns uninitialized for empty directory", () => {
      const state = detectLifecycleState(tempDir, join(tempDir, "shitenno"));
      expect(state).toBe("uninitialized");
    });

    it("returns discovered when shitenno/ exists", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const state = detectLifecycleState(tempDir, shitennoDir);
      expect(state).toBe("discovered");
    });

    it("returns assessed when maturity-profile.json exists", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      writeFileSync(join(shitennoDir, "maturity-profile.json"), "{}");

      const state = detectLifecycleState(tempDir, shitennoDir);
      expect(state).toBe("assessed");
    });

    it("returns governed when WORKFLOW.md exists", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      writeFileSync(join(shitennoDir, "maturity-profile.json"), "{}");
      mkdirSync(join(shitennoDir, "governance"), { recursive: true });
      writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");

      const state = detectLifecycleState(tempDir, shitennoDir);
      expect(state).toBe("governed");
    });

    it("returns evolved when evolution report exists", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });
      writeFileSync(join(shitennoDir, "maturity-profile.json"), "{}");
      mkdirSync(join(shitennoDir, "governance"), { recursive: true });
      writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
      mkdirSync(join(shitennoDir, "reports"), { recursive: true });
      writeFileSync(
        join(shitennoDir, "reports", "evolution-2026-06-27.json"),
        "{}"
      );

      const state = detectLifecycleState(tempDir, shitennoDir);
      expect(state).toBe("evolved");
    });
  });

  describe("state machine operations", () => {
    it("transitions between states", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const sm = createStateMachine(shitennoDir);
      expect(sm.getState()).toBe("uninitialized");

      sm.transition("discovered", "shugo init");
      expect(sm.getState()).toBe("discovered");
    });

    it("rejects invalid transitions", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const sm = createStateMachine(shitennoDir);
      const result = sm.transition("assessed", "skip init");
      expect(result).toBe(false);
      expect(sm.getState()).toBe("uninitialized");
    });

    it("canTransition returns correct value", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const sm = createStateMachine(shitennoDir);
      expect(sm.canTransition("discovered")).toBe(true);
      expect(sm.canTransition("assessed")).toBe(false);
    });

    it("records transition history", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const sm = createStateMachine(shitennoDir);
      sm.transition("discovered", "shugo init");
      sm.transition("assessed", "shugo assess");

      const history = sm.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0]!.from).toBe("uninitialized");
      expect(history[0]!.to).toBe("discovered");
      expect(history[1]!.from).toBe("discovered");
      expect(history[1]!.to).toBe("assessed");
    });

    it("persists state to disk", () => {
      const shitennoDir = join(tempDir, "shitenno");
      mkdirSync(shitennoDir, { recursive: true });

      const sm = createStateMachine(shitennoDir);
      sm.transition("discovered", "shugo init");

      // Create new instance from same directory
      const sm2 = createStateMachine(shitennoDir);
      expect(sm2.getState()).toBe("discovered");
    });
  });

  describe("canRunCommand", () => {
    it("allows init only when uninitialized", () => {
      expect(canRunCommand("init", "uninitialized")).toBe(true);
      expect(canRunCommand("init", "discovered")).toBe(false);
    });

    it("allows status when discovered or later", () => {
      expect(canRunCommand("status", "uninitialized")).toBe(false);
      expect(canRunCommand("status", "discovered")).toBe(true);
      expect(canRunCommand("status", "assessed")).toBe(true);
    });

    it("allows detect when discovered or later", () => {
      expect(canRunCommand("detect", "discovered")).toBe(true);
      expect(canRunCommand("detect", "assessed")).toBe(true);
    });

    it("allows unknown commands", () => {
      expect(canRunCommand("unknown", "uninitialized")).toBe(true);
    });
  });
});
