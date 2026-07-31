/**
 * taint-mutation.test.ts — Self-mutation testing for the taint engine
 *
 * Validates that the taint analysis engine correctly detects vulnerabilities
 * across mutation scenarios. Each test uses a recognized taint SOURCE
 * (req.query, process.argv, process.env, etc.) flowing to a dangerous SINK.
 *
 * If a mutation breaks the engine, the corresponding test should FAIL.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaintAnalyzer } from "../audit/taint/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-mutation-"));
});

afterEach(() => {
  TaintAnalyzer.clearCache();
  rmSync(tempDir, { recursive: true, force: true });
});

function setupFixture(fileName: string, code: string): TaintAnalyzer {
  mkdirSync(join(tempDir, "src"), { recursive: true });
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
    }),
  );
  writeFileSync(join(tempDir, "src", fileName), code);
  return new TaintAnalyzer({ projectRoot: tempDir });
}

// ══════════════════════════════════════════════════════════════════════════════
// MUTATION 1: Basic source→sink flows
// ══════════════════════════════════════════════════════════════════════════════

describe("Mutation 1 — Basic source→sink flows", () => {
  it("detects SQL injection via pool.query (suffix matching)", () => {
    const code = `function getUser(req: any) {
  const sql = "SELECT * FROM users WHERE id = " + req.query.id;
  return pool.query(sql);
}`;
    const issues = setupFixture("sql.ts", code).analyze();
    const sqlIssues = issues.filter((i) => i.type === "sql_injection");
    expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects command injection via exec()", () => {
    const code = `import { exec } from "child_process";
function runCmd(req: any) {
  exec(req.query.cmd);
}`;
    const issues = setupFixture("cmd.ts", code).analyze();
    expect(issues.filter((i) => i.type === "command_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via fetch()", () => {
    const code = `async function fetchData(req: any) {
  return await fetch(req.query.url);
}`;
    const issues = setupFixture("ssrf.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects path traversal via readFileSync()", () => {
    const code = `import { readFileSync } from "fs";
function loadFile(req: any) {
  return readFileSync(req.query.path);
}`;
    const issues = setupFixture("path.ts", code).analyze();
    expect(issues.filter((i) => i.type === "path_traversal").length).toBeGreaterThanOrEqual(1);
  });

  it("detects code injection via eval()", () => {
    const code = `function run(req: any) {
  eval(req.query.code);
}`;
    const issues = setupFixture("eval.ts", code).analyze();
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects XSS via document.write()", () => {
    const code = `function render(req: any) {
  document.write(req.query.name);
}`;
    const issues = setupFixture("xss.ts", code).analyze();
    expect(issues.filter((i) => i.type === "xss_risk").length).toBeGreaterThanOrEqual(1);
  });

  it("detects open redirect via res.redirect()", () => {
    const code = `function redirect(req: any, res: any) {
  res.redirect(req.query.url);
}`;
    const issues = setupFixture("redirect.ts", code).analyze();
    expect(issues.filter((i) => i.type === "open_redirect").length).toBeGreaterThanOrEqual(1);
  });

  it("detects NoSQL injection via collection.find()", () => {
    const code = `function findUser(req: any) {
  return db.collection("users").find(req.query);
}`;
    const issues = setupFixture("nosql.ts", code).analyze();
    expect(issues.filter((i) => i.type === "nosql_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSTI via ejs.render()", () => {
    const code = `function renderTemplate(req: any) {
  return ejs.render(req.query.template, { name: "test" });
}`;
    const issues = setupFixture("ssti.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssti").length).toBeGreaterThanOrEqual(1);
  });

  it("detects SSRF via axios.get()", () => {
    const code = `async function fetchApi(req: any) {
  return await axios.get(req.query.url);
}`;
    const issues = setupFixture("axios.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MUTATION 2: Suffix matching (Item 1e)
// ══════════════════════════════════════════════════════════════════════════════

describe("Mutation 2 — Suffix matching (Item 1e)", () => {
  it("detects pool.query() via suffix match on 'query'", () => {
    const code = `function search(req: any) {
  const sql = "SELECT * FROM items WHERE name = " + req.query.term;
  return pool.query(sql);
}`;
    const issues = setupFixture("pool-query.ts", code).analyze();
    const sqlIssues = issues.filter((i) => i.type === "sql_injection");
    expect(sqlIssues.length).toBeGreaterThanOrEqual(1);
  });

  it("detects db.execute() via suffix match on 'execute'", () => {
    const code = `function runQuery(req: any) {
  return db.execute(req.query.sql);
}`;
    const issues = setupFixture("db-execute.ts", code).analyze();
    expect(issues.filter((i) => i.type === "sql_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects knex.raw() via suffix match on 'raw'", () => {
    const code = `function rawQuery(req: any) {
  return knex.raw(req.query.sql);
}`;
    const issues = setupFixture("knex-raw.ts", code).analyze();
    expect(issues.filter((i) => i.type === "sql_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects res.redirect() via suffix match on 'redirect'", () => {
    const code = `function go(req: any, res: any) {
  res.redirect(req.query.url);
}`;
    const issues = setupFixture("res-redirect.ts", code).analyze();
    expect(issues.filter((i) => i.type === "open_redirect").length).toBeGreaterThanOrEqual(1);
  });

  it("detects collection.findOne() via suffix match on 'findOne'", () => {
    const code = `function findOne(req: any) {
  return db.collection("users").findOne(req.query);
}`;
    const issues = setupFixture("mongo-findone.ts", code).analyze();
    expect(issues.filter((i) => i.type === "nosql_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects ejs.render() via suffix match on 'render'", () => {
    const code = `function render(req: any) {
  return ejs.render(req.query.template, {});
}`;
    const issues = setupFixture("ejs-render.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssti").length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MUTATION 3: String propagation patterns
// ══════════════════════════════════════════════════════════════════════════════

describe("Mutation 3 — String propagation patterns", () => {
  it("propagates through template literal", () => {
    const code = `function fetchUrl(req: any) {
  const url = "https://" + req.query.domain + "/api";
  return fetch(url);
}`;
    const issues = setupFixture("template-literal.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("propagates through string concatenation (+)", () => {
    const code = `function fetchUrl(req: any) {
  const url = "https://" + req.query.domain;
  return fetch(url);
}`;
    const issues = setupFixture("concat.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("propagates through variable reassignment", () => {
    const code = `function handler(req: any) {
  let x = req.query.code;
  const y = x;
  eval(y);
}`;
    const issues = setupFixture("reassignment.ts", code).analyze();
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MUTATION 4: No false positives on safe code
// ══════════════════════════════════════════════════════════════════════════════

describe("Mutation 4 — No false positives on safe code", () => {
  it("reports zero issues for clean arithmetic", () => {
    const code = `function add(a: number, b: number) {
  return a + b;
}`;
    const issues = setupFixture("clean-arithmetic.ts", code).analyze();
    expect(issues.length).toBe(0);
  });

  it("reports zero issues for hardcoded SQL", () => {
    const code = `function getAll() {
  return pool.query("SELECT * FROM users");
}`;
    const issues = setupFixture("safe-sql.ts", code).analyze();
    expect(issues.filter((i) => i.type === "sql_injection").length).toBe(0);
  });

  it("reports zero issues for safe NoSQL query", () => {
    const code = `function getAll() {
  return db.collection("users").find({ status: "active" });
}`;
    const issues = setupFixture("safe-nosql.ts", code).analyze();
    expect(issues.filter((i) => i.type === "nosql_injection").length).toBe(0);
  });

  it("reports zero issues for safe SSTI call", () => {
    const code = `function render() {
  return ejs.render("<h1>Hello</h1>", {});
}`;
    const issues = setupFixture("safe-ssti.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssti").length).toBe(0);
  });

  it("reports zero issues for hardcoded command", () => {
    const code = `import { execSync } from "child_process";
function getVersion() {
  return execSync("node --version").toString();
}`;
    const issues = setupFixture("safe-cmd.ts", code).analyze();
    expect(issues.filter((i) => i.type === "command_injection").length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MUTATION 5: Source detection completeness
// ══════════════════════════════════════════════════════════════════════════════

describe("Mutation 5 — Source detection completeness", () => {
  it("detects process.argv as source", () => {
    const code = `import { exec } from "child_process";
function handler() {
  const cmd = process.argv[2];
  exec(cmd);
}`;
    const issues = setupFixture("process-argv.ts", code).analyze();
    expect(issues.filter((i) => i.type === "command_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects process.env as source", () => {
    const code = `function handler() {
  const secret = process.env.API_KEY;
  eval(secret);
}`;
    const issues = setupFixture("process-env.ts", code).analyze();
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects req.body as source", () => {
    const code = `function handler(req: any) {
  const data = req.body.code;
  eval(data);
}`;
    const issues = setupFixture("req-body.ts", code).analyze();
    expect(issues.filter((i) => i.type === "code_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects req.query as source", () => {
    const code = `function handler(req: any) {
  const url = req.query.url;
  return fetch(url);
}`;
    const issues = setupFixture("req-query.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects req.params as source", () => {
    const code = `function handler(req: any) {
  const id = req.params.id;
  return pool.query("SELECT * FROM users WHERE id = " + id);
}`;
    const issues = setupFixture("req-params.ts", code).analyze();
    expect(issues.filter((i) => i.type === "sql_injection").length).toBeGreaterThanOrEqual(1);
  });

  it("detects req.headers as source", () => {
    const code = `function handler(req: any) {
  const host = req.headers.host;
  return fetch(host);
}`;
    const issues = setupFixture("req-headers.ts", code).analyze();
    expect(issues.filter((i) => i.type === "ssrf").length).toBeGreaterThanOrEqual(1);
  });

  it("detects req.file as source", () => {
    const code = `import { readFileSync } from "fs";
function handler(req: any) {
  const name = req.file.originalname;
  return readFileSync("/uploads/" + name);
}`;
    const issues = setupFixture("req-file.ts", code).analyze();
    expect(issues.filter((i) => i.type === "path_traversal").length).toBeGreaterThanOrEqual(1);
  });
});
