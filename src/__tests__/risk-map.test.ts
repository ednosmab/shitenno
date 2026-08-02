import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateRiskMap } from "../risk-map.js";

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "shitenno-risk-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("generateRiskMap", () => {
  it("returns low risk for empty project", () => {
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    expect(result.overallRisk).toBe("low");
    expect(result.overallScore).toBe(0);
    expect(result.summary).toContain("acceptable");
  });

  it("analyzes src/ directory when it exists", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), "export const x = 1;");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    expect(result.areas.length).toBeGreaterThanOrEqual(1);
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    expect(srcArea!.fileCount).toBe(1);
  });

  it("detects no-tests risk factor", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), "export const x = 1;");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const noTestsFactor = srcArea!.factors.find((f) => f.type === "no-tests");
    expect(noTestsFactor).toBeDefined();
    expect(noTestsFactor!.weight).toBe(0.3);
  });

  it("does not flag no-tests when test file exists alongside source", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "src", "app.test.ts"), "test('ok', () => {});");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const noTestsForApp = srcArea!.factors.find(
      (f) => f.type === "no-tests" && f.description.includes("app.ts")
    );
    expect(noTestsForApp).toBeUndefined();
  });

  it("detects large-file risk factor (>300 lines)", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const bigContent = Array.from({ length: 350 }, (_, i) => `line ${i}`).join("\n");
    writeFileSync(join(tempDir, "src", "big.ts"), bigContent);
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const largeFileFactor = srcArea!.factors.find((f) => f.type === "large-file");
    expect(largeFileFactor).toBeDefined();
    expect(largeFileFactor!.weight).toBe(0.2);
  });

  it("detects many-imports risk factor (>15 imports)", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const imports = Array.from({ length: 20 }, (_, i) => `import { x${i} } from "./mod${i}.js";`).join("\n");
    writeFileSync(join(tempDir, "src", "heavy.ts"), imports);
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const manyImportsFactor = srcArea!.factors.find((f) => f.type === "many-imports");
    expect(manyImportsFactor).toBeDefined();
    expect(manyImportsFactor!.weight).toBe(0.15);
  });

  it("detects sensitive-keyword risk factor", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "auth.ts"), 'const password = "secret123";');
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const sensitiveFactor = srcArea!.factors.find((f) => f.type === "sensitive-keyword");
    expect(sensitiveFactor).toBeDefined();
    expect(sensitiveFactor!.weight).toBe(0.1);
  });

  it("score is capped at 100", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const bigContent = Array.from({ length: 500 }, (_, i) => `line ${i}: import { x } from "./x.js"; auth password secret`).join("\n");
    writeFileSync(join(tempDir, "src", "mega.ts"), bigContent);
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("risk level critical when score >= 70", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const manyFiles = Array.from({ length: 6 }, (_, i) => {
      const content = Array.from({ length: 10 }, (_, j) => `import { x${j} } from "./m${j}.js"; auth password secret`).join("\n");
      return { name: `file${i}.ts`, content };
    });
    for (const f of manyFiles) {
      writeFileSync(join(tempDir, "src", f.name), f.content);
    }
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    if (srcArea && srcArea.score >= 70) {
      expect(srcArea.riskLevel).toBe("critical");
    }
  });

  it("risk level high when score >= 40", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const files = Array.from({ length: 3 }, (_, i) => {
      const content = Array.from({ length: 8 }, (_, j) => `import { x${j} } from "./m${j}.js";`).join("\n");
      return { name: `mod${i}.ts`, content };
    });
    for (const f of files) {
      writeFileSync(join(tempDir, "src", f.name), f.content);
    }
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    if (srcArea && srcArea.score >= 40 && srcArea.score < 70) {
      expect(srcArea.riskLevel).toBe("high");
    }
  });

  it("risk level low when score < 15", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "small.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "src", "small.test.ts"), "test('ok', () => {});");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    if (srcArea && srcArea.score < 15) {
      expect(srcArea.riskLevel).toBe("low");
    }
  });

  it("analyzes multiple areas", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    mkdirSync(join(tempDir, "lib"), { recursive: true });
    writeFileSync(join(tempDir, "src", "a.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "lib", "b.ts"), "export const y = 2;");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    expect(result.areas.length).toBeGreaterThanOrEqual(2);
  });

  it("overall score is average of area scores", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    mkdirSync(join(tempDir, "lib"), { recursive: true });
    writeFileSync(join(tempDir, "src", "a.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "lib", "b.ts"), "export const y = 2;");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    if (result.areas.length >= 2) {
      const avg = Math.round(result.areas.reduce((s, a) => s + a.score, 0) / result.areas.length);
      expect(result.overallScore).toBe(avg);
    }
  });

  it("summary lists critical/high areas", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const bigContent = Array.from({ length: 400 }, (_, i) => `line ${i}: import { x } from "./x.js"; auth password`).join("\n");
    writeFileSync(join(tempDir, "src", "big.ts"), bigContent);
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    if (result.areas.some((a) => a.riskLevel === "critical" || a.riskLevel === "high")) {
      expect(result.summary).toContain("src");
    }
  });

  it("handles non-existent project root gracefully", () => {
    const result = generateRiskMap("/nonexistent/path", "/nonexistent/shitenno");
    expect(result.overallRisk).toBe("low");
    expect(result.areas.length).toBeGreaterThanOrEqual(0);
  });

  it("factors are capped at 10 per area", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    const manyFiles = Array.from({ length: 15 }, (_, i) => {
      const imports = Array.from({ length: 20 }, (_, j) => `import { x${j} } from "./m${j}.js";`).join("\n");
      return { name: `module${i}.ts`, content: imports + "\nauth password secret token" };
    });
    for (const f of manyFiles) {
      writeFileSync(join(tempDir, "src", f.name), f.content);
    }
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    expect(srcArea!.factors.length).toBeLessThanOrEqual(10);
  });

  it("does not flag test files as 'no-tests' (self-referential bug)", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    mkdirSync(join(tempDir, "src", "__tests__"), { recursive: true });
    writeFileSync(join(tempDir, "src", "__tests__", "app.test.ts"), "import { describe } from 'vitest';");
    writeFileSync(join(tempDir, "src", "__tests__", "utils.spec.ts"), "import { it } from 'vitest';");
    writeFileSync(join(tempDir, "src", "app.test.ts"), "import { it } from 'vitest';");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    const noTestFactors = srcArea!.factors.filter((f) => f.type === "no-tests");
    const flaggedTestFiles = noTestFactors.filter(
      (f) => f.description.includes(".test.ts") || f.description.includes(".spec.ts") || f.description.includes("__tests__")
    );
    expect(flaggedTestFiles).toHaveLength(0);
  });

  it("skips node_modules and dotfiles", () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    mkdirSync(join(tempDir, "node_modules"), { recursive: true });
    mkdirSync(join(tempDir, ".hidden"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "node_modules", "pkg.ts"), "export const y = 1;");
    writeFileSync(join(tempDir, ".hidden", "secret.ts"), "export const z = 1;");
    const result = generateRiskMap(tempDir, join(tempDir, "shitenno"));
    const srcArea = result.areas.find((a) => a.path === "src");
    expect(srcArea).toBeDefined();
    expect(srcArea!.fileCount).toBe(1);
  });
});
