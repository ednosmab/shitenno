import { detectHardcodedSecrets } from "../../src/audit/security/secrets.js";
import { detectWeakCrypto } from "../../src/audit/security/crypto.js";
import type { SourceFileInfo } from "../../src/audit/types/common.js";

let failed = false;

function makeFile(relPath: string, content: string): SourceFileInfo {
  return {
    fullPath: relPath,
    relPath,
    basename: relPath.split("/").pop() ?? relPath,
    content,
    lineCount: content.split("\n").length,
  };
}

// Leak regression: a REAL secret inside src/audit/security/ must be detected.
const leakFile = makeFile(
  "src/audit/security/analyzer.ts",
  'export const awsAccessKeyId = "AKIAIOSFODNN7EXAMPLE"; // AWS key real, não padrão de deteção',
);
const leakIssues = detectHardcodedSecrets(process.cwd(), [leakFile]);
if (leakIssues.length === 0) {
  console.error("❌ Segredo real em src/audit/security/analyzer.ts não foi detectado — regressão do self-exclusion voltou");
  failed = true;
}

// Leak regression: real weak crypto inside a security detector file must be detected.
const weakCryptoFile = makeFile(
  "src/audit/security/crypto.ts",
  'const hash = crypto.createHash("md5");',
);
const weakCryptoIssues = detectWeakCrypto(process.cwd(), [weakCryptoFile]);
if (weakCryptoIssues.length === 0) {
  console.error("❌ Weak crypto real em src/audit/security/crypto.ts não foi detectado");
  failed = true;
}

// Pattern-definition lines inside the closed set must still be skipped.
const patternFile = makeFile(
  "src/audit/taint/sinks.ts",
  `export const NOSQL_SINKS: TaintSinkDef[] = [
  { name: "find", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.find()" },
];`,
);
const patternIssues = detectHardcodedSecrets(process.cwd(), [patternFile]);
if (patternIssues.length > 0) {
  console.error("❌ Linha de definição de padrão foi reportada como segredo — exclusão por linha falhou");
  failed = true;
}

if (failed) {
  console.error("❌ Self-exclusion QUEBRADO");
  process.exit(1);
}
console.log("✅ Self-exclusion não está mais mascarando segredos reais (linha, não arquivo inteiro)");
