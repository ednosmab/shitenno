/**
 * feedback.ts — Context Pipeline: Feedback CLI Command
 *
 * The `shugo feedback` command. Lets AI agents report session outcomes.
 */

import { Command } from "commander";
import chalk from "chalk";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { recordOutcome, createFileStorage, type SessionOutcome } from "../session-feedback.js";
import { printDaemonBanner } from "../daemon-context-banner.js";
import { trackFeedback } from "../session-tracker.js";
import { getSessionId } from "../session-context.js";
import { outputJson } from "../formatting.js";
import { getEventBus } from "../event-bus.js";
import { readCache } from "../briefing-cache.js";
import { updateProfileFromSession, saveUserProfile } from "../feedback-engine.js";
import { parseUserRating, parseUserTags } from "../feedback-utils.js";
import { output, outputError } from "../output.js";
import { handlePersonalizedMode, handleListMode, handleSummaryMode, outputRecordedFeedback } from "./feedback/display.js";

type Options = Record<string, unknown>;

type Ctx = {
  projectRoot: string;
  shitennoDir: string;
};

function validateOutcome(outcome: string | undefined, isJson: boolean): boolean {
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

function parseOptions(options: Options) {
  const modifiedAreas = options.areas
    ? String(options.areas).split(",").map((a: string) => a.trim()).filter(Boolean)
    : undefined;

  const durationMinutes = options.duration ? parseInt(String(options.duration), 10) : undefined;

  return {
    modifiedAreas,
    durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : undefined,
    userTags: parseUserTags(options["user-tags"] as string | undefined),
    userRating: parseUserRating(options["user-rating"] as string | undefined),
    userComment: options["user-comment"] ? String(options["user-comment"]) : undefined,
    sessionId: options["session-id"] ? String(options["session-id"]) : undefined,
    notes: options.notes ? String(options.notes) : undefined,
    briefingProfile: options.profile ? String(options.profile) : undefined,
  };
}

function recordFeedback(ctx: Ctx, options: Options, isJson: boolean): void {
  const outcome = options.outcome as string | undefined;
  if (!validateOutcome(outcome, isJson)) return;

  const { modifiedAreas, durationMinutes, userTags, userRating, userComment, sessionId, notes, briefingProfile } = parseOptions(options);

  const cache = readCache(ctx.shitennoDir);
  const storage = createFileStorage(ctx.shitennoDir);
  const record = recordOutcome(storage, {
    outcome: outcome as SessionOutcome,
    briefingHash: cache?.entry?.inputHash ?? "",
    briefingTimestamp: cache?.entry?.computedAt ?? "",
    modifiedAreas,
    notes,
    durationMinutes,
    sessionId,
    userRating: userRating as 1 | 2 | 3 | 4 | 5 | undefined,
    userComment,
    userTags,
    briefingProfile,
  });

  const updatedProfile = updateProfileFromSession(ctx.shitennoDir, record.outcome, true, record.durationMinutes);
  saveUserProfile(ctx.shitennoDir, updatedProfile);

  if (isJson) {
    outputJson({ type: "feedback_recorded", id: record.id, outcome: record.outcome, timestamp: record.timestamp });
    return;
  }

  outputRecordedFeedback(outcome!, ctx.shitennoDir, {
    recordId: record.id,
    notes,
    modifiedAreas,
    userRating: userRating as number | undefined,
    userComment,
    userTags,
  });

  const finalSessionId = sessionId || getSessionId();
  if (finalSessionId) {
    trackFeedback(ctx.shitennoDir, finalSessionId, outcome as "accepted" | "rejected" | "deferred");
  }

  const eventType = outcome === "success" ? "recommendation.accepted" : "recommendation.rejected";
  getEventBus().publish(eventType, { type: "session_feedback", outcome, areas: modifiedAreas, sessionId: finalSessionId });
}

// ── Command ────────────────────────────────────────────────────────────────

export function feedbackCommand(): Command {
  const cmd = new Command("feedback")
    .description("Report session outcome for the Context Pipeline feedback loop")
    .option("-d, --dir <path>", "Project directory")
    .option("--outcome <type>", "Session outcome: success, failure, partial, session-start, session-end")
    .option("--areas <list>", "Comma-separated list of modified areas (e.g. src/auth,src/payments)")
    .option("--notes <text>", "Optional notes about the session")
    .option("--duration <minutes>", "Session duration in minutes")
    .option("--session-id <id>", "Link feedback to a session-tracker session")
    .option("--user-rating <1-5>", "User rating for the session (1-5)")
    .option("--user-comment <text>", "User comment about the session")
    .option("--user-tags <list>", "Comma-separated user tags for categorization")
    .option("--profile <depth>", "Briefing depth profile used (minimal/standard/full)")
    .option("--json", "Output as JSON")
    .option("--summary", "Show feedback summary statistics")
    .option("--list", "List all feedback records")
    .option("--personalized", "Generate personalized feedback based on user profile")
    .action(async function (this: Command, options: Options) {
      const isJson = options.json === true;
      const ctx = guardNotInitialized(options, isJson);
      if (!ctx) return;

      void printDaemonBanner(ctx.shitennoDir, isJson);
      if (!checkLifecycleGate("feedback", ctx.projectRoot, ctx.shitennoDir, isJson)) return;

      if (options.personalized) await handlePersonalizedMode(ctx, isJson);
      else if (options.list) handleListMode(ctx, isJson);
      else if (options.summary) handleSummaryMode(ctx, isJson);
      else recordFeedback(ctx, options, isJson);
    });

  return cmd;
}
