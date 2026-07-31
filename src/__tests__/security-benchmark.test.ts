import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { detectSQLInjection } from "../audit/security/injection.js";
import { detectWeakCrypto } from "../audit/security/crypto.js";
import { detectPrototypePollution } from "../audit/security/misc.js";
import { detectInsecureCORS } from "../audit/security/cors.js";
import { detectHardcodedSecrets } from "../audit/security/secrets.js";
import type { SourceFileInfo } from "../audit/types.js";

const CORPUS_DIR = join(import.meta.dirname ?? process.cwd(), "..", "audit", "__fixtures__", "vuln-corpus");

function loadCorpus(category: string): SourceFileInfo[] {
  const dir = join(CORPUS_DIR, category);
  try {
    const files = readdirSync(dir);
    return files
      .filter((f) => f.endsWith(".ts"))
      .map((f) => {
        const content = readFileSync(join(dir, f), "utf-8");
        return {
          fullPath: join(dir, f),
          relPath: `__fixtures__/vuln-corpus/${category}/${f}`,
          basename: f,
          content,
          lineCount: content.split("\n").length,
        };
      });
  } catch {
    return [];
  }
}

function loadAllFixtures(): SourceFileInfo[] {
  const categories = readdirSync(CORPUS_DIR);
  const all: SourceFileInfo[] = [];
  for (const cat of categories) {
    all.push(...loadCorpus(cat));
  }
  return all;
}

describe("Security Benchmark — Detection Corpus", () => {
  const allFixtures = loadAllFixtures();

  it("corpus has expected fixture files", () => {
    expect(allFixtures.length).toBeGreaterThanOrEqual(7);
  });

  describe("SQL Injection — bare call detection", () => {
    it("detects query(sql) with destructured import", () => {
      const files = loadCorpus("sql-injection");
      const bare = files.filter((f) => f.relPath.includes("bare-call"));
      const issues = detectSQLInjection("/tmp", bare);
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("SQL Injection — object call detection (Item 1e)", () => {
    it("detects pool.query(sql) via suffix matching", () => {
      const files = loadCorpus("sql-injection");
      const obj = files.filter((f) => f.relPath.includes("object-call"));
      const issues = detectSQLInjection("/tmp", obj);
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag safe pool.raw with parameterized query", () => {
      const files = loadCorpus("sql-injection");
      const safe = files.filter((f) => f.relPath.includes("safe"));
      const issues = detectSQLInjection("/tmp", safe);
      expect(issues.length).toBe(0);
    });
  });

  describe("SQL Injection — multi-statement detection", () => {
    it("regex does NOT detect multi-line SQL concatenation (taint engine handles this via Item 2b)", () => {
      const files = loadCorpus("sql-injection");
      const multi = files.filter((f) => f.relPath.includes("multi-statement"));
      const issues = detectSQLInjection("/tmp", multi);
      expect(issues.length).toBe(0);
    });
  });

  describe("Prototype Pollution — multiline for-in (Item 4)", () => {
    it("detects for...in with cross-line assignment", () => {
      const files = loadCorpus("prototype-pollution");
      const vuln = files.filter((f) => f.relPath.includes("multiline"));
      const issues = detectPrototypePollution("/tmp", vuln);
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag safe for-in with hasOwnProperty check", () => {
      const files = loadCorpus("prototype-pollution");
      const safe = files.filter((f) => f.relPath.includes("safe"));
      const issues = detectPrototypePollution("/tmp", safe);
      expect(issues.length).toBe(0);
    });
  });

  describe("CORS — wildcard + credentials (Item 1f)", () => {
    it("detects cors({origin:'*', credentials:true})", () => {
      const files = loadCorpus("cors");
      const vuln = files.filter((f) => f.relPath.includes("wildcard"));
      const issues = detectInsecureCORS("/tmp", vuln);
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag cors with specific origin + credentials", () => {
      const files = loadCorpus("cors");
      const safe = files.filter((f) => f.relPath.includes("safe"));
      const issues = detectInsecureCORS("/tmp", safe);
      expect(issues.length).toBe(0);
    });
  });

  describe("Hardcoded Secrets — env fallback (Item 1f)", () => {
    it("detects secret with process.env fallback to hardcoded value", () => {
      const files = loadCorpus("hardcoded-secrets");
      const vuln = files.filter((f) => f.relPath.includes("env-fallback"));
      const issues = detectHardcodedSecrets("/tmp", vuln);
      expect(issues.length).toBeGreaterThanOrEqual(1);
    });

    it("does NOT flag safe JSON.parse(readFileSync(...))", () => {
      const files = loadCorpus("hardcoded-secrets");
      const safe = files.filter((f) => f.relPath.includes("safe"));
      const issues = detectHardcodedSecrets("/tmp", safe);
      expect(issues.length).toBe(0);
    });
  });

  describe("Weak Crypto — self-detection exclusion", () => {
    it("does not flag detector definition files themselves", () => {
      const detectorFile: SourceFileInfo = {
        fullPath: "/tmp/src/audit/security/crypto.ts",
        relPath: "src/audit/security/crypto.ts",
        basename: "crypto.ts",
        content: 'const hash = crypto.createHash("md5");',
        lineCount: 1,
      };
      const issues = detectWeakCrypto("/tmp", [detectorFile]);
      expect(issues.length).toBe(0);
    });
  });

  describe("Cross-category — no false positives on safe fixtures", () => {
    it("safe fixtures produce zero issues across all detectors", () => {
      const safeFixtures = allFixtures.filter((f) => f.relPath.includes("safe"));
      const sqlIssues = detectSQLInjection("/tmp", safeFixtures);
      const protoIssues = detectPrototypePollution("/tmp", safeFixtures);
      const corsIssues = detectInsecureCORS("/tmp", safeFixtures);
      const secretIssues = detectHardcodedSecrets("/tmp", safeFixtures);
      const totalFalsePositives = sqlIssues.length + protoIssues.length + corsIssues.length + secretIssues.length;
      expect(totalFalsePositives).toBe(0);
    });
  });
});
