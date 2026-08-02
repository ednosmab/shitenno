import chalk from "chalk";
import { getCached, computeKeyChecksums } from "../../cache.js";
import { outputJson } from "../../formatting.js";
import { recordFeedback } from "../../feedback-loops.js";
import { output, outputBlank, outputError } from "../../output.js";
import type { PatternDetectionReport } from "../../pattern-detector.js";

export function handleApproveReject(
  options: { approve?: string; reject?: string },
  isJson: boolean,
  projectRoot: string,
  shitennoDir: string,
): boolean {
  if (!options.approve && !options.reject) return false;
  const ruleId = options.approve || options.reject!;
  const action = options.approve ? "approve" : "reject";
  const cached = getCached<PatternDetectionReport>({ projectRoot, key: "patterns",
    computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
  if (!cached) {
    if (isJson) {
      outputJson({ error: "no_report", message: "No detection report found. Run 'shugo detect' first." });
    } else {
      outputError("No detection report found.");
      output(chalk.gray("    Run 'shugo detect' first."));
    }
    return true;
  }
  const rule = cached.candidateRules.find((r) => r.id === ruleId);
  if (!rule) {
    if (isJson) {
      outputJson({ error: "rule_not_found", message: `Rule '${ruleId}' not found in candidate rules.` });
    } else {
      outputError(`Rule '${ruleId}' not found.`);
      output(chalk.gray("    Available rules:"));
      for (const r of cached.candidateRules) {
        output(chalk.gray(`      • ${r.id}: ${r.title}`));
      }
    }
    return true;
  }
  recordFeedback(shitennoDir, { recommendationId: `rule-${ruleId}`, action: action === "approve" ? "accepted" : "rejected", context: { maturityScore: 0, installedCapabilities: [], knowledgeDebt: 0 } });
  if (isJson) {
    outputJson({ type: "rule_decision", ruleId, action, rule });
  } else {
    const icon = action === "approve" ? "✅" : "❌";
    const color = action === "approve" ? chalk.green : chalk.red;
    output("");
    output(`${icon} ${color(`Rule ${ruleId} ${action}d`)}`);
    output(chalk.gray(`   Title: ${rule.title}`));
    output(chalk.gray(`   Target: ${rule.target}`));
    outputBlank();
  }
  return true;
}

export function recordCandidateRuleFeedback(_report: PatternDetectionReport, _shitennoDir: string): void {
  // Don't record automatic deferred feedback for candidate rules
  // Rules should only be recorded when the user explicitly approves/rejects them
  // via `shugo detect --approve <ruleId>` or `shugo detect --reject <ruleId>`
}
