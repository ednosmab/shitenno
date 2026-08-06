import { describe, it, expect, afterEach } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { installReactiveHooks } from "../infrastructure/git-hooks-installer.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTempProject(withHusky = true): string {
  const dir = join(tmpdir(), `shugo-hooks-installer-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, ".git"), { recursive: true });
  if (withHusky) {
    mkdirSync(join(dir, ".husky"), { recursive: true });
  }
  return dir;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("installReactiveHooks", () => {
  let dir: string;

  afterEach(() => {
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("creates post-commit and post-merge when none exist", () => {
    dir = createTempProject();
    const result = installReactiveHooks(dir, "shugo");

    expect(result.installed).toContain("post-commit");
    expect(result.installed).toContain("post-merge");
    expect(result.skipped).toHaveLength(0);

    const pcContent = readFileSync(join(dir, ".husky", "post-commit"), "utf-8");
    expect(pcContent).toContain("#!/bin/sh");
    expect(pcContent).toContain("# shugo-managed-hook");
    expect(pcContent).toContain("shugo detect --auto 2>/dev/null &");
    expect(pcContent).toContain("shugo internal large-commit-check 2>/dev/null &");

    const pmContent = readFileSync(join(dir, ".husky", "post-merge"), "utf-8");
    expect(pmContent).toContain("#!/bin/sh");
    expect(pmContent).toContain("# shugo-managed-hook");
    expect(pmContent).toContain("shugo detect --auto 2>/dev/null &");
    expect(pmContent).toContain("shugo internal large-commit-check 2>/dev/null &");
  });

  it("is idempotent — running twice does not duplicate the hook content", () => {
    dir = createTempProject();
    installReactiveHooks(dir, "shugo");
    const result = installReactiveHooks(dir, "shugo");

    expect(result.installed).toHaveLength(0);
    expect(result.skipped).toContain("post-commit (já instalado)");
    expect(result.skipped).toContain("post-merge (já instalado)");

    const pcContent = readFileSync(join(dir, ".husky", "post-commit"), "utf-8");
    const pcOccurrences = pcContent.split("# shugo-managed-hook").length - 1;
    expect(pcOccurrences).toBe(1);

    const pmContent = readFileSync(join(dir, ".husky", "post-merge"), "utf-8");
    const pmOccurrences = pmContent.split("# shugo-managed-hook").length - 1;
    expect(pmOccurrences).toBe(1);
  });

  it("appends to an existing third-party hook instead of overwriting it", () => {
    dir = createTempProject();
    const hookPath = join(dir, ".husky", "post-commit");
    const thirdPartyContent = "#!/bin/sh\necho 'my custom hook'\nnpx lint-staged\n";
    writeFileSync(hookPath, thirdPartyContent, { mode: 0o755 });

    const result = installReactiveHooks(dir, "shugo");

    expect(result.installed).toContain("post-commit");

    const content = readFileSync(hookPath, "utf-8");
    expect(content).toContain("echo 'my custom hook'");
    expect(content).toContain("npx lint-staged");
    expect(content).toContain("# shugo-managed-hook");
    expect(content).toContain("shugo detect --auto 2>/dev/null &");
    expect(content).toContain("shugo internal large-commit-check 2>/dev/null &");
  });

  it("writes to .husky/ instead of .git/hooks/ when .husky/ exists", () => {
    dir = createTempProject(true);
    installReactiveHooks(dir, "shugo");

    expect(existsSync(join(dir, ".husky", "post-commit"))).toBe(true);
    expect(existsSync(join(dir, ".husky", "post-merge"))).toBe(true);
  });

  it("does not throw and returns skipped=['not-a-git-repo'] outside a git repo", () => {
    dir = join(tmpdir(), `shugo-hooks-not-git-${Date.now()}`);
    mkdirSync(dir, { recursive: true });

    const result = installReactiveHooks(dir, "shugo");

    expect(result.installed).toHaveLength(0);
    expect(result.skipped).toContain("not-a-git-repo");
  });
});
