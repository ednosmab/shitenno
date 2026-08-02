/**
 * challenge-responder/actions.ts — Challenge type normalization and action mapping
 */

export type ChallengeType =
  | "next_step"
  | "plan_completed"
  | "drift_detected"
  | "health_dip"
  | "knowledge_debt"
  | "unknown";

export type ChallengeSeverity = "high" | "medium" | "low";

export function getSuggestedActions(type: ChallengeType, severity: ChallengeSeverity): string[] {
  const actionsByType: Record<ChallengeType, string[]> = {
    plan_completed: ["Run health audit", "Start next P0", "Dismiss"],
    drift_detected: ["Review changes", "Commit now", "Dismiss"],
    health_dip: ["Run doctor", "Dismiss"],
    knowledge_debt: ["Review debt items", "Create ADR", "Dismiss"],
    next_step: ["View recommendations", "Dismiss"],
    unknown: ["Acknowledge", "Dismiss"],
  };

  const actions = actionsByType[type] ?? actionsByType.unknown;
  if (severity === "high") return ["Take action now", ...actions];
  return actions;
}

export function normalizeChallengeType(rawType: string): ChallengeType {
  const validTypes: ChallengeType[] = [
    "next_step", "plan_completed", "drift_detected",
    "health_dip", "knowledge_debt",
  ];
  if (validTypes.includes(rawType as ChallengeType)) return rawType as ChallengeType;
  return "unknown";
}

export function normalizeSeverity(raw: string): ChallengeSeverity {
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  return "medium";
}

/**
 * Map action names to executable shell commands.
 */
export function getActionCommand(action: string): string | null {
  const commandMap: Record<string, string> = {
    "Run health audit": "shugo audit",
    "Run doctor": "shugo doctor",
    "Start next P0": "shugo backlog list --priority P0",
    "View recommendations": "shugo briefing --profile full",
    "Review changes": "git status",
    "Commit now": "git add -A && git commit",
    "Review debt items": "shugo debt list",
    "Create ADR": "shugo adr create",
    "Take action now": "shugo briefing --profile full",
  };
  return commandMap[action] ?? null;
}
