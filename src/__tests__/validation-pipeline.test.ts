import { describe, it, expect } from "vitest";
import { runValidationPhase, runFullValidation, getPhaseConfig, type CommandRunner } from "../infrastructure/validation-pipeline.js";

const mockRunner: CommandRunner = (cmd, _timeout) => ({
  success: true,
  output: `mock output for: ${cmd}`,
  duration: 100,
});

const failingRunner: CommandRunner = (cmd, _timeout) => ({
  success: false,
  output: `mock error for: ${cmd}`,
  duration: 100,
});

describe("validation-pipeline", () => {
  describe("getPhaseConfig", () => {
    it("returns correct config for phase1", () => {
      const config = getPhaseConfig("phase1");
      expect(config.name).toBe("Phase 1 — Foundation");
      expect(config.required).toBe(true);
      expect(config.timeout).toBe(120_000);
    });

    it("returns correct config for phase2", () => {
      const config = getPhaseConfig("phase2");
      expect(config.name).toBe("Phase 2 — Integration");
      expect(config.required).toBe(true);
      expect(config.timeout).toBe(180_000);
    });

    it("returns correct config for phase3", () => {
      const config = getPhaseConfig("phase3");
      expect(config.name).toBe("Phase 3 — Performance");
      expect(config.required).toBe(false);
      expect(config.timeout).toBe(300_000);
    });
  });

  describe("runValidationPhase", () => {
    it("returns a valid report structure", () => {
      const report = runValidationPhase("phase1", mockRunner);
      
      expect(report.phase).toBe("phase1");
      expect(report.startedAt).toBeDefined();
      expect(report.completedAt).toBeDefined();
      expect(report.results).toBeInstanceOf(Array);
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.passed + report.summary.failed).toBe(report.summary.total);
    });

    it("includes common gates in phase1", () => {
      const report = runValidationPhase("phase1", mockRunner);
      
      const commonGates = report.results.filter((r) => r.gate === "common");
      expect(commonGates.length).toBeGreaterThan(0);
      
      const gateNames = commonGates.map((r) => r.name);
      expect(gateNames).toContain("tests-pass");
      expect(gateNames).toContain("lint-clean");
      expect(gateNames).toContain("typecheck-clean");
    });

    it("includes phase-specific gates", () => {
      const report1 = runValidationPhase("phase1", mockRunner);
      const report2 = runValidationPhase("phase2", mockRunner);
      const report3 = runValidationPhase("phase3", mockRunner);
      
      expect(report1.results.some((r) => r.name === "benchmark-runs")).toBe(true);
      expect(report2.results.some((r) => r.name === "e2e-scenario")).toBe(true);
      expect(report3.results.some((r) => r.name === "load-test")).toBe(true);
    });

    it("calculates duration correctly", () => {
      const report = runValidationPhase("phase1", mockRunner);
      
      const start = new Date(report.startedAt).getTime();
      const end = new Date(report.completedAt).getTime();
      expect(end).toBeGreaterThanOrEqual(start);
    });

    it("reports failures correctly", () => {
      const report = runValidationPhase("phase1", failingRunner);
      
      expect(report.passed).toBe(false);
      expect(report.summary.failed).toBeGreaterThan(0);
    });
  });

  describe("runFullValidation", () => {
    it("runs all three phases", () => {
      const reports = runFullValidation(mockRunner);
      
      expect(reports).toHaveLength(3);
      expect(reports[0]?.phase).toBe("phase1");
      expect(reports[1]?.phase).toBe("phase2");
      expect(reports[2]?.phase).toBe("phase3");
    });
  });
});
