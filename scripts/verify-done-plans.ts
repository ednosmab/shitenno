import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const doneDir = join(process.cwd(), ".shitenno", "governance", "plans", "done");
let failed = false;

function checkForDirectDoneWrites(): boolean {
  try {
    const output = execSync(
      `grep -rn 'updateStatus([^,]*,\\\\s*["\\\\']done["\\\\']' src --include="*.ts" | grep -v "src/application/plan-lifecycle.ts" | grep -v "__tests__"`,
      { encoding: "utf-8" }
    );
    if (output.trim()) {
      console.error("❌ Chamada direta a updateStatus(..., \"done\") fora de plan-lifecycle.ts:");
      console.error(output);
      console.error("Toda escrita de 'done' deve passar por runAutoVerification ou por archivePlan/removePlan com um ValidationResult.");
      return false;
    }
    return true;
  } catch {
    return true; // grep sem match retorna exit code 1 — não é erro
  }
}

if (!checkForDirectDoneWrites()) {
  failed = true;
}

if (!existsSync(doneDir)) {
  if (failed) {
    console.error("\nCommit bloqueado: violação de regra de escrita direta de 'done'.");
    process.exit(1);
  }
  console.log("✅ No done/ directory found — nothing to verify");
  process.exit(0);
}

// Detecta quais planos em done/ estão sendo adicionados/alterados neste commit
let stagedDoneFiles: string[] = [];
try {
  stagedDoneFiles = execSync(
    "git diff --cached --name-only --diff-filter=ACM -- .shitenno/governance/plans/done",
    { encoding: "utf-8" }
  )
    .split("\n")
    .filter((f) => f.endsWith(".verification.json"))
    .map((f) => basename(f, ".verification.json"));
} catch { /* not in a git repo or no staged files */ }

for (const file of readdirSync(doneDir)) {
  if (!file.endsWith(".md")) continue;
  const planId = basename(file, ".md");
  const verificationPath = join(doneDir, `${planId}.verification.json`);

  if (!existsSync(verificationPath)) {
    console.error(`❌ ${planId}: done sem .verification.json — possivel bypass do pipeline`);
    failed = true;
    continue;
  }

  let record: { passed?: boolean; diffHash?: string };
  try {
    record = JSON.parse(readFileSync(verificationPath, "utf-8"));
  } catch {
    console.error(`❌ ${planId}: .verification.json invalido (JSON parse failed)`);
    failed = true;
    continue;
  }

  if (!record.passed) {
    console.error(`❌ ${planId}: .verification.json existe mas passed=false`);
    failed = true;
    continue;
  }

  // Para planos que estão sendo staged agora, verifica se o diffHash ainda bate
  if (stagedDoneFiles.includes(planId) && record.diffHash) {
    try {
      const stagedDiff = execSync(
        "git diff --cached HEAD -- . ':!.shitenno/governance/plans'",
        { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 }
      );
      const stagedHash = createHash("sha256").update(stagedDiff).digest("hex");
      if (stagedHash !== record.diffHash) {
        console.error(
          `❌ ${planId}: o código staged mudou desde a última verificação (diffHash não bate) — rode a verificação de novo antes de commitar.`
        );
        failed = true;
      }
    } catch { /* git diff not available */ }
  }
}

if (failed) {
  console.error("\nCommit bloqueado: plano(s) marcados 'done' sem prova de verificação válida.");
  process.exit(1);
}
console.log("✅ Todos os planos em done/ têm verification.json válido");
