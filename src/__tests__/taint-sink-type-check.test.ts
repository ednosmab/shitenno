import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TaintAnalyzer } from "../audit/taint/index.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-taint-type-"));
});

afterEach(() => {
  TaintAnalyzer.clearCache();
  rmSync(tempDir, { recursive: true, force: true });
});

function setupTaintFixture(code: string): TaintAnalyzer {
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

  writeFileSync(join(tempDir, "src", "type-sink-fixture.ts"), code);
  return new TaintAnalyzer({ projectRoot: tempDir });
}

/**
 * Regression: name-only sink matching treats Array.prototype.find() as a
 * NoSQL injection sink (the receiver type was never consulted).
 * See: PLANO-MESTRE-UNICO-v2-2026-08-01.md — Item 12
 */
describe("Taint sink receiver-type check (Item 12)", () => {
  it("NÃO marca Array.prototype.find() como sink NoSQL", () => {
    const analyzer = setupTaintFixture(
      `const arr = [1, 2, 3];\nconst found = arr.find((x) => x > 1);`
    );
    const issues = analyzer.analyze();
    expect(issues.filter((i) => i.type === "nosql_injection")).toHaveLength(0);
  });

  it("NÃO marca Array.prototype.filter()/findOne() de arrays nativos", () => {
    const analyzer = setupTaintFixture(
      `const items = ["a", "b"];\nconst hit = items.find((x) => x === "a");\nconst sub = items.filter((x) => x !== "a");`
    );
    const issues = analyzer.analyze();
    expect(issues.filter((i) => i.type === "nosql_injection")).toHaveLength(0);
  });

  it("AINDA marca collection.find() como sink NoSQL quando o tipo é de driver Mongo (any/desconhecido)", () => {
    const analyzer = setupTaintFixture(
      `async function run(filter: unknown) {\n  const doc = await db.collection("users").find(req.body.filter);\n  return doc;\n}\nconst req = { body: { filter: {} } };`
    );
    const issues = analyzer.analyze();
    expect(issues.some((i) => i.type === "nosql_injection")).toBe(true);
  });

  it("AINDA marca collection.findOne() com argumento taintado (suffix matching intacto)", () => {
    const analyzer = setupTaintFixture(
      `const doc = await db.collection("users").findOne(req.query);`
    );
    const issues = analyzer.analyze();
    expect(issues.some((i) => i.type === "nosql_injection")).toBe(true);
  });
});
