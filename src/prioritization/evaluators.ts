/**
 * decision-engine.ts — Decision Engine with Specialized Evaluators
 *
 * Evaluates proposed actions using multiple specialized evaluators.
 * Each evaluator scores on a specific dimension (goal alignment, risk, impact, etc.).
 * The engine combines scores into a final decision with confidence.
 *
 * Architecture: Evaluators → DecisionEngine → Decision Record
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { DecisionRequest, EvaluatorScore, Decision, DecisionFilter, DecisionRecommendation } from "./evaluators/types.js";
import type { Evaluator } from "./evaluators/evaluators.js";
import { GoalEvaluator, RiskEvaluator, ImpactEvaluator, ConfidenceEvaluator, DebtEvaluator } from "./evaluators/evaluators.js";

export type { DecisionRecommendation, RiskLevel, DecisionRequest, EvaluatorScore, Decision, DecisionFilter } from "./evaluators/types.js";
export type { Evaluator } from "./evaluators/evaluators.js";
export { GoalEvaluator, RiskEvaluator, ImpactEvaluator, ConfidenceEvaluator, DebtEvaluator } from "./evaluators/evaluators.js";

export interface DecisionRepository {
  save(decision: Decision): void;
  findById(id: string): Decision | undefined;
  findAll(filter?: DecisionFilter): Decision[];
  count(filter?: DecisionFilter): number;
}

export class FileDecisionRepository implements DecisionRepository {
  private dir: string;

  constructor(shitennoDir: string) {
    this.dir = join(shitennoDir, "governance", "decisions");
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  save(decision: Decision): void {
    const filepath = join(this.dir, `${decision.id}.json`);
    writeFileSync(filepath, JSON.stringify(decision, null, 2), "utf-8");
  }

  findById(id: string): Decision | undefined {
    const filepath = join(this.dir, `${id}.json`);
    if (!existsSync(filepath)) return undefined;
    try {
      return JSON.parse(readFileSync(filepath, "utf-8")) as Decision;
    } catch {
      return undefined;
    }
  }

  findAll(filter?: DecisionFilter): Decision[] {
    if (!existsSync(this.dir)) return [];

    const files = readdirSync(this.dir).filter((f: string) => f.endsWith(".json"));
    const decisions: Decision[] = [];

    for (const file of files) {
      try {
        const decision = JSON.parse(readFileSync(join(this.dir, file), "utf-8")) as Decision;
        if (this.matchesFilter(decision, filter)) {
          decisions.push(decision);
        }
      } catch {
        // Skip corrupt files
      }
    }

    return decisions;
  }

  count(filter?: DecisionFilter): number {
    return this.findAll(filter).length;
  }

  private matchesFilter(decision: Decision, filter?: DecisionFilter): boolean {
    if (!filter) return true;
    if (filter.category && decision.request.category !== filter.category) return false;
    if (filter.recommendation && decision.recommendation !== filter.recommendation) return false;
    if (filter.since && decision.decidedAt < filter.since) return false;
    return true;
  }
}

export class DecisionEngine {
  private evaluators: Evaluator[];

  constructor(
    private repo: DecisionRepository,
    evaluators?: Evaluator[]
  ) {
    this.evaluators = evaluators ?? [
      new GoalEvaluator([]),
      new RiskEvaluator(),
      new ImpactEvaluator(),
      new ConfidenceEvaluator(),
      new DebtEvaluator(),
    ];
  }

  addEvaluator(evaluator: Evaluator): void {
    this.evaluators.push(evaluator);
  }

  evaluate(request: DecisionRequest): Promise<Decision> {
    return Promise.all(
      this.evaluators.map((e) => e.evaluate(request))
    ).then((scores) => {
      let totalWeight = 0;
      let weightedSum = 0;
      for (const score of scores) {
        const evaluator = this.evaluators.find((e) => e.name === score.evaluator);
        const weight = evaluator?.weight ?? 1.0;
        weightedSum += score.score * weight;
        totalWeight += weight;
      }
      const compositeScore = Math.round(weightedSum / totalWeight);
      const recommendation = this.computeRecommendation(compositeScore, scores);
      const confidence = this.computeConfidence(scores);

      const decision: Decision = {
        id: `DEC-${randomUUID().slice(0, 8).toUpperCase()}`,
        request,
        scores,
        compositeScore,
        recommendation,
        confidence,
        decidedAt: new Date().toISOString(),
      };

      return decision;
    });
  }

  decide(request: DecisionRequest): Promise<Decision> {
    return this.evaluate(request).then((decision) => {
      this.repo.save(decision);
      return decision;
    });
  }

  get(id: string): Decision | undefined {
    return this.repo.findById(id);
  }

  list(filter?: DecisionFilter): Decision[] {
    return this.repo.findAll(filter);
  }

  count(filter?: DecisionFilter): number {
    return this.repo.count(filter);
  }

  private computeRecommendation(
    compositeScore: number,
    scores: EvaluatorScore[]
  ): DecisionRecommendation {
    const hasCriticalConcerns = scores.some(
      (s) => s.concerns?.some((c) => c.toLowerCase().includes("critical"))
    );
    if (hasCriticalConcerns) return "block";

    const riskScore = scores.find((s) => s.evaluator === "risk");
    if (riskScore && riskScore.score < 20) return "block";

    if (compositeScore >= 75) return "proceed";
    if (compositeScore >= 50) return "proceed_with_caution";
    if (compositeScore >= 30) return "defer";
    return "block";
  }

  private computeConfidence(scores: EvaluatorScore[]): number {
    if (scores.length === 0) return 0;
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.abs(s.score - avgScore), 0) / scores.length;
    const confidence = Math.max(0, Math.min(100, 100 - variance));
    return Math.round(confidence);
  }
}
