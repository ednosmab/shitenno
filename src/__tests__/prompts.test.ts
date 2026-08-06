import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("inquirer", () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock("chalk", () => ({
  default: {
    bold: Object.assign((s: string) => s, {
      cyan: (s: string) => s,
      green: (s: string) => s,
      red: (s: string) => s,
    }),
    cyan: (s: string) => s,
    gray: (s: string) => s,
  },
}));

const mockPrompt = vi.fn();

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

function makeAnalysis(overrides: Record<string, any> = {}) {
  return {
    stack: ["react", "typescript"],
    hasTypeScript: true,
    hasTests: false,
    hasCI: false,
    hasLinter: false,
    hasFormatter: false,
    hasPreCommit: false,
    hasLockfile: false,
    fileCount: 50,
    lineCount: 5000,
    packageJson: { name: "test-project", dependencies: {} },
    ...overrides,
  } as any;
}

async function callAskQuestions() {
  const inquirer = (await import("inquirer")).default;
  mockPrompt.mockImplementation((questions: any[]) => {
    const answers: Record<string, any> = {};
    for (const q of questions) {
      if (q.type === "input") {
        answers[q.name] = q.default ?? "test-value";
      } else if (q.type === "list") {
        answers[q.name] = typeof q.choices[0] === "string"
          ? q.choices[0]
          : q.choices[0].value;
      } else if (q.type === "checkbox") {
        answers[q.name] = [];
      } else if (q.type === "confirm") {
        answers[q.name] = q.default ?? false;
      }
    }
    return Promise.resolve(answers);
  });
  vi.mocked(inquirer.prompt).mockImplementation(mockPrompt);

  const { askQuestions } = await import("../interface/cli/prompts.js");
  return askQuestions(makeAnalysis());
}

// ── askQuestions ───────────────────────────────────────────────────────────

describe("askQuestions", () => {
  it("returns a complete UserAnswers object", async () => {
    const result = await callAskQuestions();

    expect(result).toHaveProperty("principalModel");
    expect(result).toHaveProperty("executorModel");
    expect(result).toHaveProperty("stack");
    expect(result).toHaveProperty("database");
    expect(result).toHaveProperty("styling");
    expect(result).toHaveProperty("maturity");
    expect(result).toHaveProperty("enableMcpRegistration");
    expect(result).toHaveProperty("userProfile");
  });

  it("calls inquirer.prompt 10 times (10 blocks)", async () => {
    await callAskQuestions();
    expect(mockPrompt).toHaveBeenCalledTimes(10);
  });

  it("maps AI config answers correctly", async () => {
    const result = await callAskQuestions();
    expect(result.principalModel).toBe("opencode/mimo-v2.5-free");
    expect(result.executorModel).toBe("opencode/deepseek-v4-flash-free");
  });

  it("maps stack config answers correctly", async () => {
    const result = await callAskQuestions();
    expect(Array.isArray(result.stack)).toBe(true);
    expect(typeof result.database).toBe("string");
    expect(typeof result.styling).toBe("string");
  });

  it("maps maturity answers from all blocks", async () => {
    const result = await callAskQuestions();
    const m = result.maturity;
    expect(m).toHaveProperty("usedShitennoBefore");
    expect(m).toHaveProperty("isFirstProject");
    expect(m).toHaveProperty("projectAge");
    expect(m).toHaveProperty("teamSize");
    expect(m).toHaveProperty("hasDedicatedTeam");
    expect(m).toHaveProperty("hasArchitectureDocs");
    expect(m).toHaveProperty("hasADRs");
    expect(m).toHaveProperty("hasTechnicalReviews");
    expect(m).toHaveProperty("hasCICD");
    expect(m).toHaveProperty("hasAutomatedTests");
    expect(m).toHaveProperty("hasValidationPipeline");
    expect(m).toHaveProperty("intendsToUseAI");
    expect(m).toHaveProperty("aiWillImplement");
    expect(m).toHaveProperty("requiresHumanReview");
    expect(m).toHaveProperty("hasDefinedPatterns");
    expect(m).toHaveProperty("hasReviewProcess");
    expect(m).toHaveProperty("hasDecisionControl");
  });

  it("maps user profile with correct types", async () => {
    const result = await callAskQuestions();
    const up = result.userProfile;
    expect(up).toBeDefined();
    expect(typeof up!.name).toBe("string");
    expect(typeof up!.role).toBe("string");
    expect(["junior", "pleno", "senior"]).toContain(up!.architecture);
    expect(["junior", "pleno", "senior"]).toContain(up!.coding);
    expect(["junior", "pleno", "senior"]).toContain(up!.leadership);
    expect(["mentor", "peer", "relatorio"]).toContain(up!.tone);
    expect(["pt", "en"]).toContain(up!.language);
    expect(typeof up!.codeFreePercent).toBe("number");
    expect(Array.isArray(up!.focusAreas)).toBe(true);
  });

  it("parses focus areas from comma-separated string", async () => {
    const inquirer = (await import("inquirer")).default;
    let callCount = 0;
    mockPrompt.mockImplementation((questions: any[]) => {
      callCount++;
      const answers: Record<string, any> = {};
      for (const q of questions) {
        if (q.type === "input") {
          if (q.name === "focusAreas") {
            answers[q.name] = "vision,leadership,testing";
          } else {
            answers[q.name] = q.default ?? "test";
          }
        } else if (q.type === "list") {
          answers[q.name] = typeof q.choices[0] === "string"
            ? q.choices[0]
            : q.choices[0].value;
        } else if (q.type === "checkbox") {
          answers[q.name] = [];
        } else if (q.type === "confirm") {
          answers[q.name] = q.default ?? false;
        }
      }
      return Promise.resolve(answers);
    });
    vi.mocked(inquirer.prompt).mockImplementation(mockPrompt);

    const { askQuestions } = await import("../interface/cli/prompts.js");
    const result = await askQuestions(makeAnalysis());

    expect(result.userProfile?.focusAreas).toEqual(["vision", "leadership", "testing"]);
  });

  it("handles empty focus areas", async () => {
    const result = await callAskQuestions();
    expect(result.userProfile?.focusAreas).toEqual([]);
  });

  it("casts codeFreePercent to number", async () => {
    const result = await callAskQuestions();
    expect(typeof result.userProfile?.codeFreePercent).toBe("number");
  });

  it("maps enableMcpRegistration from prompt", async () => {
    const result = await callAskQuestions();
    expect(typeof result.enableMcpRegistration).toBe("boolean");
  });

  it("passes analysis to prompt choices", async () => {
    const inquirer = (await import("inquirer")).default;
    mockPrompt.mockImplementation((questions: any[]) => {
      const answers: Record<string, any> = {};
      for (const q of questions) {
        if (q.type === "checkbox" && q.name === "stack") {
          const checkedChoices = q.choices
            .filter((c: any) => c.checked)
            .map((c: any) => c.value);
          answers[q.name] = checkedChoices;
        } else if (q.type === "input") {
          answers[q.name] = q.default ?? "test";
        } else if (q.type === "list") {
          answers[q.name] = typeof q.choices[0] === "string"
            ? q.choices[0]
            : q.choices[0].value;
        } else if (q.type === "confirm") {
          answers[q.name] = q.default ?? false;
        }
      }
      return Promise.resolve(answers);
    });
    vi.mocked(inquirer.prompt).mockImplementation(mockPrompt);

    const { askQuestions } = await import("../interface/cli/prompts.js");
    const result = await askQuestions(makeAnalysis({ stack: ["react", "typescript"] }));

    expect(result.stack).toContain("react");
    expect(result.stack).toContain("typescript");
  });
});
