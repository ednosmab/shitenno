/**
 * pipeline.ts — Validation Pipeline Command
 *
 * The `shugo pipeline` command. Runs phase-based validation with common gates.
 * Subcommands: `exec` (run + persist + shell exit code), `status` (latest run),
 * `notify` (desktop notification of the latest run result).
 */

import { Command } from "commander";
import { outputJson, banner } from "../shared/formatting.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared/shared.js";
import { getEventBus } from "../infrastructure/event-bus.js";
import { printDaemonBanner } from "../interface/cli/daemon-context-banner.js";
import { outputBlank, output, outputError } from "../shared/output.js";
import { muteLogs } from "../shared/logger.js";
import {
  runValidationPhase,
  runFullValidation,
  getPhaseConfig,
  type ValidationPhase,
  type ValidationReport,
} from "../infrastructure/validation-pipeline.js";
import { runPipelineExec, loadLatestPipelineReport } from "../infrastructure/pipeline-runner.js";
import { sendDesktopNotification } from "../infrastructure/notify.js";

// ── Display ────────────────────────────────────────────────────────────────

function displayPhaseReport(report: ValidationReport, isJson: boolean): void {
  if (isJson) {
    outputJson(report as unknown as Record<string, unknown>);
    return;
  }

  const config = getPhaseConfig(report.phase);
  const status = report.passed ? "✅ PASSED" : "❌ FAILED";

  output(`\n${config.name}`);
  output(`${config.description}`);
  output(`Status: ${status}`);
  output(`Duration: ${report.completedAt}`);
  output(`Results: ${report.summary.passed}/${report.summary.total} passed`);

  for (const result of report.results) {
    const icon = result.passed ? "✓" : "✗";
    const gate = result.gate === "common" ? "[common]" : "[phase]";
    output(`  ${icon} ${gate} ${result.name} (${result.duration}ms)`);
    if (result.error) {
      output(`    Error: ${result.error.slice(0, 100)}`);
    }
  }
}

// ── Action ──────────────────────────────────────────────────────────────────

function publishComplete(bus: ReturnType<typeof getEventBus>, report: ValidationReport): void {
  bus.publish("pipeline.complete", {
    stage: report.phase,
    duration: new Date(report.completedAt).getTime() - new Date(report.startedAt).getTime(),
    status: report.passed ? "success" : "failed",
    timestamp: new Date().toISOString(),
  });
}

function runSinglePhase(phase: ValidationPhase, isJson: boolean, bus: ReturnType<typeof getEventBus>): void {
  const report = runValidationPhase(phase);
  displayPhaseReport(report, isJson);
  publishComplete(bus, report);
}

async function runPipeline(options: { json?: boolean; full?: boolean; phase?: string; dir?: string }): Promise<void> {
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
    const reports = runFullValidation();
    for (const report of reports) {
      displayPhaseReport(report, isJson);
      publishComplete(bus, report);
    }
    const allPassed = reports.every((r) => r.passed);
    if (!isJson) {
      output(`\n${allPassed ? "✅ All phases passed" : "❌ Some phases failed"}`);
    }
    return;
  }

  if (options.phase) {
    const phase = options.phase as ValidationPhase;
    const config = getPhaseConfig(phase);
    if (!config) {
      outputError(`Invalid phase: ${phase}. Valid phases: phase1, phase2, phase3`);
      return;
    }
    runSinglePhase(phase, isJson, bus);
    return;
  }

  runSinglePhase("phase1", isJson, bus);
}

// ── Subcommand: exec ────────────────────────────────────────────────────────

function runExec(_options: { dir?: string; phase?: string; json?: boolean }, command: Command): void {
  const merged = command.optsWithGlobals() as { dir?: string; phase?: string; json?: boolean };
  const isJson = merged.json === true;
  if (isJson) muteLogs();

  const ctx = guardNotInitialized(merged, isJson);
  if (!ctx) return;

  if (!checkLifecycleGate("pipeline", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

  const { reports, allPassed } = runPipelineExec(ctx.shitennoDir, { phase: merged.phase });
  const bus = getEventBus();
  for (const report of reports) {
    publishComplete(bus, report);
  }

  if (isJson) {
    outputJson({ allPassed, reports } as unknown as Record<string, unknown>);
  } else {
    for (const report of reports) {
      displayPhaseReport(report, false);
    }
    output(`\n${allPassed ? "✅ All phases passed" : "❌ Some phases failed"}`);
  }

  process.exitCode = allPassed ? 0 : 1;
}

// ── Subcommand: status ──────────────────────────────────────────────────────

function runStatus(_options: { dir?: string; json?: boolean }, command: Command): void {
  const merged = command.optsWithGlobals() as { dir?: string; json?: boolean };
  const isJson = merged.json === true;

  const ctx = guardNotInitialized(merged, isJson);
  if (!ctx) return;

  const latest = loadLatestPipelineReport(ctx.shitennoDir);

  if (isJson) {
    outputJson((latest ?? null) as unknown as Record<string, unknown>);
    return;
  }

  if (!latest) {
    output("No pipeline runs recorded yet. Run 'shugo pipeline exec' first.");
    return;
  }

  const config = getPhaseConfig(latest.report.phase);
  const status = latest.report.passed ? "✅ PASSED" : "❌ FAILED";
  output(`\nLast pipeline run: ${latest.timestamp}`);
  output(`${config.name} — ${status}`);
  output(`Results: ${latest.report.summary.passed}/${latest.report.summary.total} passed`);
  for (const result of latest.report.results) {
    const icon = result.passed ? "✓" : "✗";
    output(`  ${icon} ${result.gate} ${result.name} (${result.duration}ms)`);
  }
}

// ── Subcommand: notify ──────────────────────────────────────────────────────

function runNotify(_options: { dir?: string; json?: boolean }, command: Command): void {
  const merged = command.optsWithGlobals() as { dir?: string; json?: boolean };
  const isJson = merged.json === true;

  const ctx = guardNotInitialized(merged, isJson);
  if (!ctx) return;

  const latest = loadLatestPipelineReport(ctx.shitennoDir);

  if (!latest) {
    if (isJson) {
      outputJson({ error: "no_runs", message: "No pipeline runs recorded yet" });
    } else {
      output("No pipeline runs recorded yet. Run 'shugo pipeline exec' first.");
    }
    return;
  }

  const config = getPhaseConfig(latest.report.phase);
  const title = latest.report.passed ? "✅ Pipeline Passed" : "❌ Pipeline Failed";
  const message = `${config.name}: ${latest.report.summary.passed}/${latest.report.summary.total} gates passed`;

  if (isJson) {
    outputJson({ title, message, phase: latest.report.phase } as unknown as Record<string, unknown>);
    return;
  }

  sendDesktopNotification(ctx.shitennoDir, title, message, latest.report.passed ? "low" : "high");
  output(`Notification sent: ${title} — ${message}`);
}

// ── Command ────────────────────────────────────────────────────────────────

export function createPipelineCommand(): Command {
  const cmd = new Command("pipeline")
    .description("Run phase-based validation pipeline")
    .option("-d, --dir <path>", "Project root directory (default: current)")
    .option("-p, --phase <phase>", "Run specific phase (phase1, phase2, phase3)")
    .option("--full", "Run all phases")
    .option("--json", "Output results as JSON")
    .action(runPipeline);

  cmd
    .command("exec")
    .description("Run the pipeline and exit with 0/1 for shell chaining")
    .action(runExec);

  cmd
    .command("status")
    .description("Show the latest pipeline run state")
    .action(runStatus);

  cmd
    .command("notify")
    .description("Send a desktop notification with the latest run result")
    .action(runNotify);

  return cmd;
}

export const pipelineCommand = createPipelineCommand();
