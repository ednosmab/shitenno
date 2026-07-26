import chalk from "chalk";
import { output, outputBlank } from "../../output.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../../session-feedback.js";

interface FeedbackData {
  recordId: string;
  outcome: string;
  notes?: unknown;
  modifiedAreas?: string[];
  userRating?: number;
  userComment?: string;
  userTags?: string[];
}

export function outputRecordedFeedback(outcome: string, shitennoDir: string, data: FeedbackData): void {
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

export function showFailureHotspots(shitennoDir: string): void {
  try {
    const records = getFeedbackRecords(shitennoDir);
    if (records.length <= 1) return;
    const summary = computeFeedbackSummary(records);
    if (summary.failureHotspots.length === 0) return;
    outputBlank();
    output(chalk.bold("  Failure hotspots from past sessions:"));
    for (const area of summary.failureHotspots.slice(0, 5)) {
      output(chalk.red(`     • ${area}`));
    }
    output(chalk.gray("     Tip: use --areas to specify which areas were affected."));
  } catch {
    // Non-blocking: ignore if feedback data unavailable
  }
}
