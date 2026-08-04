import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import {
  recordConsent,
  readConsentHistory,
  readLatestConsent,
  readDeclaredConsentLevel,
  CONSENT_FILE_NAME,
} from "../commands/init/consent.js";

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "shitenno-consent-"));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t.com", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  return dir;
}

function writeAndCommit(dir: string, file: string, content: string, message: string): void {
  writeFileSync(join(dir, file), content, "utf-8");
  execSync(`git add -A && git commit -q -m "${message}"`, { cwd: dir });
}

function consentFileFor(dir: string): string {
  return join(dir, ".git", "shitenno", CONSENT_FILE_NAME);
}

describe("recordConsent", () => {
  it("writes a time-stamped record and returns it", () => {
    const dir = makeRepo();
    const file = consentFileFor(dir);
    const record = recordConsent(file, dir, 1, "2.0.0");
    expect(record.level).toBe(1);
    expect(record.project).toBe(dir);
    expect(record.recordedAt).toBeDefined();
    expect(existsSync(file)).toBe(true);

    const history = readConsentHistory(file);
    expect(history).toHaveLength(1);
    expect(history[0]!).toMatchObject(record);
    rmSync(dir, { recursive: true, force: true });
  });

  it("is append-only — a second record does not overwrite the first", () => {
    const dir = makeRepo();
    const file = consentFileFor(dir);
    recordConsent(file, dir, 1, "2.0.0");
    recordConsent(file, dir, 2, "2.0.1");

    const history = readConsentHistory(file);
    expect(history).toHaveLength(2);
    expect(history[0]!.level).toBe(1);
    expect(history[1]!.level).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it("readLatestConsent returns the last record (upgrade source of truth)", () => {
    const dir = makeRepo();
    const file = consentFileFor(dir);
    recordConsent(file, dir, 1);
    recordConsent(file, dir, 2);
    expect(readLatestConsent(file)?.level).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it("readLatestConsent returns null when no consent was recorded", () => {
    const dir = makeRepo();
    expect(readLatestConsent(consentFileFor(dir))).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it("corrupted consent file yields empty history instead of throwing", () => {
    const dir = makeRepo();
    const file = consentFileFor(dir);
    mkdirSync(join(dir, ".git", "shitenno"), { recursive: true });
    writeFileSync(file, "not-json{", "utf-8");
    expect(readConsentHistory(file)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("consent record survives branch discard (regression — motivating scenario)", () => {
  it("persists in .git/shitenno/consent.json after git branch -D + git gc --prune=now", () => {
    const dir = makeRepo();
    writeAndCommit(dir, "readme.md", "# repo\n", "init");
    execSync("git checkout -q -b isolate", { cwd: dir });
    writeAndCommit(dir, "file.js", "const x = 1;\n", "wip");

    // Consent recorded while the isolated branch exists
    const consentPath = join(dir, ".git", "shitenno", CONSENT_FILE_NAME);
    const before = readConsentHistory(consentPath).length;
    const record = recordConsent(consentPath, dir, 1);

    // User dislikes the experiment — discard the branch and prune objects
    execSync("git checkout -q -", { cwd: dir });
    execSync("git branch -D isolate", { cwd: dir });
    execSync("git gc --prune=now -q", { cwd: dir });

    // The audit trail must survive the branch discard
    expect(existsSync(consentPath)).toBe(true);
    const history = readConsentHistory(consentPath);
    expect(history).toHaveLength(before + 1);
    expect(history.some((r) => r.id === record.id)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("readDeclaredConsentLevel (non-interactive)", () => {
  it("reads level from the --consent-level flag", async () => {
    await expect(readDeclaredConsentLevel({ consentLevel: "1" })).resolves.toEqual({ level: 1, error: null });
    await expect(readDeclaredConsentLevel({ consentLevel: "2" })).resolves.toEqual({ level: 2, error: null });
  });

  it("rejects invalid consent-level values", async () => {
    const result = await readDeclaredConsentLevel({ consentLevel: "5" });
    expect(result.level).toBeNull();
    expect(result.error).toBeDefined();
  });

  it("reads consentLevel from the answers file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shitenno-cl-answers-"));
    const answers = join(dir, "answers.json");
    writeFileSync(answers, JSON.stringify({ consentLevel: "2" }), "utf-8");
    await expect(readDeclaredConsentLevel({ answersFile: answers })).resolves.toEqual({ level: 2, error: null });
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null level when no consent key present", async () => {
    await expect(readDeclaredConsentLevel({})).resolves.toEqual({ level: null, error: null });
  });

  it("flag takes precedence over answers file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "shitenno-cl-prec-"));
    const answers = join(dir, "answers.json");
    writeFileSync(answers, JSON.stringify({ consentLevel: "1" }), "utf-8");
    await expect(readDeclaredConsentLevel({ consentLevel: "2", answersFile: answers })).resolves.toEqual({ level: 2, error: null });
    rmSync(dir, { recursive: true, force: true });
  });
});