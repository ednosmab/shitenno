import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SourceFileInfo } from "../audit/types.js";
import {
  detectHardcodedSecrets,
  detectSQLInjection,
  detectXSS,
  detectUnsafeEval,
  detectConsoleSecrets,
  detectWeakCrypto,
  detectInsecureHTTP,
  detectPrototypePollution,
  detectPathTraversal,
  detectRegexDos,
  detectUnsafeDeserialization,
  detectDependencyConfusion,
  detectOrphanModules,
  detectComplexityHotspots,
  detectConsoleUsage,
  detectEmptyCatchBlocks,
  detectHighComplexity,
  detectCircularDeps,
  detectUnusedExports,
  detectDeadCodePatterns,
  detectUnpinnedVersions,
  detectMissingLockFile,
  detectDeprecatedPackages,
  detectConfigSecrets,
  detectInsecureCORS,
  detectInsecureCookies,
  detectWeakRandomness,
} from "../audit/engineering-detectors.js";

let tempDir: string;

function makeFile(relPath: string, content: string): SourceFileInfo {
  const basename = relPath.split("/").pop() || relPath;
  const fullPath = join(tempDir, relPath);
  return {
    fullPath,
    relPath,
    basename,
    content,
    lineCount: content.split("\n").length,
  };
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-detectors-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

// ── detectHardcodedSecrets ───────────────────────────────────────────────────

describe("detectHardcodedSecrets", () => {
  it("detects hardcoded password", () => {
    const files = [makeFile("src/app.ts", 'const password = "supersecret123"')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.type).toBe("hardcoded_secret");
    expect(issues[0]!.severity).toBe(3);
    expect(issues[0]!.description).toContain("password");
  });

  it("detects hardcoded API key", () => {
    const files = [makeFile("src/config.ts", 'const api_key = "abcdefgh12345678"')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.type).toBe("hardcoded_secret");
  });

  it("detects hardcoded secret/token", () => {
    const files = [makeFile("src/auth.ts", 'const secret = "abcdefghijklmnop1234"')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.description).toContain("secret/token");
  });

  it("detects bearer token", () => {
    const files = [makeFile("src/api.ts", 'const auth = "Bearer abcdefghijklmnopqrst1234"')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.description).toContain("bearer");
  });

  it("skips comments", () => {
    const files = [makeFile("src/config.ts", '// const password = "secret123"\nconst x = 1;')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/auth.test.ts", 'const password = "secret123"')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("returns empty for clean code", () => {
    const files = [makeFile("src/app.ts", 'const config = getEnv("PASSWORD")')];
    const issues = detectHardcodedSecrets(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectSQLInjection ───────────────────────────────────────────────────────

describe("detectSQLInjection", () => {
  it("detects template literal in query", () => {
    const files = [makeFile("src/db.ts", 'db.query(`SELECT * FROM users WHERE id = ${id}`)')];
    const issues = detectSQLInjection(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("sql_injection");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects concatenation in SELECT", () => {
    const files = [makeFile("src/db.ts", 'const q = "SELECT * FROM users WHERE name = " + name')];
    const issues = detectSQLInjection(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("detects concatenation in INSERT", () => {
    const files = [makeFile("src/db.ts", 'db.execute("INSERT INTO users VALUES (" + val + ")")')];
    const issues = detectSQLInjection(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("returns empty for parameterized queries", () => {
    const files = [makeFile("src/db.ts", 'db.query("SELECT * FROM users WHERE id = ?", [id])')];
    const issues = detectSQLInjection(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectXSS ────────────────────────────────────────────────────────────────

describe("detectXSS", () => {
  it("detects innerHTML assignment", () => {
    const files = [makeFile("src/render.ts", 'element.innerHTML = userInput')];
    const issues = detectXSS(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("xss_risk");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects dangerouslySetInnerHTML", () => {
    const files = [makeFile("src/component.tsx", '<div dangerouslySetInnerHTML={{ __html: data }} />')];
    const issues = detectXSS(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("detects document.write", () => {
    const files = [makeFile("src/inject.ts", "document.write(html)")];
    const issues = detectXSS(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/render.test.ts", 'element.innerHTML = "test"')];
    const issues = detectXSS(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("returns empty for safe code", () => {
    const files = [makeFile("src/render.ts", 'element.textContent = userInput')];
    const issues = detectXSS(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectUnsafeEval ─────────────────────────────────────────────────────────

describe("detectUnsafeEval", () => {
  it("detects eval()", () => {
    const files = [makeFile("src/exec.ts", "eval(userCode)")];
    const issues = detectUnsafeEval(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("unsafe_eval");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects new Function()", () => {
    const files = [makeFile("src/exec.ts", 'new Function("return 1")')];
    const issues = detectUnsafeEval(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("detects setTimeout with string", () => {
    const files = [makeFile("src/exec.ts", 'setTimeout("alert(1)", 100)')];
    const issues = detectUnsafeEval(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/exec.test.ts", "eval(code)")];
    const issues = detectUnsafeEval(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectConsoleSecrets ─────────────────────────────────────────────────────

describe("detectConsoleSecrets", () => {
  it("detects console.log with password", () => {
    const files = [makeFile("src/logger.ts", 'console.log("password:", pwd)')];
    const issues = detectConsoleSecrets(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("console_secret");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects console.log with api_key", () => {
    const files = [makeFile("src/logger.ts", 'console.log("api_key:", key)')];
    const issues = detectConsoleSecrets(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("ignores false positive 'estimated tokens'", () => {
    const files = [makeFile("src/utils.ts", 'console.log("estimated tokens:", count)')];
    const issues = detectConsoleSecrets(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/log.test.ts", 'console.log("password:", x)')];
    const issues = detectConsoleSecrets(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectWeakCrypto ─────────────────────────────────────────────────────────

describe("detectWeakCrypto", () => {
  it("detects MD5 hash", () => {
    const files = [makeFile("src/crypto.ts", 'crypto.createHash("md5")')];
    const issues = detectWeakCrypto(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("weak_crypto");
    expect(issues[0]!.severity).toBe(2);
  });

  it("detects SHA1 hash", () => {
    const files = [makeFile("src/crypto.ts", 'crypto.createHash("sha1")')];
    const issues = detectWeakCrypto(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("detects createCipher (non-IV)", () => {
    const files = [makeFile("src/crypto.ts", "crypto.createCipher(algorithm, key)")];
    const issues = detectWeakCrypto(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("does not flag createCipheriv", () => {
    const files = [makeFile("src/crypto.ts", "crypto.createCipheriv(algorithm, key, iv)")];
    const issues = detectWeakCrypto(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not flag SHA256", () => {
    const files = [makeFile("src/crypto.ts", 'crypto.createHash("sha256")')];
    const issues = detectWeakCrypto(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectInsecureHTTP ───────────────────────────────────────────────────────

describe("detectInsecureHTTP", () => {
  it("detects non-localhost HTTP URL", () => {
    const files = [makeFile("src/api.ts", 'const url = "http://example.com/api"')];
    const issues = detectInsecureHTTP(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("insecure_http");
    expect(issues[0]!.severity).toBe(2);
  });

  it("ignores localhost", () => {
    const files = [makeFile("src/server.ts", 'const url = "http://localhost:3000/api"')];
    const issues = detectInsecureHTTP(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("ignores 127.0.0.1", () => {
    const files = [makeFile("src/server.ts", 'const url = "http://127.0.0.1:8080"')];
    const issues = detectInsecureHTTP(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/api.test.ts", 'const url = "http://example.com"')];
    const issues = detectInsecureHTTP(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips comments", () => {
    const files = [makeFile("src/api.ts", '// const url = "http://example.com"')];
    const issues = detectInsecureHTTP(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectPrototypePollution ─────────────────────────────────────────────────

describe("detectPrototypePollution", () => {
  it("detects Object.assign with req", () => {
    const files = [makeFile("src/merge.ts", "Object.assign(target, req.body)")];
    const issues = detectPrototypePollution(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("proto_pollution");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects merge with req", () => {
    const files = [makeFile("src/merge.ts", "merge(target, req.body)")];
    const issues = detectPrototypePollution(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("returns empty for safe code", () => {
    const files = [makeFile("src/merge.ts", "Object.assign(target, safeObject)")];
    const issues = detectPrototypePollution(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectPathTraversal ──────────────────────────────────────────────────────

describe("detectPathTraversal", () => {
  it("detects readFile with concatenation", () => {
    const files = [makeFile("src/fs.ts", "readFile(base + userInput)")];
    const issues = detectPathTraversal(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("path_traversal");
    expect(issues[0]!.severity).toBe(1);
  });

  it("detects writeFile with template literal", () => {
    const files = [makeFile("src/fs.ts", "writeFile(`${dir}/${file}`, data)")];
    const issues = detectPathTraversal(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("detects path.join with req.query", () => {
    const files = [makeFile("src/routes.ts", "path.join(base, req.query.file)")];
    const issues = detectPathTraversal(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/fs.test.ts", "readFile(path + user)")];
    const issues = detectPathTraversal(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectRegexDos ───────────────────────────────────────────────────────────

describe("detectRegexDos", () => {
  it("detects RegExp with concatenation", () => {
    const files = [makeFile("src/validate.ts", "new RegExp(a + b + c)")];
    const issues = detectRegexDos(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("regex_dos");
    expect(issues[0]!.severity).toBe(2);
  });

  it("returns empty for static regex", () => {
    const files = [makeFile("src/validate.ts", "const pattern = new RegExp(hexChars)")];
    const issues = detectRegexDos(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectUnsafeDeserialization ───────────────────────────────────────────────

describe("detectUnsafeDeserialization", () => {
  it("detects JSON.parse with req", () => {
    const files = [makeFile("src/routes.ts", "JSON.parse(req.body)")];
    const issues = detectUnsafeDeserialization(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("missing_schema_validation");
    // JSON.parse unvalidated is severity 1 (info); real RCE sinks (js-yaml.load, vm.runInNewContext) are severity 3
    expect(issues[0]!.severity).toBe(1);
  });

  it("detects JSON.parse with process.argv", () => {
    const files = [makeFile("src/cli.ts", "JSON.parse(process.argv[2])")];
    const issues = detectUnsafeDeserialization(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe(1);
  });

  it("detects js-yaml.load (real RCE — severity 3)", () => {
    const files = [makeFile("src/yaml.ts", "const data = require('js-yaml').load(req.body)")];
    const issues = detectUnsafeDeserialization(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects vm.runInNewContext (real RCE — severity 3)", () => {
    const files = [makeFile("src/sandbox.ts", "vm.runInNewContext(req.body)")];
    const issues = detectUnsafeDeserialization(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe(3);
  });

  it("returns empty for safe parse", () => {
    const files = [makeFile("src/utils.ts", "JSON.parse(staticData)")];
    const issues = detectUnsafeDeserialization(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectOrphanModules ──────────────────────────────────────────────────────

describe("detectOrphanModules", () => {
  it("does not flag module whose exports are used by others", () => {
    const files = [
      makeFile("src/a.ts", 'import { x } from "./b.js"\nexport const a = x;'),
      makeFile("src/b.ts", "export const x = 1;"),
    ];
    const issues = detectOrphanModules(tempDir, files);
    const orphanB = issues.find((i) => i.description.includes("b.ts"));
    expect(orphanB).toBeUndefined();
  });

  it("flags module with no imports and no export usage", () => {
    const files = [
      makeFile("src/a.ts", 'import { y } from "./c.js"\nexport const a = y;'),
      makeFile("src/b.ts", "export const x = 1;"),
      makeFile("src/c.ts", "export const y = 2;"),
    ];
    const issues = detectOrphanModules(tempDir, files);
    const orphanB = issues.find((i) => i.description.includes("b.ts"));
    expect(orphanB).toBeDefined();
  });

  it("does not flag module with exports used but no path import", () => {
    const files = [
      makeFile("src/a.ts", 'export { x } from "./b.js"'),
      makeFile("src/b.ts", "export const x = 1;"),
    ];
    const issues = detectOrphanModules(tempDir, files);
    const orphanB = issues.find((i) => i.description.includes("b.ts"));
    expect(orphanB).toBeUndefined();
  });

  it("skips commands/ and console/ directories", () => {
    const files = [
      makeFile("src/commands/status.ts", "export function status() {}"),
      makeFile("src/console/hooks/useCommand.ts", "export function useCommand() {}"),
    ];
    const issues = detectOrphanModules(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("returns empty for empty file list", () => {
    const issues = detectOrphanModules(tempDir, []);
    expect(issues.length).toBe(0);
  });
});

// ── detectComplexityHotspots ─────────────────────────────────────────────────

describe("detectComplexityHotspots", () => {
  it("detects oversized file (>1000 lines = severity 2)", () => {
    const bigContent = Array.from({ length: 1100 }, (_, i) => `line ${i}`).join("\n");
    const files = [makeFile("src/big.ts", bigContent)];
    const issues = detectComplexityHotspots(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("oversized_file");
    expect(issues[0]!.severity).toBe(2);
  });

  it("detects info-level oversized file (500-1000 lines = severity 1)", () => {
    const medContent = Array.from({ length: 600 }, (_, i) => `line ${i}`).join("\n");
    const files = [makeFile("src/medium.ts", medContent)];
    const issues = detectComplexityHotspots(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.severity).toBe(1);
  });

  it("does not flag small files", () => {
    const files = [makeFile("src/small.ts", "const x = 1;")];
    const issues = detectComplexityHotspots(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectConsoleUsage ───────────────────────────────────────────────────────

describe("detectConsoleUsage", () => {
  it("detects console.log outside commands/", () => {
    const files = [makeFile("src/utils.ts", "console.log('debug')")];
    const issues = detectConsoleUsage(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("console_log_outside_cmd");
  });

  it("ignores console.log inside commands/", () => {
    const files = [makeFile("src/commands/status.ts", "console.log('status')")];
    const issues = detectConsoleUsage(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("ignores console.log inside console/", () => {
    const files = [makeFile("src/console/render.ts", "console.log('render')")];
    const issues = detectConsoleUsage(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectEmptyCatchBlocks ───────────────────────────────────────────────────

describe("detectEmptyCatchBlocks", () => {
  it("detects empty catch block", () => {
    const files = [makeFile("src/app.ts", "try {\n  run()\n} catch (e) {\n}")];
    const issues = detectEmptyCatchBlocks(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("empty_catch");
    expect(issues[0]!.severity).toBe(2);
  });

  it("detects catch with only comments", () => {
    const files = [makeFile("src/app.ts", "try {\n  run()\n} catch (e) {\n  // ignored\n}")];
    const issues = detectEmptyCatchBlocks(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("does not flag catch with error handling", () => {
    const files = [makeFile("src/app.ts", "try {\n  run()\n} catch (e) {\n  console.error(e)\n}")];
    const issues = detectEmptyCatchBlocks(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("detects catch with multiple consecutive comments", () => {
    const files = [makeFile("src/app.ts", "try {\n  run()\n} catch (e) {\n  /* a */ // b\n}")];
    const issues = detectEmptyCatchBlocks(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("does not hang on adversarial whitespace-only catch body (ReDoS resistance)", () => {
    const adversarial = "try {\n  run()\n} catch (e) {" + " ".repeat(500_000) + "x";
    const files = [makeFile("src/app.ts", adversarial)];
    const start = Date.now();
    detectEmptyCatchBlocks(tempDir, files);
    expect(Date.now() - start).toBeLessThan(1000);
  });
});

// ── detectHighComplexity ─────────────────────────────────────────────────────

describe("detectHighComplexity", () => {
  it("detects function with complexity >15", () => {
    const code = `function complex(x: number) {
  if (x > 0) {}
  if (x > 1) {}
  if (x > 2) {}
  if (x > 3) {}
  if (x > 4) {}
  if (x > 5) {}
  if (x > 6) {}
  if (x > 7) {}
  if (x > 8) {}
  if (x > 9) {}
  if (x > 10) {}
  if (x > 11) {}
  if (x > 12) {}
  if (x > 13) {}
  if (x > 14) {}
  if (x > 15) {}
  return x;
}`;
    const files = [makeFile("src/complex.ts", code)];
    const issues = detectHighComplexity(tempDir, files);
    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues[0]!.type).toBe("high_complexity");
  });

  it("does not flag simple functions", () => {
    const files = [makeFile("src/simple.ts", "function simple(x: number) { return x + 1; }")];
    const issues = detectHighComplexity(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectCircularDeps ───────────────────────────────────────────────────────

describe("detectCircularDeps", () => {
  it("returns empty for empty file list", () => {
    const issues = detectCircularDeps(tempDir, []);
    expect(issues.length).toBe(0);
  });
});

// ── detectUnusedExports ──────────────────────────────────────────────────────

describe("detectUnusedExports", () => {
  it("detects unused exported function", () => {
    const files = [
      makeFile("src/utils.ts", "export function unused() { return 1; }\nexport const used = 2;"),
      makeFile("src/main.ts", 'import { used } from "./utils.js"\nconsole.log(used);'),
    ];
    const issues = detectUnusedExports(tempDir, files);
    const unusedIssue = issues.find((i) => i.description.includes("unused"));
    expect(unusedIssue).toBeDefined();
  });

  it("does not flag exports that are used", () => {
    const files = [
      makeFile("src/utils.ts", "export function helper() { return 1; }"),
      makeFile("src/main.ts", 'import { helper } from "./utils.js"\nhelper();'),
    ];
    const issues = detectUnusedExports(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectDeadCodePatterns ───────────────────────────────────────────────────

describe("detectDeadCodePatterns", () => {
  it("detects @ts-ignore", () => {
    const files = [makeFile("src/unsafe.ts", "// @ts-ignore\nconst x: string = 123;")];
    const issues = detectDeadCodePatterns(tempDir, files);
    const tsIgnore = issues.find((i) => i.description.includes("@ts-ignore"));
    expect(tsIgnore).toBeDefined();
  });

  it("detects @ts-expect-error", () => {
    const files = [makeFile("src/unsafe.ts", "// @ts-expect-error\nconst x: string = 123;")];
    const issues = detectDeadCodePatterns(tempDir, files);
    const tsExpect = issues.find((i) => i.description.includes("@ts-expect-error"));
    expect(tsExpect).toBeDefined();
  });

  it("detects empty function body", () => {
    const files = [makeFile("src/empty.ts", "function empty() {}")];
    const issues = detectDeadCodePatterns(tempDir, files);
    const emptyFunc = issues.find((i) => i.description.includes("vazi"));
    expect(emptyFunc).toBeDefined();
  });

  it("detects TODO comments", () => {
    const files = [makeFile("src/wip.ts", "// TODO: implement this")];
    const issues = detectDeadCodePatterns(tempDir, files);
    const todo = issues.find((i) => i.description.includes("TODO"));
    expect(todo).toBeDefined();
  });

  it("detects FIXME comments", () => {
    const files = [makeFile("src/wip.ts", "// FIXME: broken")];
    const issues = detectDeadCodePatterns(tempDir, files);
    const fixme = issues.find((i) => i.description.includes("FIXME"));
    expect(fixme).toBeDefined();
  });

  it("limits TODOs to 5 per file", () => {
    const todos = Array.from({ length: 10 }, (_, i) => `// TODO item ${i}`).join("\n");
    const files = [makeFile("src/many.ts", todos)];
    const issues = detectDeadCodePatterns(tempDir, files);
    const todoIssues = issues.filter((i) => i.description.includes("TODO"));
    expect(todoIssues.length).toBe(5);
  });
});

// ── detectUnpinnedVersions ───────────────────────────────────────────────────

describe("detectUnpinnedVersions", () => {
  it("detects wildcard version", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { lodash: "*" },
    }));
    const issues = detectUnpinnedVersions(tempDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("unpinned_version");
  });

  it("detects 'latest' version", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      devDependencies: { eslint: "latest" },
    }));
    const issues = detectUnpinnedVersions(tempDir);
    expect(issues.length).toBe(1);
  });

  it("returns empty for pinned versions", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { lodash: "^4.17.21" },
    }));
    const issues = detectUnpinnedVersions(tempDir);
    expect(issues.length).toBe(0);
  });
});

// ── detectMissingLockFile ────────────────────────────────────────────────────

describe("detectMissingLockFile", () => {
  it("detects missing lock file", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    const issues = detectMissingLockFile(tempDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("missing_lock_file");
    expect(issues[0]!.severity).toBe(3);
  });

  it("does not flag when lock file exists", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
    const issues = detectMissingLockFile(tempDir);
    expect(issues.length).toBe(0);
  });
});

// ── detectDeprecatedPackages ─────────────────────────────────────────────────

describe("detectDeprecatedPackages", () => {
  it("detects deprecated 'request' package", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { request: "^2.88.0" },
    }));
    const issues = detectDeprecatedPackages(tempDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("deprecated_package");
  });

  it("detects deprecated 'tslint' package", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      devDependencies: { tslint: "^5.0.0" },
    }));
    const issues = detectDeprecatedPackages(tempDir);
    expect(issues.length).toBe(1);
  });

  it("returns empty for non-deprecated packages", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { lodash: "^4.17.21" },
    }));
    const issues = detectDeprecatedPackages(tempDir);
    expect(issues.length).toBe(0);
  });
});

// ── detectConfigSecrets ──────────────────────────────────────────────────────

describe("detectConfigSecrets", () => {
  it("detects password in .env not in .gitignore", () => {
    writeFileSync(join(tempDir, ".env"), "DB_PASSWORD=secret123\n");
    const issues = detectConfigSecrets(tempDir);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("config_secret");
    expect(issues[0]!.severity).toBe(3);
  });

  it("detects api_key in .env", () => {
    writeFileSync(join(tempDir, ".env"), "API_KEY=abcdefgh12345678\n");
    const issues = detectConfigSecrets(tempDir);
    expect(issues.length).toBe(1);
  });

  it("skips .env when in .gitignore", () => {
    writeFileSync(join(tempDir, ".env"), "PASSWORD=secret123\n");
    writeFileSync(join(tempDir, ".gitignore"), ".env\n");
    const issues = detectConfigSecrets(tempDir);
    expect(issues.length).toBe(0);
  });

  it("skips comments in .env", () => {
    writeFileSync(join(tempDir, ".env"), "# PASSWORD=secret123\n");
    const issues = detectConfigSecrets(tempDir);
    expect(issues.length).toBe(0);
  });

  it("returns empty for .env without secrets", () => {
    writeFileSync(join(tempDir, ".env"), "PORT=3000\nNODE_ENV=development\n");
    const issues = detectConfigSecrets(tempDir);
    expect(issues.length).toBe(0);
  });
});

// ── detectInsecureCORS ───────────────────────────────────────────────────────

describe("detectInsecureCORS", () => {
  it("detects Access-Control-Allow-Origin: * wildcard header", () => {
    const files = [makeFile("src/server.ts", 'res.setHeader("Access-Control-Allow-Origin", "*")')];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("insecure_cors");
    expect(issues[0]!.severity).toBe(2);
    expect(issues[0]!.description).toContain("CORS");
  });

  it("detects cors() without configuration (allows all origins)", () => {
    const files = [makeFile("src/server.ts", "app.use(cors())")];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("insecure_cors");
  });

  it("does not flag cors() with specific origin", () => {
    const files = [makeFile("src/server.ts", 'app.use(cors({ origin: "https://example.com" }))')];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not flag parseCors or other cors-prefixed functions", () => {
    const files = [makeFile("src/utils.ts", "const config = parseCors(options)")];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/server.test.ts", 'res.setHeader("Access-Control-Allow-Origin", "*")')];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("returns empty for safe code", () => {
    const files = [makeFile("src/server.ts", 'res.setHeader("Access-Control-Allow-Origin", "https://example.com")')];
    const issues = detectInsecureCORS(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectInsecureCookies ─────────────────────────────────────────────────────

describe("detectInsecureCookies", () => {
  it("detects res.cookie() missing httpOnly, secure, sameSite", () => {
    const files = [makeFile("src/routes.ts", 'res.cookie("session", token)')];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("insecure_cookie");
    expect(issues[0]!.severity).toBe(2);
    expect(issues[0]!.description).toContain("httpOnly");
    expect(issues[0]!.description).toContain("secure");
    expect(issues[0]!.description).toContain("sameSite");
  });

  it("detects res.cookie() with only httpOnly (missing secure and sameSite)", () => {
    const files = [makeFile("src/routes.ts", 'res.cookie("session", token, { httpOnly: true })')];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.description).toContain("secure");
    expect(issues[0]!.description).toContain("sameSite");
  });

  it("does not flag res.cookie() with all security flags", () => {
    const files = [
      makeFile("src/routes.ts", `
res.cookie("session", token, {
  httpOnly: true,
  secure: true,
  sameSite: "strict"
})`),
    ];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("detects Set-Cookie header missing flags", () => {
    const files = [makeFile("src/routes.ts", 'Set-Cookie: session=abc')];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("insecure_cookie");
  });

  it("does not flag Set-Cookie with all flags", () => {
    const files = [makeFile("src/routes.ts", 'Set-Cookie: session=abc; HttpOnly; Secure; SameSite=Strict')];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/routes.test.ts", 'res.cookie("session", token)')];
    const issues = detectInsecureCookies(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not cause lastIndex bug on repeated calls", () => {
    const files = [
      makeFile("src/a.ts", 'res.cookie("a", val1)'),
      makeFile("src/b.ts", 'res.cookie("b", val2)'),
      makeFile("src/c.ts", 'res.cookie("c", val3)'),
    ];
    // Run twice to check for regex lastIndex persistence
    const issues1 = detectInsecureCookies(tempDir, files);
    const issues2 = detectInsecureCookies(tempDir, files);
    expect(issues1.length).toBe(3);
    expect(issues2.length).toBe(3);
  });
});

// ── detectWeakRandomness ──────────────────────────────────────────────────────

describe("detectWeakRandomness", () => {
  it("detects Math.random() used for token generation", () => {
    const files = [makeFile("src/auth.ts", "const token = Math.random().toString(36)")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("weak_randomness");
    expect(issues[0]!.severity).toBe(2);
    expect(issues[0]!.description).toContain("Math.random");
  });

  it("detects Math.random() used for password generation", () => {
    const files = [makeFile("src/auth.ts", "const password = Math.random().toString(36).slice(2)")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("weak_randomness");
  });

  it("detects Math.random() for session key", () => {
    const files = [makeFile("src/auth.ts", 'const sessionKey = "s_" + Math.random().toString(36)')];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(1);
  });

  it("does not flag crypto.randomBytes() for secrets", () => {
    const files = [makeFile("src/auth.ts", "const token = crypto.randomBytes(32).toString('hex')")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not flag Math.random() for non-security variable names", () => {
    const files = [makeFile("src/utils.ts", "const randomIndex = Math.floor(Math.random() * arr.length)")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips test files", () => {
    const files = [makeFile("src/__tests__/auth.test.ts", "const token = Math.random().toString(36)")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("skips comments", () => {
    const files = [makeFile("src/auth.ts", "// const token = Math.random().toString(36)")];
    const issues = detectWeakRandomness(tempDir, files);
    expect(issues.length).toBe(0);
  });
});

// ── detectDependencyConfusion ────────────────────────────────────────────────

describe("detectDependencyConfusion", () => {
  it("detects import not in package.json or node_modules", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { lodash: "^4.17.21" },
    }));
    const files = [makeFile("src/app.ts", 'import { foo } from "nonexistent-pkg"')];
    const issues = detectDependencyConfusion(tempDir, files);
    expect(issues.length).toBe(1);
    expect(issues[0]!.type).toBe("dep_confusion");
  });

  it("does not flag declared dependencies", () => {
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({
      dependencies: { lodash: "^4.17.21" },
    }));
    const files = [makeFile("src/app.ts", 'import { merge } from "lodash"')];
    const issues = detectDependencyConfusion(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not flag relative imports", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    const files = [makeFile("src/app.ts", 'import { helper } from "./helper.js"')];
    const issues = detectDependencyConfusion(tempDir, files);
    expect(issues.length).toBe(0);
  });

  it("does not flag Node.js builtins", () => {
    writeFileSync(join(tempDir, "package.json"), "{}");
    const files = [makeFile("src/app.ts", 'import { join } from "path"')];
    const issues = detectDependencyConfusion(tempDir, files);
    expect(issues.length).toBe(0);
  });
});
