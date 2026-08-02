import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cleanCommand } from "../commands/clean.js";
import { doctorCommand } from "../commands/doctor.js";
import { reportCommand } from "../commands/report.js";
import { assessCommand } from "../commands/assess.js";
import { evolveCommand } from "../commands/evolve.js";
import { syncCommand } from "../commands/sync.js";


let tempDir: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-action-"));
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  stdoutSpy.mockRestore();
});

function setupShitennoDir(dir: string) {
  const shitennoDir = join(dir, ".shitenno");
  mkdirSync(join(shitennoDir, "governance"), { recursive: true });
  mkdirSync(join(shitennoDir, "docs", "skills"), { recursive: true });
  writeFileSync(join(dir, "opencode.json"), JSON.stringify({ agent: {} }));
  return shitennoDir;
}

function setupShitennoDirGoverned(dir: string) {
  const shitennoDir = setupShitennoDir(dir);
  writeFileSync(join(shitennoDir, "maturity-profile.json"), JSON.stringify({ overallScore: 50, dimensions: {}, installedCapabilities: [], recommendedCapabilities: [], futureCapabilities: [] }));
  writeFileSync(join(shitennoDir, "governance", "WORKFLOW.md"), "# Workflow");
  return shitennoDir;
}

function getJsonOutput(): Record<string, unknown> {
  const allOutput = stdoutSpy.mock.calls.map((c: unknown[]) => c[0] as string).join("");
  const start = allOutput.indexOf("{");
  if (start === -1) return {};
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < allOutput.length; i++) {
    const ch = allOutput[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(allOutput.slice(start, i + 1));
    }
  }
  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// clean command
// ═══════════════════════════════════════════════════════════════════════════════

describe("clean command action handler", () => {
  it("removes .shitenno-cache.json", () => {
    setupShitennoDirGoverned(tempDir);
    writeFileSync(join(tempDir, ".shitenno-cache.json"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(tempDir, ".shitenno-cache.json"))).toBe(false);
  });

  it("removes *.tsbuildinfo files", () => {
    setupShitennoDirGoverned(tempDir);
    writeFileSync(join(tempDir, "tsconfig.tsbuildinfo"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(tempDir, "tsconfig.tsbuildinfo"))).toBe(false);
  });

  it("outputs JSON with itemsRemoved array", () => {
    setupShitennoDirGoverned(tempDir);
    writeFileSync(join(tempDir, ".shitenno-cache.json"), "{}");

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("itemsRemoved");
    expect(output).toHaveProperty("count");
    expect(Array.isArray(output.itemsRemoved)).toBe(true);
    expect(output.count).toBeGreaterThanOrEqual(1);
  });

  it("outputs empty itemsRemoved when nothing to clean", () => {
    setupShitennoDirGoverned(tempDir);

    cleanCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.itemsRemoved).toEqual([]);
    expect(output.count).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// doctor command
// ═══════════════════════════════════════════════════════════════════════════════

describe("doctor command action handler", () => {
  it("outputs JSON with health report structure", () => {
    setupShitennoDirGoverned(tempDir);

    doctorCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("overallHealth");
    expect(output).toHaveProperty("healthScore");
    expect(output).toHaveProperty("findings");
    expect(output).toHaveProperty("teachingMoments");
    expect(output).toHaveProperty("summary");
    expect(typeof output.healthScore).toBe("number");
    expect(Array.isArray(output.findings)).toBe(true);
  });

  it("returns valid health score range", () => {
    setupShitennoDir(tempDir);

    doctorCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.healthScore).toBeGreaterThanOrEqual(0);
    expect(output.healthScore).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// report command
// ═══════════════════════════════════════════════════════════════════════════════

describe("report command action handler", () => {
  it("outputs JSON with report structure", () => {
    setupShitennoDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("dimensions");
    expect(output).toHaveProperty("insights");
    expect(output).toHaveProperty("nextSteps");
    expect(output).toHaveProperty("period");
  });

  it("uses default period of 30 days", () => {
    setupShitennoDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    const period = output.period as Record<string, unknown>;
    expect(period?.days).toBe(30);
  });

  it("respects --period flag", () => {
    setupShitennoDir(tempDir);

    const cmd = reportCommand();
    cmd.parse(["node", "test", "--dir", tempDir, "--json", "--period", "7"], { from: "user" });

    const output = getJsonOutput();
    const period = output.period as Record<string, unknown>;
    expect(period?.days).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// assess command
// ═══════════════════════════════════════════════════════════════════════════════

describe("assess command action handler", () => {
  it("outputs JSON with assessment structure", () => {
    setupShitennoDirGoverned(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("newProfile");
    expect(output).toHaveProperty("computedAt");
    expect(output).toHaveProperty("projectRoot");
  });

  it("newProfile has dimensions and scores", () => {
    setupShitennoDirGoverned(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    const profile = output.newProfile as Record<string, unknown>;
    expect(profile).toHaveProperty("dimensions");
    expect(profile).toHaveProperty("overallScore");
    expect(profile).toHaveProperty("installedCapabilities");
    expect(profile).toHaveProperty("recommendedCapabilities");
    expect(typeof profile.overallScore).toBe("number");
  });

  it("records maturity snapshot in telemetry dir", () => {
    const shitennoDir = setupShitennoDir(tempDir);

    assessCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    expect(existsSync(join(shitennoDir, "maturity-profile.json"))).toBe(true);
    const telemetryDir = join(shitennoDir, "telemetry");
    expect(existsSync(telemetryDir)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// evolve command
// ═══════════════════════════════════════════════════════════════════════════════

describe("evolve command action handler", () => {
  it("outputs JSON with evolution report", () => {
    setupShitennoDirGoverned(tempDir);

    evolveCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("totalRecommendations");
    expect(output).toHaveProperty("recommendations");
    expect(output).toHaveProperty("byType");
    expect(output).toHaveProperty("byPriority");
    expect(output).toHaveProperty("summary");
  });

  it("includes semantic layer data in JSON output", () => {
    setupShitennoDirGoverned(tempDir);

    evolveCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output).toHaveProperty("semantic");
    const semantic = output.semantic as Record<string, unknown>;
    expect(semantic).toHaveProperty("patterns");
    expect(semantic).toHaveProperty("insights");
    expect(semantic).toHaveProperty("correlations");
    expect(semantic).toHaveProperty("growthProfile");
    expect(Array.isArray(semantic.patterns)).toBe(true);
    expect(Array.isArray(semantic.insights)).toBe(true);
    expect(Array.isArray(semantic.correlations)).toBe(true);
    const gp = semantic.growthProfile as Record<string, unknown>;
    expect(gp).toHaveProperty("growthCapacity");
    expect(gp).toHaveProperty("challengeLevel");
    expect(gp).toHaveProperty("domainChallengeLevels");
  });

  it("semantic growth profile has numeric values", () => {
    setupShitennoDirGoverned(tempDir);

    evolveCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    const semantic = output.semantic as Record<string, unknown>;
    const gp = semantic.growthProfile as Record<string, unknown>;
    expect(typeof gp.growthCapacity).toBe("number");
    expect(typeof gp.challengeLevel).toBe("number");
    expect(typeof gp.domainChallengeLevels).toBe("object");
  });

  it("accept records feedback", () => {
    setupShitennoDirGoverned(tempDir);

    evolveCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--accept", "EVO-001", "--comfortable"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output).toHaveProperty("feedback");
  });

  it("reject records feedback with reason", () => {
    setupShitennoDirGoverned(tempDir);

    evolveCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--reject", "EVO-002", "--reason", "Not now"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output).toHaveProperty("feedback");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sync command
// ═══════════════════════════════════════════════════════════════════════════════

describe("sync command action handler", () => {
  it("errors when shitenno-path not specified", () => {
    setupShitennoDir(tempDir);

    syncCommand.parse(["node", "test", "--dir", tempDir, "--json"], { from: "user" });

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when shitenno directory not found", () => {
    setupShitennoDir(tempDir);

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--shitenno-path", "/nonexistent"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when project not initialized (lifecycle gate blocks first)", () => {
    // After decoupling from opencode.json, shitenno/ alone = initialized.
    // sync requires governed state; discovered state triggers lifecycle_gate first.
    const shitennoDir = setupShitennoDir(tempDir);
    rmSync(join(tempDir, "opencode.json"));

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--shitenno-path", shitennoDir],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.error).toBe("lifecycle_gate");
  });

  it("errors when shitenno/ missing (truly uninitialized)", () => {
    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json"],
      { from: "user" }
    );

    const output = getJsonOutput();
    // sync checks shitenno-dir existence first, returns missing_shitenno_dir
    expect(output.error).toBe("missing_shitenno_dir");
  });

  it("--dry-run does not modify files", () => {
    const shitennoDir = setupShitennoDirGoverned(tempDir);
    writeFileSync(join(shitennoDir, "docs", "AGENTS.md"), "# Agents");

    syncCommand.parse(
      ["node", "test", "--dir", tempDir, "--json", "--shitenno-path", shitennoDir, "--dry-run"],
      { from: "user" }
    );

    const output = getJsonOutput();
    expect(output.dryRun).toBe(true);
    expect(existsSync(join(tempDir, "docs", "AGENTS.md"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// feedback command — user rating/comment/tags flags
// ═══════════════════════════════════════════════════════════════════════════════

import { recordOutcome, type SessionFeedbackRecord } from "../session-feedback.js";
import { parseUserRating, parseUserTags } from "../feedback-utils.js";

describe("feedback command — user rating/comment/tags parsing", () => {
  // These tests verify the shared parsing helpers from feedback-utils.ts
  // and their integration with recordOutcome.

  it("parses valid user rating", () => {
    expect(parseUserRating("4")).toBe(4);
  });

  it("returns undefined for rating below 1", () => {
    expect(parseUserRating("0")).toBeUndefined();
  });

  it("returns undefined for rating above 5", () => {
    expect(parseUserRating("9")).toBeUndefined();
  });

  it("returns undefined when user rating not provided", () => {
    expect(parseUserRating(undefined)).toBeUndefined();
  });

  it("parses comma-separated user tags", () => {
    expect(parseUserTags("refactor,audit,perf")).toEqual(["refactor", "audit", "perf"]);
  });

  it("trims whitespace from user tags", () => {
    expect(parseUserTags(" refactor , audit ")).toEqual(["refactor", "audit"]);
  });

  it("returns undefined when user tags not provided", () => {
    expect(parseUserTags(undefined)).toBeUndefined();
  });

  it("records all user fields through recordOutcome", () => {
    const appended: SessionFeedbackRecord[] = [];
    const storage = { append: (r: SessionFeedbackRecord) => { appended.push(r); } };

    recordOutcome(storage, {
      outcome: "partial",
      briefingHash: "abc",
      briefingTimestamp: "2026-01-01",
      userRating: 3,
      userComment: "Needs improvement",
      userTags: ["bug", "urgent"],
    });

    const record = appended[0]!;
    expect(record.outcome).toBe("partial");
    expect(record.userRating).toBe(3);
    expect(record.userComment).toBe("Needs improvement");
    expect(record.userTags).toEqual(["bug", "urgent"]);
  });

  it("omits user fields when not provided", () => {
    const appended: SessionFeedbackRecord[] = [];
    const storage = { append: (r: SessionFeedbackRecord) => { appended.push(r); } };

    recordOutcome(storage, {
      outcome: "success",
      briefingHash: "abc",
      briefingTimestamp: "2026-01-01",
    });

    const record = appended[0]!;
    expect(record.userRating).toBeUndefined();
    expect(record.userComment).toBeUndefined();
    expect(record.userTags).toBeUndefined();
  });
});
