/**
 * pipeline.ts — Validation Pipeline Command
 *
 * The `shugo pipeline` command. Runs phase-based validation with common gates.
 */

import { Command } from "commander";
import { outputJson, banner } from "../formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { outputBlank } from "../output.js";
import { muteLogs } from "../logger.js";
import {
  runValidationPhase,
  runFullValidation,
  getPhaseConfig,
  type ValidationPhase,
  type ValidationReport,
} from "../validation-pipeline.js";

// ── Display ────────────────────────────────────────────────────────────────

function displayPhaseReport(report: ValidationReport, isJson: boolean): void {
  if (isJson) {
    outputJson(report as unknown as Record<string, unknown>);
    return;
  }

  const config = getPhaseConfig(report.phase);
  const status = report.passed ? "✅ PASSED" : "❌ FAILED";

  console.log(`\n${config.name}`);
  console.log(`${config.description}`);
  console.log(`Status: ${status}`);
  console.log(`Duration: ${report.completedAt}`);
  console.log(`Results: ${report.summary.passed}/${report.summary.total} passed`);

  for (const result of report.results) {
    const icon = result.passed ? "✓" : "✗";
    const gate = result.gate === "common" ? "[common]" : "[phase]";
    console.log(`  ${icon} ${gate} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`    Error: ${result.error.slice(0, 100)}`);
    }
  }
}

// ── Command ────────────────────────────────────────────────────────────────

export const pipelineCommand = new Command("pipeline")
  .description("Run phase-based validation pipeline")
  .option("-d, --dir <path>", "Project root directory (default: current)")
  .option("-p, --phase <phase>", "Run specific phase (phase1, phase2, phase3)")
  .option("--full", "Run all phases")
  .option("--json", "Output results as JSON")
  .action(async (options) => {
    const isJson = options.json === true;
    if (isJson) muteLogs();

    if (!isJson) {
      outputBlank();
      banner("shugo pipeline", "Validation Pipeline");
      outputBlank();
    }

    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;

    void printDaemonBanner(ctx.shitennoDir, isJson);

    if (!checkLifecycleGate("pipeline", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

    const bus = getEventBus();

    if (options.full) {
      // Run all phases
      const reports = runFullValidation();
      
      for (const report of reports) {
        displayPhaseReport(report, isJson);
        
        bus.publish("pipeline.complete", {
          stage: report.phase,
          duration: new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime(),
          status: report.passed ? "success" : "failed",
          timestamp: new Date().toISOString(),
        });
      }

      const allPassed = reports.every((r) => r.passed);
      if (!isJson) {
        console.log(`\n${allPassed ? "✅ All phases passed" : "❌ Some phases failed"}`);
      }
    } else if (options.phase) {
      // Run specific phase
      const phase = options.phase as ValidationPhase;
      const config = getPhaseConfig(phase);
      
      if (!config) {
        console.error(`Invalid phase: ${phase}. Valid phases: phase1, phase2, phase3`);
        return;
      }

      const report = runValidationPhase(phase);
      displayPhaseReport(report, isJson);

      bus.publish("pipeline.complete", {
        stage: report.phase,
        duration: new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime(),
        status: report.passed ? "success" : "failed",
        timestamp: new Date().toISOString(),
      });
    } else {
      // Default: run phase1
      const report = runValidationPhase("phase1");
      displayPhaseReport(report, isJson);

      bus.publish("pipeline.complete", {
        stage: report.phase,
        duration: new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime(),
        status: report.passed ? "success" : "failed",
        timestamp: new Date().toISOString(),
      });
    }
  });
