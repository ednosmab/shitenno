import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldShitenno } from "../infrastructure/scaffolder.js";
import type { UserAnswers } from "../interface/cli/prompts.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-answers-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

const DEFAULT_MATURITY = {
  usedShitennoBefore: false,
  isFirstProject: false,
  projectAge: "new" as const,
  teamSize: "solo" as const,
  hasDedicatedTeam: false,
  hasArchitectureDocs: false,
  hasADRs: false,
  hasTechnicalReviews: false,
  hasCICD: false,
  hasAutomatedTests: false,
  hasValidationPipeline: false,
  intendsToUseAI: false,
  aiWillImplement: false,
  requiresHumanReview: false,
  hasDefinedPatterns: false,
  hasReviewProcess: false,
  hasDecisionControl: false,
};

function makeAnswers(overrides: Partial<UserAnswers> = {}): UserAnswers {
  return {
    principalModel: "opencode/mimo-v2.5-free",
    executorModel: "opencode/deepseek-v4-flash-free",
    stack: ["react", "nextjs"],
    database: "PostgreSQL",
    styling: "Tailwind CSS",
    maturity: { ...DEFAULT_MATURITY },
    ...overrides,
  };
}

describe("scaffoldShitenno with answers file (Bug 5 regression)", () => {
  it("does not throw when all required fields are provided", () => {
    const answers = makeAnswers();
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });

  it("does not throw when stack is a non-empty array", () => {
    const answers = makeAnswers({ stack: ["typescript"] });
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });

  it("does not throw when stack is an empty array", () => {
    const answers = makeAnswers({ stack: [] });
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });

  it("does not throw when optional fields are missing", () => {
    const answers: UserAnswers = {
      principalModel: "test-model",
      executorModel: "test-model",
      stack: ["typescript"],
      database: "postgresql",
      styling: "tailwind",
      maturity: DEFAULT_MATURITY,
    };
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });

  it("does not throw when database is empty string", () => {
    const answers = makeAnswers({ database: "" });
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });

  it("does not throw when styling is empty string", () => {
    const answers = makeAnswers({ styling: "" });
    expect(() => scaffoldShitenno(tempDir, answers, ["core"])).not.toThrow();
  });
});
