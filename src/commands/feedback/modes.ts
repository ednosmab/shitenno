import chalk from "chalk";
import { join } from "node:path";
import { resolveWithinRoot } from "../../path-safety.js";
import { outputJson } from "../../formatting.js";
import { getFeedbackRecords, computeFeedbackSummary } from "../../session-feedback.js";
import {
  loadUserProfile,
  generatePersonalizedFeedback,
  formatFeedbackAsMarkdown,
} from "../../feedback-engine.js";
import { output, outputBlank, outputSection, outputError, outputWarning } from "../../output.js";

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

export function validateOutcome(outcome: string | undefined, isJson: boolean): boolean {
  if (outcome && ["success", "failure", "partial", "session-start", "session-end"].includes(outcome)) {
    return true;
  }
  if (isJson) {
    outputJson({
      error: "invalid_outcome",
      message: "Provide --outcome with one of: success, failure, partial, session-start, session-end",
    });
  } else {
    outputError("Provide --outcome with one of: success, failure, partial, session-start, session-end");
    output(chalk.gray("    Example: shugo feedback --outcome success"));
    output(chalk.gray("    Example: shugo feedback --outcome failure --notes 'Build broke'"));
  }
  return false;
}
