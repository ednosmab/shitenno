import chalk from "chalk";
import { join } from "node:path";
import { resolveWithinRoot } from "../../domain/rules/path-safety.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../../infrastructure/session-feedback.js";
import { loadUserProfile, generatePersonalizedFeedback, formatFeedbackAsMarkdown } from "../../application/feedback-engine.js";
import { outputJson } from "../../shared/formatting.js";
import { output, outputBlank, outputSection, outputError, outputWarning } from "../../shared/output.js";

type Ctx = {
  projectRoot: string;
  shitennoDir: string;
};

export async function handlePersonalizedMode(ctx: Ctx, isJson: boolean): Promise<void> {
  const records = getFeedbackRecords(ctx.shitennoDir);
  const latestRecord = records.at(-1);

  if (!latestRecord) {
    if (isJson) {
      outputJson({
        error: "no_feedback",
        message: "No feedback records found. Run 'shugo feedback --outcome <type>' first.",
      });
    } else {
      outputError("No feedback records found.");
      output(chalk.gray("    Run 'shugo feedback --outcome <type>' first."));
    }
    return;
  }

  const profile = loadUserProfile(ctx.shitennoDir);
  const feedback = generatePersonalizedFeedback(latestRecord, profile);
  const markdown = formatFeedbackAsMarkdown(feedback);

  if (isJson) {
    outputJson({ type: "personalized_feedback", ...feedback });
  } else {
    output("");
    output(markdown);
    outputBlank();
  }

  const { existsSync, mkdirSync } = await import("node:fs");
  const feedbackDir = join(ctx.shitennoDir, "docs", "feedback");
  if (!existsSync(feedbackDir)) {
    mkdirSync(feedbackDir, { recursive: true });
  }

  let feedbackPath: string;
  try {
    feedbackPath = resolveWithinRoot(feedbackDir, `${feedback.date}.md`);
  } catch {
    feedbackPath = join(feedbackDir, `${feedback.date}.md`);
  }
  const { writeFileSync, appendFileSync } = await import("node:fs");

  if (existsSync(feedbackPath)) {
    appendFileSync(feedbackPath, "\n\n" + markdown + "\n", "utf-8");
  } else {
    writeFileSync(feedbackPath, markdown + "\n", "utf-8");
  }
}

export function handleListMode(ctx: Ctx, isJson: boolean): void {
  const records = getFeedbackRecords(ctx.shitennoDir);

  if (records.length === 0) {
    if (isJson) {
      outputJson({ type: "feedback_list", records: [] });
    } else {
      outputWarning("No feedback records found.");
      output(chalk.gray("  Run 'shugo feedback --outcome <type>' to record feedback."));
    }
    return;
  }

  if (isJson) {
    outputJson({ type: "feedback_list", records });
    return;
  }

  output("");
  outputSection("shugo feedback — Session History");
  outputBlank();

  for (const record of records.slice(-20)) {
    const icon = record.outcome === "success" ? "✅" : record.outcome === "failure" ? "❌" : "⚠️";
    const color = record.outcome === "success" ? chalk.green : record.outcome === "failure" ? chalk.red : chalk.yellow;
    const date = new Date(record.timestamp).toLocaleDateString();
    const time = new Date(record.timestamp).toLocaleTimeString();

    output(`  ${icon} ${color(record.outcome.padEnd(8))} ${chalk.gray(`${date} ${time}`)}`);
    if (record.notes) output(chalk.gray(`     Notes: ${record.notes}`));
    if (record.modifiedAreas?.length) output(chalk.gray(`     Areas: ${record.modifiedAreas.join(", ")}`));
    if (record.userRating) output(chalk.gray(`     Rating: ${record.userRating}/5`));
  }

  outputBlank();
  output(chalk.gray(`  Showing last ${Math.min(records.length, 20)} of ${records.length} records`));
  outputBlank();
}

export function handleSummaryMode(ctx: Ctx, isJson: boolean): void {
  const records = getFeedbackRecords(ctx.shitennoDir);
  const summary = computeFeedbackSummary(records);

  if (isJson) {
    outputJson({ type: "summary", ...summary });
    return;
  }

  output("");
  outputSection("shugo feedback — Session Summary");
  outputBlank();
  outputSection("Statistics");
  output(`     Total sessions: ${chalk.cyan(String(summary.totalSessions))}`);
  output(`     Success rate:   ${chalk.cyan(`${Math.round(summary.successRate * 100)}%`)}`);
  output(`     Success:        ${chalk.green(String(summary.byOutcome.success))}`);
  output(`     Failure:        ${chalk.red(String(summary.byOutcome.failure))}`);
  output(`     Partial:        ${chalk.yellow(String(summary.byOutcome.partial))}`);

  if (summary.avgSuccessDuration !== null) {
    output(`     Avg duration:   ${chalk.cyan(`${summary.avgSuccessDuration}min`)}`);
  }

  if (summary.avgUserRating !== null) {
    output(`     Avg rating:     ${chalk.cyan(`${summary.avgUserRating}/5`)} (${summary.ratedSessions} rated)`);
  }

  if (summary.failureHotspots.length > 0) {
    outputBlank();
    outputSection("Failure Hotspots");
    for (const area of summary.failureHotspots) {
      output(chalk.red(`     • ${area}`));
    }
  }

  outputBlank();
}

export function showFailureHotspots(shitennoDir: string): void {
  try {
    const records = getFeedbackRecords(shitennoDir);
    if (records.length <= 1) return;
    const summary = computeFeedbackSummary(records);
    if (summary.failureHotspots.length === 0) return;
    outputBlank();
    outputSection("Failure hotspots from past sessions:");
    for (const area of summary.failureHotspots.slice(0, 5)) {
      output(chalk.red(`     • ${area}`));
    }
    output(chalk.gray("     Tip: use --areas to specify which areas were affected."));
  } catch {
    // Non-blocking: ignore if feedback data unavailable
  }
}

export function outputRecordedFeedback(
  outcome: string,
  shitennoDir: string,
  data: { recordId: string; notes?: unknown; modifiedAreas?: string[]; userRating?: number; userComment?: string; userTags?: string[] }
): void {
  const icon = outcome === "success" ? "✅" : outcome === "failure" ? "❌" : "⚠️";
  const color = outcome === "success" ? chalk.green : outcome === "failure" ? chalk.red : chalk.yellow;

  output("");
  output(`${icon} ${color(`Session outcome: ${outcome}`)}`);
  if (data.userRating) output(chalk.gray(`   Rating: ${data.userRating}/5`));
  if (data.userComment) output(chalk.gray(`   Comment: ${data.userComment}`));
  if (data.userTags && data.userTags.length > 0) output(chalk.gray(`   Tags: ${data.userTags.join(", ")}`));
  if (data.modifiedAreas && data.modifiedAreas.length > 0) output(chalk.gray(`   Areas: ${data.modifiedAreas.join(", ")}`));
  if (data.notes) output(chalk.gray(`   Notes: ${data.notes}`));
  output(chalk.gray(`   Recorded: ${data.recordId}`));

  if (outcome === "failure" && (!data.modifiedAreas || data.modifiedAreas.length === 0)) {
    showFailureHotspots(shitennoDir);
  }
  outputBlank();
}
