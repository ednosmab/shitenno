/**
 * generate-mutation-corpus.ts — Generate syntactic variant fixtures per sink
 *
 * Reads CORPUS_MANIFEST from the vuln-corpus and expands each category
 * into syntactic variants (import style × call style × line span × function boundary).
 *
 * Generated fixtures are written to src/audit/__fixtures__/mutation-corpus/
 * and consumed by the extended audit-level-matrix.test.ts.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase D.19
 */

import { CORPUS_MANIFEST } from "../../src/audit/__fixtures__/vuln-corpus/manifest.js";
import { findTaintSink } from "../../src/audit/taint/sinks.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type ImportStyle = "destructured" | "namespace";
type CallStyle = "bare" | "object-method";
type LineSpan = "single-line" | "multi-statement";
type FnBoundary = "same-function" | "cross-function-same-file";

interface MutationAxis {
  importStyle: ImportStyle;
  callStyle: CallStyle;
  lineSpan: LineSpan;
  fnBoundary: FnBoundary;
}

function validAxisCombinations(): MutationAxis[] {
  const combos: MutationAxis[] = [];
  for (const lineSpan of ["single-line", "multi-statement"] as LineSpan[]) {
    for (const fnBoundary of ["same-function", "cross-function-same-file"] as FnBoundary[]) {
      combos.push({ importStyle: "destructured", callStyle: "bare", lineSpan, fnBoundary });
      combos.push({ importStyle: "namespace", callStyle: "object-method", lineSpan, fnBoundary });
    }
  }
  return combos;
}

function renderFixture(sinkName: string, axis: MutationAxis): string {
  const importLine =
    axis.importStyle === "destructured"
      ? `import { ${sinkName} } from "example-lib";`
      : `import * as lib from "example-lib";`;

  const callExpr =
    axis.callStyle === "bare"
      ? `${sinkName}(payload)`
      : `lib.${sinkName}(payload)`;

  const buildPayload =
    axis.lineSpan === "single-line"
      ? `const payload = "prefix " + req.query.id;`
      : `let payload = "prefix ";\n  payload += req.query.id;`;

  if (axis.fnBoundary === "same-function") {
    return [
      importLine,
      `app.get("/x", (req, res) => {`,
      `  ${buildPayload}`,
      `  ${callExpr};`,
      `});`,
    ].join("\n");
  }

  return [
    importLine,
    `function helper(payload) { return ${callExpr}; }`,
    `app.get("/x", (req, res) => {`,
    `  ${buildPayload}`,
    `  helper(payload);`,
    `});`,
  ].join("\n");
}

/** Map corpus category dir names to the sink name used by findTaintSink */
const CATEGORY_TO_SINK: Record<string, string> = {
  "sql-injection": "query",
  "nosql-injection": "find",
  "prototype-pollution": "__proto__",
  "cors": "cors",
  "hardcoded-secrets": "eval",
  "open-redirect": "redirect",
  "ssti": "render",
};

function generateAll(outDir: string): void {
  let generated = 0;

  for (const entry of CORPUS_MANIFEST) {
    const sinkName = CATEGORY_TO_SINK[entry.dir] ?? entry.dir;
    const sinkDef = findTaintSink(sinkName);

    if (!sinkDef) {
      console.warn(`⚠️  No taint sink found for category "${entry.dir}" (sink: "${sinkName}") — skipping.`);
      continue;
    }

    for (const axis of validAxisCombinations()) {
      const dir = join(outDir, entry.dir, sinkDef.name);
      mkdirSync(dir, { recursive: true });

      const fname = `${axis.importStyle}_${axis.callStyle}_${axis.lineSpan}_${axis.fnBoundary}.ts`;
      writeFileSync(join(dir, fname), renderFixture(sinkDef.name, axis));
      generated++;
    }
  }

  console.log(`✅ Generated ${generated} mutation fixtures across ${CORPUS_MANIFEST.length} categories.`);
}

const outDir = join(process.cwd(), "src/audit/__fixtures__/mutation-corpus");
generateAll(outDir);
