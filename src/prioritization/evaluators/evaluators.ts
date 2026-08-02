/**
 * evaluators.ts — Specialized evaluator implementations.
 */

import type { DecisionRequest, EvaluatorScore, RiskLevel } from "./types.js";

export interface Evaluator {
  name: string;
  weight: number;
  evaluate(request: DecisionRequest): EvaluatorScore | Promise<EvaluatorScore>;
}

export class GoalEvaluator implements Evaluator {
  name = "goal";
  weight = 1.5;

  private goals: Array<{ id: string; status: string; targets: string[] }>;

  constructor(goals: Array<{ id: string; status: string; targets: string[] }>) {
    this.goals = goals;
  }

  evaluate(request: DecisionRequest): EvaluatorScore {
    if (!request.targetGoalId) {
      return {
        evaluator: this.name,
        score: 50,
        reasoning: "No target goal specified — neutral score",
      };
    }

    const goal = this.goals.find((g) => g.id === request.targetGoalId);
    if (!goal) {
      return {
        evaluator: this.name,
        score: 20,
        reasoning: `Target goal ${request.targetGoalId} not found`,
        concerns: ["Action targets a non-existent goal"],
      };
    }

    if (goal.status === "completed") {
      return {
        evaluator: this.name,
        score: 30,
        reasoning: `Target goal ${goal.id} is already completed`,
        concerns: ["Action may be redundant"],
      };
    }

    if (goal.status === "abandoned") {
      return {
        evaluator: this.name,
        score: 10,
        reasoning: `Target goal ${goal.id} is abandoned`,
        concerns: ["Action targets an abandoned goal"],
      };
    }

    return {
      evaluator: this.name,
      score: 80,
      reasoning: `Action aligns with active goal ${goal.id}`,
    };
  }
}

export class RiskEvaluator implements Evaluator {
  name = "risk";
  weight = 1.2;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const riskLevel = (request.context.riskLevel as RiskLevel) ?? "medium";
    const riskScores: Record<RiskLevel, number> = {
      low: 85,
      medium: 60,
      high: 30,
      critical: 10,
    };

    const score = riskScores[riskLevel];
    const concerns: string[] = [];
    const mitigations: string[] = [];

    if (riskLevel === "high" || riskLevel === "critical") {
      concerns.push(`High risk action (${riskLevel})`);
      mitigations.push("Consider staged rollout");
      mitigations.push("Add monitoring and rollback plan");
    }

    return {
      evaluator: this.name,
      score,
      reasoning: `Risk level: ${riskLevel}`,
      concerns: concerns.length > 0 ? concerns : undefined,
      mitigations: mitigations.length > 0 ? mitigations : undefined,
    };
  }
}

export class ImpactEvaluator implements Evaluator {
  name = "impact";
  weight = 1.0;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const impact = (request.context.impact as string) ?? "medium";
    const impactScores: Record<string, number> = {
      minimal: 40,
      low: 55,
      medium: 70,
      high: 85,
      critical: 95,
    };

    const score = impactScores[impact] ?? 50;

    return {
      evaluator: this.name,
      score,
      reasoning: `Expected impact: ${impact}`,
    };
  }
}

export class ConfidenceEvaluator implements Evaluator {
  name = "confidence";
  weight = 0.8;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const hasContext = Object.keys(request.context).length > 0;
    const hasGoal = !!request.targetGoalId;
    const hasDescription = request.action.length > 10;

    let score = 40;
    if (hasContext) score += 20;
    if (hasGoal) score += 20;
    if (hasDescription) score += 20;

    const concerns: string[] = [];
    if (!hasContext) concerns.push("No context provided");
    if (!hasGoal) concerns.push("No target goal specified");

    return {
      evaluator: this.name,
      score: Math.min(100, score),
      reasoning: `Confidence based on: context=${hasContext}, goal=${hasGoal}, description=${hasDescription}`,
      concerns: concerns.length > 0 ? concerns : undefined,
    };
  }
}

export class DebtEvaluator implements Evaluator {
  name = "debt";
  weight = 0.9;

  evaluate(request: DecisionRequest): EvaluatorScore {
    const introducesDebt = (request.context.introducesDebt as boolean) ?? false;
    const debtSeverity = (request.context.debtSeverity as string) ?? "none";

    if (!introducesDebt) {
      return {
        evaluator: this.name,
        score: 85,
        reasoning: "No technical debt introduced",
      };
    }

    const severityScores: Record<string, number> = {
      none: 85,
      low: 65,
      medium: 40,
      high: 20,
    };

    const score = severityScores[debtSeverity] ?? 50;

    return {
      evaluator: this.name,
      score,
      reasoning: `Introduces ${debtSeverity} technical debt`,
      concerns: [`Technical debt: ${debtSeverity}`],
      mitigations: ["Create follow-up task to address debt"],
    };
  }
}
