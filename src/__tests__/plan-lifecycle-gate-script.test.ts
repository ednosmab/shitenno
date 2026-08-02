import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkTests } from "../plan-lifecycle.js";

describe("checkTests — usa test:unit quando disponível, nunca a suíte pesada", () => {
  it("roda test:unit, não test, quando ambos existem", () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-script-"));
    try {
      // "test" está propositalmente quebrado (exit 1); "test:unit" passa.
      // Se checkTests() ainda chamar "test", este teste falha — é o canário
      // que impede a regressão descrita no BLOCO P.
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "gate-script-fixture",
          scripts: {
            test: 'node -e "process.exit(1)"',
            "test:unit": 'node -e "process.exit(0)"',
          },
        })
      );

      const result = checkTests(dir);
      expect(result.passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("cai de volta pra 'test' quando 'test:unit' não existe (projeto de terceiro)", () => {
    const dir = mkdtempSync(join(tmpdir(), "gate-script-fallback-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({
          name: "gate-script-fallback-fixture",
          scripts: { test: 'node -e "process.exit(0)"' },
        })
      );
      const result = checkTests(dir);
      expect(result.passed).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
