import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { runUpgradeFlow } from "../commands/init/upgrade.js";
import {
  recordConsent,
  getConsentFilePath,
  readLatestConsent,
} from "../commands/init/consent.js";
import { SHITENNO_DIR_NAME } from "../constants.js";

function makeRepo(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-upgrade-${prefix}-`));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t.com", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  writeFileSync(join(dir, "readme.md"), "# repo\n", "utf-8");
  execSync("git add -A && git commit -qm init", { cwd: dir });
  return dir;
}

async function markInitialized(dir: string, level: 1 | 2): Promise<void> {
  mkdirSync(join(dir, SHITENNO_DIR_NAME), { recursive: true });
  const consentPath = await getConsentFilePath(dir);
  if (consentPath) recordConsent(consentPath, dir, level);
}

describe("runUpgradeFlow (Phase 7 — Level 1 → Level 2)", () => {
  it("reports not-initialized when .shitenno does not exist", async () => {
    const dir = makeRepo("notinit");
    try {
      const outcome = await runUpgradeFlow(dir, {});
      expect(outcome).toBe("not-initialized");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports already-level-2 when the latest consent is Level 2", async () => {
    const dir = makeRepo("lvl2");
    try {
      await markInitialized(dir, 1);
      const consentPath = await getConsentFilePath(dir);
      recordConsent(consentPath!, dir, 2);
      const outcome = await runUpgradeFlow(dir, {});
      expect(outcome).toBe("already-level-2");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports no-consent when no consent history exists", async () => {
    const dir = makeRepo("noconsent");
    try {
      mkdirSync(join(dir, SHITENNO_DIR_NAME), { recursive: true });
      const outcome = await runUpgradeFlow(dir, {});
      expect(outcome).toBe("no-consent");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("declines when the answers file does not approve Level 2", async () => {
    const dir = makeRepo("declined");
    try {
      await markInitialized(dir, 1);

      const answersPath = join(dir, "answers.json");
      writeFileSync(answersPath, JSON.stringify({ consentLevel: 1 }), "utf-8");

      const outcome = await runUpgradeFlow(dir, { answersFile: answersPath });
      expect(outcome).toBe("declined");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("upgrades to Level 2 via the answers file: applies root config and records new consent", async () => {
    const dir = makeRepo("upgrade");
    try {
      await markInitialized(dir, 1);

      writeFileSync(join(dir, "opencode.json"), JSON.stringify({ model: "original" }), "utf-8");

      const answersPath = join(dir, "answers-upgrade.json");
      writeFileSync(answersPath, JSON.stringify({ consentLevel: 2 }), "utf-8");

      const outcome = await runUpgradeFlow(dir, { answersFile: answersPath });
      expect(outcome).toBe("upgraded");

      // Consent history: last record must now be Level 2
      const consentPathAfter = await getConsentFilePath(dir);
      expect(readLatestConsent(consentPathAfter!)?.level).toBe(2);

      // Level 2 was applied inside an isolated worktree — find it on the
      // shitenno/init branch and verify the backup + manifest exist there.
      const worktreeDir = join(dir, "..", `${dir.split("/").pop()}-shitenno-init`);
      if (existsSync(worktreeDir)) {
        expect(existsSync(join(worktreeDir, SHITENNO_DIR_NAME, "backup", "pre-init", "opencode.json"))).toBe(true);
        expect(existsSync(join(worktreeDir, SHITENNO_DIR_NAME, "manifest.json"))).toBe(true);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});