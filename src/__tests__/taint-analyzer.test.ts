import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaintAnalyzer } from "../audit/taint/index.js";
import { cvssToSeverity } from "../audit/taint/types.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-taint-"));
});

afterEach(() => {
  TaintAnalyzer.clearCache();
  rmSync(tempDir, { recursive: true, force: true });
});

/**
 * Set up a taint test fixture: creates directories, tsconfig.json, and writes
 * the given code to a file in src/. Returns the analyzer ready to run.
 */
function setupTaintFixture(fileName: string, code: string): TaintAnalyzer {
  mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
  writeFileSync(join(tempDir, "src", "commands", "dummy.ts"), "# dummy");
  mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
  writeFileSync(join(tempDir, "src", "__tests__", "dummy.test.ts"), "# dummy test");

  writeFileSync(
    join(tempDir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        esModuleInterop: true,
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src/**/*.ts"],
      exclude: ["node_modules", "__tests__", "dist"],
    })
  );

  writeFileSync(join(tempDir, "src", fileName), code);
  return new TaintAnalyzer({ projectRoot: tempDir });
}

describe("TaintAnalyzer", () => {
  it("detects path_traversal and code_injection from process.argv", () => {
    const analyzer = setupTaintFixture("taint-fixture.ts", [
      "const userInput = process.argv[2];",
      "const path = userInput;",
      'import { readFileSync } from "node:fs";',
      "readFileSync(path);",
      "eval(userInput);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "path_traversal").length).toBeGreaterThanOrEqual(1);
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects tainted input from process.env", () => {
    const analyzer = setupTaintFixture("env-fixture.ts", [
      "const secret = process.env.API_KEY;",
      "eval(secret);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects taint flow through string concatenation (+ operator)", () => {
    const analyzer = setupTaintFixture("concat-fixture.ts", [
      'const url = "https://" + req.query.domain;',
      "fetch(url);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects taint flow through template literal", () => {
    const analyzer = setupTaintFixture("template-fixture.ts", [
      "const url = `https://${req.query.domain}/api`;",
      "fetch(url);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects taint flow through subproperty access (req.query.cmd)", () => {
    const analyzer = setupTaintFixture("subprop-fixture.ts", [
      "const cmd = req.query.cmd;",
      "exec(cmd);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "command_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via fetch with tainted URL", () => {
    const analyzer = setupTaintFixture("ssrf-fixture.ts", [
      "const url = req.body.url;",
      "fetch(url);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const ssrfIssues = issues.filter((i) => i.type === "ssrf");
    expect(ssrfIssues.length).toBeGreaterThanOrEqual(1);
    expect(ssrfIssues[0]!.sinkType).toBe("fetch");
  });

  it("detects SSRF via http.get with tainted URL", () => {
    const analyzer = setupTaintFixture("ssrf-http-fixture.ts", [
      "const target = req.body.target;",
      "http.get(target);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via undici with tainted URL", () => {
    const analyzer = setupTaintFixture("ssrf-undici-fixture.ts", [
      "const target = req.body.url;",
      "undici.fetch(target);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("reports zero issues for clean code", () => {
    const analyzer = setupTaintFixture("clean.ts", [
      "const x = 42;",
      "const y = x + 1;",
      "console.log(y);",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.length).toBe(0);
  });

  it("detects NoSQL injection via collection.find with tainted filter", () => {
    const analyzer = setupTaintFixture("nosql-fixture.ts", [
      "const filter = req.query;",
      "db.collection('users').find(filter);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const nosqlIssues = issues.filter((i) => i.type === "nosql_injection");
    expect(nosqlIssues.length).toBeGreaterThanOrEqual(1);
    expect(nosqlIssues[0]!.sinkType).toBe("find");
  });

  it("detects NoSQL injection via collection.findOne with tainted filter", () => {
    const analyzer = setupTaintFixture("nosql-findone-fixture.ts", [
      "const query = req.body;",
      "db.collection('users').findOne(query);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const nosqlIssues = issues.filter((i) => i.type === "nosql_injection");
    expect(nosqlIssues.length).toBeGreaterThanOrEqual(1);
    expect(nosqlIssues[0]!.sinkType).toBe("findOne");
  });

  it("detects SSTI via ejs.render with tainted template", () => {
    const analyzer = setupTaintFixture("ssti-ejs-fixture.ts", [
      "const template = req.query.template;",
      "ejs.render(template, { name: 'test' });",
    ].join("\n"));
    const issues = analyzer.analyze();

    const sstiIssues = issues.filter((i) => i.type === "ssti");
    expect(sstiIssues.length).toBeGreaterThanOrEqual(1);
    expect(sstiIssues[0]!.sinkType).toBe("ejs.render");
  });

  it("detects SSTI via handlebars.compile with tainted input", () => {
    const analyzer = setupTaintFixture("ssti-hbs-fixture.ts", [
      "const template = req.body.content;",
      "handlebars.compile(template);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const sstiIssues = issues.filter((i) => i.type === "ssti");
    expect(sstiIssues.length).toBeGreaterThanOrEqual(1);
    expect(sstiIssues[0]!.sinkType).toBe("handlebars.compile");
  });

  it("reports zero issues for safe NoSQL call with hardcoded filter", () => {
    const analyzer = setupTaintFixture("nosql-safe-fixture.ts", [
      "db.collection('users').find({ status: 'active' });",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "nosql_injection").length).toBe(0);
  });

  it("reports zero issues for safe SSTI call with hardcoded template", () => {
    const analyzer = setupTaintFixture("ssti-safe-fixture.ts", [
      "ejs.render('<h1>Hello <%= name %></h1>', { name: 'World' });",
    ].join("\n"));
    const issues = analyzer.analyze();

    expect(issues.filter((i) => i.type === "ssti").length).toBe(0);
  });

  it("detects SQL injection via pool.query with tainted input (suffix matching)", () => {
    const analyzer = setupTaintFixture("sql-suffix-fixture.ts", [
      "const sql = req.query.sql;",
      "pool.query(sql);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const sqlIssues = issues.filter((i) => i.type === "sql_injection");
    expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
    expect(sqlIssues[0]!.sinkType).toBe("query");
  });

  it("detects open redirect via res.redirect with tainted URL (suffix matching)", () => {
    const analyzer = setupTaintFixture("redirect-suffix-fixture.ts", [
      "const url = req.query.url;",
      "res.redirect(url);",
    ].join("\n"));
    const issues = analyzer.analyze();

    const redirectIssues = issues.filter((i) => i.type === "open_redirect");
    expect(redirectIssues.length).toBeGreaterThanOrEqual(1);
    expect(redirectIssues[0]!.sinkType).toBe("redirect");
  });

  it("detects taint propagation through function parameter (same file)", () => {
    const analyzer = setupTaintFixture("param-propagation-fixture.ts", [
      'function runQuery(sql: string) { return pool.query(sql); }',
      'const term = req.query.term;',
      'const sql = "SELECT * FROM items WHERE name = " + term;',
      'runQuery(sql);',
    ].join("\n"));
    const issues = analyzer.analyze();

    const sqlIssues = issues.filter((i) => i.type === "sql_injection");
    expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("does not confuse same-named variables across files when crossFile is disabled", () => {
    mkdirSync(join(tempDir, "src", "commands"), { recursive: true });
    writeFileSync(join(tempDir, "src", "commands", "dummy.ts"), "# dummy");
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "__tests__", "dummy.test.ts"), "# dummy test");
    writeFileSync(
      join(tempDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", esModuleInterop: true, strict: true, skipLibCheck: true, noEmit: true },
        include: ["src/**/*.ts"],
        exclude: ["node_modules", "__tests__", "dist"],
      })
    );

    // File A: genuinely tainted data flowing to exec()
    writeFileSync(join(tempDir, "src", "tainted-source.ts"), [
      'const cmd = process.argv[2];',
      'exec(cmd);',
    ].join("\n"));

    // File B: NOT tainted — local variable only
    writeFileSync(join(tempDir, "src", "clean-local.ts"), [
      'const cmd = "echo hello";',
      'exec(cmd);',
    ].join("\n"));

    const analyzer = new TaintAnalyzer({ projectRoot: tempDir, crossFile: false });
    const issues = analyzer.analyze();

    const taintedIssues = issues.filter((i) => i.location.includes("tainted-source"));
    const cleanIssues = issues.filter((i) => i.location.includes("clean-local"));

    expect(taintedIssues.length).toBeGreaterThanOrEqual(1);
    expect(cleanIssues.length).toBeLessThan(taintedIssues.length);
  });

  describe("cvssToSeverity", () => {
    it("returns severity 3 for high-impact CVSS vectors (score >= 5)", () => {
      // AV:N(0.85) + AC:L(0.77) + PR:N(0.85) + UI:N(0.85) + C:H(0.56) + I:H(0.56) + A:H(0.56) = 5.0
      const severity = cvssToSeverity({ AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" });
      expect(severity).toBe(3);
    });

    it("returns severity 2 for medium-impact CVSS vectors (score 3-4.99)", () => {
      // AV:N(0.85) + AC:H(0.44) + PR:L(0.62) + UI:N(0.85) + C:H(0.56) = 3.32 → severity 2
      const severity = cvssToSeverity({ AV: "N", AC: "H", PR: "L", UI: "N", C: "H" });
      expect(severity).toBe(2);
    });

    it("returns severity 1 for low-impact CVSS vectors (score < 3)", () => {
      // AV:P(0.2) + AC:H(0.44) + PR:H(0.27) + UI:R(0.62) + C:N(0) + I:N(0) + A:N(0) = 1.53
      const severity = cvssToSeverity({ AV: "P", AC: "H", PR: "H", UI: "R", C: "N", I: "N", A: "N" });
      expect(severity).toBe(1);
    });

    it("defaults to medium severity when CVSS fields are missing (score ~4.1)", () => {
      // Defaults: AV:N(0.85) + AC:L(0.77) + PR:N(0.85) + UI:N(0.85) + C:N(0) + I:N(0) + A:N(0) = 4.12
      const severity = cvssToSeverity({});
      expect(severity).toBe(2);
    });

    it("correctly weights Network attack vector as highest risk", () => {
      const networkSeverity = cvssToSeverity({ AV: "N", C: "H", I: "H", A: "H" });
      const physicalSeverity = cvssToSeverity({ AV: "P", C: "H", I: "H", A: "H" });
      expect(networkSeverity).toBeGreaterThanOrEqual(physicalSeverity);
    });
  });
});
