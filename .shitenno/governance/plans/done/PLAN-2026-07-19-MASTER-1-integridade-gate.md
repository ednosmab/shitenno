# PLAN-2026-07-19 — MASTER 1/3: Status Geral + Integridade do Gate

**Status:** Done
**Updated_at:** 2026-07-22T04:11:16.473Z
**Date:** 2026-07-21

**Consolida e substitui:** todos os blocos anteriores (correcoes-cirurgicas A-D, F v1/v2, G, H, I, J, L). Esta é a versão de referência única daqui pra frente — os arquivos antigos podem ser arquivados depois que este for repassado ao agente.

**Base de verificação:** comparação direta entre o zip original (`shitenno-feat-audit.zip`) e o zip atualizado (`shitenno-feat-audit__1_.zip`), item por item, lendo o código real — não assumindo que "o plano foi passado" significa "foi implementado".

---

## Status geral — o que já está resolvido (não precisa de ação)

| Item | Status |
|---|---|
| B.1 — bug de linha `:1` no complexity analyzer | ✅ `getStart(sourceFile)` corrigido |
| B.3.1 — regex de import type no detector de ciclos | ✅ filtra antes de rodar |
| B.4 — ciclo `event-bus`/`advanced-infrastructure` | ✅ `import type` puro |
| B.5 — remover `node-pty` | ✅ fora do `package.json` |
| Bloco D — `check-file-size.sh` no CI | ✅ `--report-only` wired |
| F.2.1 — `moveToDone()` arrasta sidecar | ✅ implementado |
| F.6 — hook de pre-commit | ✅ existe, mais completo que o desenho original (lint+typecheck+sync:docs+verify-done-plans) |
| G.2 — `audit-done-integrity.ts` | ✅ usa `git cat-file -e` corretamente |
| E.1 — fusão `policy-engine` → `rule-engine/policy.ts` | ✅ shim de 4 linhas no lugar do arquivo de 430 |
| H.1 — teste de scaffold em diretório limpo | ✅ presente em `cli-integration.test.ts` |
| H.2 — matriz de CI (ubuntu/macos/windows) | ✅ |
| H.3 — `notify.ts` cross-platform | ✅ |
| H.4 — protocolo de validação (`VALIDATION_LOG.md`) | ✅ estrutura pronta — **falta o passo humano**: nenhuma validação real registrada ainda, só o template |

## Status geral — o que ainda precisa de trabalho (este documento cobre tudo abaixo)

| Item | Onde | Prioridade |
|---|---|---|
| M.1 — `detectStaleVerification` com bug de igualdade estrita | **Regressão ativa, rodando agora** | 🔴 Urgente |
| M.2 — `diffHash`/`baseCommit` ainda não existe (só `commitHash`) | `plan-lifecycle.ts` | 🔴 Alta |
| M.3 — `checkGateIntegrity`/teste de gate (F.8) não existe | novo | 🟡 Média |
| M.4 — `md-done.ts` é um 4º caminho de bypass sem gate nenhum | `commands/plan/md-done.ts` | 🔴 Urgente |
| M.5 — `archivePlan`/`removePlan` não gravam `.verification.json` | `plan-lifecycle.ts` | 🔴 Alta |
| M.6 — `task-completion-pipeline.ts` tem `archivePlan` local que não passa por gate nenhum | `task-completion-pipeline.ts` | 🔴 Alta |
| M.7 — guarda de processo contra novos bypasses (grep no pre-commit) | `scripts/verify-done-plans.ts` | 🟡 Média |
| M.8 — `ActionEngine.execute` não delega pra `invokeAction` (B.2) | `action-engine.ts` | 🟡 Média — Parte 2 |
| M.9 — migração de backlog continua quebrada (`ACTIVE.md` vazio) | `scripts/migrate-backlog.ts` | 🟡 Média — Parte 2 |
| M.10 — `checkBuild`/`checkTests`/`checkLint` hardcoded em pnpm/vitest | `plan-lifecycle.ts` | 🔴 Alta — Parte 2 |
| M.11 — barrel de `engineering-state/` incompleto | `engineering-state/index.ts` | 🟢 Baixa — Parte 3 |
| M.12 — testes E2E de comando Tier 1 (act/plan/decide/hooks/update/clean/sync) | `cli-integration.test.ts` | 🟢 Baixa — Parte 3 |
| M.13 — branch protection (G.1) | Configuração, fora do código | 🟢 Baixa — Parte 3 |

**Este arquivo (Parte 1/3) cobre M.1 a M.7 — integridade do gate de `done`, que é o núcleo de tudo que essa auditoria inteira protegeu até aqui.** Parte 2 cobre M.8-M.10 (correção de dados e checks). Parte 3 cobre M.11-M.13 (estrutura e cobertura de teste).

---

## M.1 — Corrigir a regressão ativa em `detectStaleVerification` (URGENTE)

**Ficheiro real:** `src/audit/detect-stale-verification.ts` (não `src/audit/detectors/...` como um plano anterior supôs — confirmado no zip atual)

**O problema, confirmado rodando no código deles agora:**

```typescript
// ATUAL — código com o bug de auto-referência que identificamos nesta conversa:
if (status.commitHash !== currentHead) {
  issues.push({
    type: "governance_integrity",
    severity: 1,
    description: `Última verificação foi no commit ${String(status.commitHash).slice(0, 7)}, HEAD atual é ${currentHead.slice(0, 7)} — pode estar desatualizada.`,
    location: "governance/last-verify.json",
    recommendation: "Execute 'shugo audit --level code-review --full-sweep' para verificar com o commit atual.",
  });
}
```

`status.commitHash` é sempre o HEAD de **antes** do commit que grava o arquivo — nunca pode ser igual ao HEAD atual depois que esse commit acontece. Essa condição é verdadeira **sempre**, em **todo** plano, a partir do primeiro commit depois da verificação. É ruído 100% do tempo, não um sinal real.

**Correção — usar ancestralidade, não igualdade** (nota: o schema real de `HealthIssue` neste projeto é `{ type: HealthIssueType, severity: 1|2|3, description, location, recommendation }` — `HealthIssueType` é uma união fechada em `src/audit/types.ts`; `"governance_integrity"` já está registrada lá, não precisa adicionar de novo):

```typescript
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import type { HealthIssue } from "./types.js";

export function detectStaleVerification(projectRoot: string, shitennoDir: string): HealthIssue[] {
  const statusPath = join(shitennoDir, "governance", "last-verify.json");

  if (!existsSync(statusPath)) {
    return [{
      type: "governance_integrity",
      severity: 2,
      description: "Nenhum verify:all registrado ainda — rode 'shugo audit --level code-review --full-sweep' antes do próximo plan close.",
      location: "governance/last-verify.json",
      recommendation: "Execute 'shugo audit --level code-review --full-sweep' para registrar uma verificação completa.",
    }];
  }

  const status = JSON.parse(readFileSync(statusPath, "utf-8"));
  let currentHead: string;
  try {
    currentHead = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8" }).trim();
  } catch {
    return [];
  }

  const issues: HealthIssue[] = [];

  // CORREÇÃO: ancestralidade, não igualdade. baseCommit nunca pode ser igual
  // ao HEAD do commit que contém o arquivo que o registra — é auto-referência
  // impossível (hash de commit é endereçado por conteúdo, só existe depois
  // que a árvore, incluindo este arquivo, já fechou). "Desatualizado" precisa
  // significar "o histórico foi reescrito desde então" (rebase/reset), não
  // "é diferente do HEAD atual" — isso é sempre verdadeiro por construção e
  // gera ruído em 100% dos planos, o que estava acontecendo até agora.
  let isAncestor = true;
  try {
    execSync(`git merge-base --is-ancestor ${status.commitHash} HEAD`, { cwd: projectRoot, stdio: "pipe" });
  } catch {
    isAncestor = false;
  }

  if (!isAncestor) {
    issues.push({
      type: "governance_integrity",
      severity: 1,
      description: `Última varredura completa (commit ${String(status.commitHash).slice(0, 7)}) não é mais ancestral do HEAD atual (${currentHead.slice(0, 7)}) — provável rebase/reset que invalida o registro.`,
      location: "governance/last-verify.json",
      recommendation: "Execute 'shugo audit --level code-review --full-sweep' novamente.",
    });
  }

  if (status.passed === false) {
    issues.push({
      type: "governance_integrity",
      severity: 3,
      description: `verify:all falhou na última execução (${status.timestamp}) e ainda não foi corrigido.`,
      location: "governance/last-verify.json",
      recommendation: "Corrija os problemas de build/test/lint e execute 'shugo audit --level code-review --full-sweep' novamente.",
    });
  }

  return issues;
}
```

**Nota:** aqui o campo continua se chamando `commitHash` (não `baseCommit`) porque `last-verify.json` é um artefato diferente de `.verification.json` — registra "quando rodou a última varredura completa do repo", não "este plano específico foi verificado". Essa distinção de propósito é intencional; ver M.2 para o campo equivalente em `.verification.json`, que sim precisa de `diffHash`.

**Critério de aceite:** rodar `shugo audit --level code-review` logo depois de um `--full-sweep` bem-sucedido e um commit → zero achados `governance_integrity` de tipo "desatualizada". Fazer um `git reset --hard` pra um commit anterior ao registrado → achado aparece.

---

## M.2 — `diffHash`/`baseCommit` no `.verification.json` (resolve o problema de auto-referência na raiz)

**Ficheiro:** `src/plan-lifecycle.ts`

**Import novo necessário no topo:** `import { createHash } from "node:crypto";`

```typescript
// ANTES (linhas 189-215 no arquivo atual):
export interface VerificationRecord {
  planId: string;
  commitHash: string;
  checks: CompletionCheck[];
  passed: boolean;
  timestamp: string;
}

export function runAutoVerification(
  shitennoDir: string,
  projectRoot: string,
  planId: string
): VerificationRecord {
  const checks = [checkBuild(projectRoot), checkTests(projectRoot), checkLint(projectRoot)];
  const passed = checks.every((c) => c.passed);
  let commitHash = "unknown";
  try {
    commitHash = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }).trim();
  } catch { /* not in a git repo or git unavailable */ }

  const record: VerificationRecord = {
    planId,
    commitHash,
    checks,
    passed,
    timestamp: new Date().toISOString(),
  };
  // ...

// DEPOIS:
export interface VerificationRecord {
  planId: string;
  baseCommit: string; // contexto/depuração — NÃO usar para validar (auto-referência impossível)
  diffHash: string;   // ancoragem real: sha256 do diff de código no momento da verificação
  checks: CompletionCheck[];
  passed: boolean;
  timestamp: string;
}

// Exclui os próprios arquivos de governança de plano do escopo do hash —
// senão o .verification.json cairia no mesmo problema de auto-referência
// um nível abaixo (não pode atestar um conteúdo que inclui a si mesmo).
function computeDiffHash(projectRoot: string): string {
  const diffOutput = execSync(`git diff HEAD -- . ':!.shitenno/governance/plans'`, {
    cwd: projectRoot,
    encoding: "utf-8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return createHash("sha256").update(diffOutput).digest("hex");
}

export function runAutoVerification(
  shitennoDir: string,
  projectRoot: string,
  planId: string
): VerificationRecord {
  const checks = [checkBuild(projectRoot), checkTests(projectRoot), checkLint(projectRoot)];
  const passed = checks.every((c) => c.passed);
  let baseCommit = "unknown";
  try {
    baseCommit = execSync("git rev-parse HEAD", { cwd: projectRoot, encoding: "utf-8", timeout: 5000 }).trim();
  } catch { /* not in a git repo or git unavailable */ }
  const diffHash = computeDiffHash(projectRoot);

  const record: VerificationRecord = {
    planId,
    baseCommit,
    diffHash,
    checks,
    passed,
    timestamp: new Date().toISOString(),
  };
  // ... resto do corpo da função permanece igual (grava sidecar, updateStatus, etc.)
```

**Ficheiro:** `scripts/verify-done-plans.ts` — estender pra reconferir `diffHash` só nos planos que estão sendo adicionados/alterados **neste** commit (planos antigos, já commitados, têm `diffHash` histórico que naturalmente não bate mais com o código atual — isso é esperado, não é erro):

```typescript
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const doneDir = join(process.cwd(), ".shitenno", "governance", "plans", "done");
let failed = false;

if (!existsSync(doneDir)) {
  console.log("✅ No done/ directory found — nothing to verify");
  process.exit(0);
}

const stagedDoneFiles = execSync(
  "git diff --cached --name-only --diff-filter=ACM -- .shitenno/governance/plans/done",
  { encoding: "utf-8" }
)
  .split("\n")
  .filter((f) => f.endsWith(".verification.json"))
  .map((f) => basename(f, ".verification.json"));

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

  if (stagedDoneFiles.includes(planId) && record.diffHash) {
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
  }
}

if (failed) {
  console.error("\nCommit bloqueado: plano(s) marcados 'done' sem prova de verificação válida.");
  process.exit(1);
}
console.log("✅ Todos os planos em done/ têm verification.json válido");
```

**Critério de aceite:** rodar a verificação, editar mais uma linha de código, tentar commitar → pre-commit bloqueia por `diffHash` não bater (cenário que a versão anterior, baseada só em existência do sidecar, deixava passar completamente).

---

## M.3 — `checkGateIntegrity` + teste de gate (F.8) — ainda não existe

**Ficheiro:** `src/plan-lifecycle.ts` — adicionar ao array de checks dentro de `runAutoVerification` (ver M.2 acima, é o mesmo bloco de código, adicionar uma 4ª entrada):

```typescript
const checks = [
  checkBuild(projectRoot),
  checkTests(projectRoot),
  checkLint(projectRoot),
  checkGateIntegrity(projectRoot),
];
```

```typescript
export function checkGateIntegrity(projectRoot: string): CompletionCheck {
  try {
    execSync("npx vitest run src/__tests__/plan-lifecycle-gate-e2e.test.ts --reporter=dot", {
      cwd: projectRoot,
      timeout: 30000,
      stdio: "pipe",
    });
    return { name: "GATE_SELF_TEST", passed: true, message: "Gate de done verificado (caso positivo + negativo)" };
  } catch (err) {
    return {
      name: "GATE_SELF_TEST",
      passed: false,
      message: `Mecanismo de done comprometido — não confiar em nenhuma verificação até corrigir: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

**Novo ficheiro:** `src/__tests__/plan-lifecycle-gate-e2e.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

vi.mock("../plan-lifecycle.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../plan-lifecycle.js")>();
  return { ...actual, checkBuild: vi.fn(), checkTests: vi.fn(), checkLint: vi.fn() };
});

import { MarkdownPlanEngine } from "../markdown-plan-engine.js";
import { runAutoVerification, checkBuild, checkTests, checkLint } from "../plan-lifecycle.js";

describe("Bloco F — gate de done, caso positivo, negativo e invalidação por diffHash", () => {
  let dir: string;
  let shitennoDir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `shugo-gate-e2e-${Date.now()}`);
    shitennoDir = join(dir, ".shitenno");
    mkdirSync(shitennoDir, { recursive: true });
    execSync("git init -q", { cwd: dir });
    writeFileSync(join(dir, "app.ts"), "export const version = 1;\n");
    execSync("git add -A && git commit -q -m init", { cwd: dir });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("caso positivo: build+test+lint passam → done/ com sidecar co-localizado e diffHash consistente", () => {
    (checkBuild as any).mockReturnValue({ name: "BUILD", passed: true, message: "ok" });
    (checkTests as any).mockReturnValue({ name: "TESTS", passed: true, message: "ok" });
    (checkLint as any).mockReturnValue({ name: "LINT", passed: true, message: "ok" });
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create("Plano de teste — caso positivo");
    engine.updateStatus(plan.id, "check");

    const record = runAutoVerification(shitennoDir, dir, plan.id);
    const expectedDiff = execSync(`git diff HEAD -- . ':!.shitenno/governance/plans'`, { cwd: dir, encoding: "utf-8" });
    const expectedHash = createHash("sha256").update(expectedDiff).digest("hex");

    const doneMd = join(shitennoDir, "governance", "plans", "done", `${plan.id}.md`);
    const doneJson = join(shitennoDir, "governance", "plans", "done", `${plan.id}.verification.json`);
    expect(existsSync(doneMd)).toBe(true);
    expect(existsSync(doneJson)).toBe(true);
    expect(record.checks.map((c) => c.name)).toEqual(expect.arrayContaining(["BUILD", "TESTS", "LINT"]));
    expect(record.passed).toBe(true);
    expect(record.diffHash).toBe(expectedHash);
  });

  it("caso negativo: um check falha → blocked, NÃO vai para done/, sidecar não existe", () => {
    (checkBuild as any).mockReturnValue({ name: "BUILD", passed: true, message: "ok" });
    (checkTests as any).mockReturnValue({ name: "TESTS", passed: false, message: "1 teste falhou" });
    (checkLint as any).mockReturnValue({ name: "LINT", passed: true, message: "ok" });

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create("Plano de teste — caso negativo");
    engine.updateStatus(plan.id, "check");

    const record = runAutoVerification(shitennoDir, dir, plan.id);

    expect(record.passed).toBe(false);
    expect(engine.getById(plan.id).status).toBe("blocked");
    expect(existsSync(join(shitennoDir, "governance", "plans", "done", `${plan.id}.md`))).toBe(false);
    expect(existsSync(join(shitennoDir, "governance", "plans", "done", `${plan.id}.verification.json`))).toBe(false);
  });

  it("caso de invalidação: código muda depois da verificação → diffHash staged não bate mais", () => {
    (checkBuild as any).mockReturnValue({ name: "BUILD", passed: true, message: "ok" });
    (checkTests as any).mockReturnValue({ name: "TESTS", passed: true, message: "ok" });
    (checkLint as any).mockReturnValue({ name: "LINT", passed: true, message: "ok" });

    const engine = new MarkdownPlanEngine(shitennoDir);
    const plan = engine.create("Plano de teste — invalidação por diffHash");
    engine.updateStatus(plan.id, "check");
    writeFileSync(join(dir, "app.ts"), "export const version = 2;\n");

    const record = runAutoVerification(shitennoDir, dir, plan.id);

    writeFileSync(join(dir, "app.ts"), "export const version = 3;\n");
    execSync("git add -A", { cwd: dir });
    const stagedDiff = execSync(`git diff --cached HEAD -- . ':!.shitenno/governance/plans'`, { cwd: dir, encoding: "utf-8" });
    const stagedHash = createHash("sha256").update(stagedDiff).digest("hex");

    expect(stagedHash).not.toBe(record.diffHash);
  });
});
```

**Critério de aceite:** os três testes passam isolados; `runAutoVerification` num plano qualquer gera `checks` com 4 entradas, incluindo `GATE_SELF_TEST: passed:true`.

---

## M.4 — `md-done.ts`: o 4º caminho de bypass (URGENTE, achado nesta auditoria, ainda sem fix)

**Ficheiro:** `src/commands/plan/md-done.ts`

```typescript
// ATUAL — comando de primeira classe, zero validação:
export function registerMdDone(cmd: import("commander").Command) {
  cmd
    .command("done")
    .description("Mark markdown plan as done and move to done/")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const engine = new MarkdownPlanEngine(join(ctx.projectRoot, SHITENNO_DIR_NAME));
      try {
        const updated = engine.updateStatus(id, "done"); // <-- bypass total do gate
        // ...
```

**Decisão de design necessária antes de codar:** este comando precisa deixar de existir como "atalho direto pra done" e virar um disparador do pipeline real. Duas opções:

- **Opção A (recomendada):** `plan md done <id>` passa a rodar `runAutoVerification` — mesma função usada pelo daemon e por `close-session.ts` — em vez de `updateStatus` direto.
- **Opção B**, se o comando precisa continuar existindo como "forçar done sem checar" pra casos excepcionais: renomear pra algo explícito (`plan md force-done`) e exigir uma flag de confirmação (`--i-know-this-skips-verification`), pra nenhum agente/humano fazer isso por engano ou hábito.

```typescript
// Depois (Opção A):
import { runAutoVerification } from "../../plan-lifecycle.js";
import { SHITENNO_DIR_NAME } from "../../constants.js";

export function registerMdDone(cmd: import("commander").Command) {
  cmd
    .command("done")
    .description("Run verification (build+test+lint) and, if it passes, mark plan as done")
    .argument("<id>", "Plan ID")
    .option("--json", "Output as JSON")
    .action((id: string, opts: Record<string, unknown>) => {
      const isJson = opts.json === true;
      const ctx = guardNotInitialized(opts, isJson);
      if (!ctx) return;

      const shitennoDir = join(ctx.projectRoot, SHITENNO_DIR_NAME);
      try {
        const record = runAutoVerification(shitennoDir, ctx.projectRoot, id);
        if (isJson) {
          outputJson(record as unknown as Record<string, unknown>);
        } else if (record.passed) {
          output(chalk.green(`  ✓ Plan verified and marked as done: ${id}`));
          output(chalk.dim(`    Moved to done/ directory`));
        } else {
          const failed = record.checks.filter((c) => !c.passed).map((c) => c.name).join(", ");
          output(chalk.red(`  ✗ Plan blocked — failed checks: ${failed}`));
        }
      } catch (error) {
        if (isJson) outputJson({ error: error instanceof Error ? error.message : String(error) });
        else output(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
}
```

**Efeito colateral a comunicar:** isso muda o comportamento observável do comando — hoje é instantâneo, depois da mudança roda build+teste+lint (pode levar minutos). É a troca certa (rapidez não vale nada se o resultado não significa nada), mas documentar no changelog como breaking change de UX, não só de código.

**Critério de aceite:** `shugo plan md done <id>` num plano com teste quebrado de propósito → não move pra `done/`, reporta os checks que falharam, `.md` continua em `plans/` com status `blocked`.

---

## M.5 — `archivePlan`/`removePlan` precisam gravar `.verification.json`

**Ficheiro:** `src/plan-lifecycle.ts`, linhas 243-251 atuais

```typescript
// Antes:
export function archivePlan(shitennoDir: string, planId: string): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");
}

export function removePlan(shitennoDir: string, planId: string): void {
  const engine = new MarkdownPlanEngine(shitennoDir);
  engine.updateStatus(planId, "done");
}

// Depois:
export function archivePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);

    if (validation) {
      const plansDir = join(shitennoDir, "governance", "plans");
      let baseCommit = "unknown";
      try {
        baseCommit = execSync("git rev-parse HEAD", { cwd: shitennoDir, encoding: "utf-8", timeout: 5000 }).trim();
      } catch { /* not a git repo */ }

      writeFileSync(
        join(plansDir, `${planId}.verification.json`),
        JSON.stringify(
          { planId, baseCommit, checks: validation.checks, passed: validation.valid, timestamp: new Date().toISOString() },
          null, 2
        ),
        "utf-8"
      );
    }

    engine.updateStatus(planId, "done");
    return true;
  } catch {
    return false;
  }
}

export function removePlan(shitennoDir: string, planId: string, validation?: ValidationResult): boolean {
  return archivePlan(shitennoDir, planId, validation); // mesmo contrato — "remove" também é "done" no fluxo atual
}
```

**Nos três call sites dentro de `runLifecycleReview` (linhas 355, 385, 400 no arquivo atual) — `validation` já existe no escopo, vem de `runValidationWithProgress` na linha 333:**

```typescript
// Linha 355 (modo automático) e 385 (modo interativo "A"):
// Antes: archivePlan(shitennoDir, inf.id);
// Depois:
archivePlan(shitennoDir, inf.id, validation);

// Linha 400 (modo interativo "R"):
// Antes: removePlan(shitennoDir, inf.id);
// Depois:
removePlan(shitennoDir, inf.id, validation);
```

**Nota:** `validation` é opcional de propósito — se um chamador futuro invocar sem ter rodado verificação nenhuma, o comportamento é "grava done sem sidecar", que o pre-commit (M.2) já pega como bloqueio. Melhor bloquear um caminho não auditado do que deixá-lo passar silenciosamente.

**Critério de aceite:** `shugo plan md lifecycle`, escolher `[A]` num plano que passa em todos os checks → vai pra `done/` **com** `.verification.json` ao lado, pre-commit não bloqueia o commit seguinte.

---

## M.6 — `task-completion-pipeline.ts`: o `archivePlan` local, não o de `plan-lifecycle.ts`

**Correção de diagnóstico importante:** uma versão anterior deste plano tentava consertar isso editando `plan-lifecycle.ts::archivePlan` — errado. `task-completion-pipeline.ts` tem sua **própria função local**, com o mesmo nome, que não importa nada de `plan-lifecycle.ts`:

```typescript
// ATUAL, linha 86 — função local, roda um SUBPROCESSO da CLI:
function archivePlan(projectRoot: string, planId: string): boolean {
  execFileSync("node", ["dist/shugo.js", "plan", "md", "done", planId], {
    cwd: projectRoot, timeout: 30000, encoding: "utf-8", stdio: "pipe",
    env: { ...process.env, SHITENNO_CHILD: "1" },
  });
  // ...
}
```

**Boa notícia:** depois do fix de M.4, esse subprocesso (`plan md done`) já passa a rodar `runAutoVerification` de verdade — então esse caminho fica automaticamente corrigido só com o M.4, **sem precisar editar este arquivo**. É um caso raro onde consertar a causa raiz (o comando CLI) resolve o sintoma (quem chama o comando) de graça.

**O que ainda vale ajustar aqui, não por segurança, mas por eficiência:** rodar verificação via subprocesso CLI spawna um processo Node inteiro, que por sua vez roda build+test+lint — se o pipeline de conclusão de tarefa **já rodou** os gates via `validateCompletionGate` (linha 122, antes de chegar em `archivePlan`), rodar tudo de novo dentro do subprocesso é redundante. Vale trocar a chamada de subprocesso por uma chamada em-processo, reaproveitando o resultado que `gates` já tem:

```typescript
// Ficheiro: src/task-completion-pipeline.ts
// Remove a função local archivePlan (linha 86) inteira, importa a real:
import { archivePlan as archivePlanReal, type ValidationResult } from "./plan-lifecycle.js";
import { SHITENNO_DIR_NAME } from "./constants.js";
import { join } from "node:path";

// No ponto de uso (linha ~191):
// Antes:
// planArchived = archivePlan(projectRoot, planId);

// Depois — reaproveita os gates que já rodaram em validateCompletionGate,
// sem rodar build/test/lint uma segunda vez:
const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
const validationResult: ValidationResult = {
  valid: gates.passed,
  checks: gates.gates.map((g) => ({ name: g.name.toUpperCase(), passed: g.passed, message: g.message })),
};
planArchived = archivePlanReal(shitennoDir, planId, validationResult);
```

Como esse ponto do código só é alcançado se `gates.passed === true` (linha 131 já retorna cedo se `!gates.passed`), o `.verification.json` gravado aqui sempre reflete `passed: true` de verdade.

**Critério de aceite:** `npx tsc --noEmit` limpo; rodar o pipeline de conclusão de tarefa num projeto de teste → `.verification.json` aparece ao lado do plano arquivado, sem precisar rodar um segundo processo Node.

---

## M.7 — Guarda de processo: grep contra novos caminhos de `done`

**Ficheiro:** `scripts/verify-done-plans.ts` — adicionar, além da checagem de `diffHash` do M.2:

```typescript
function checkForDirectDoneWrites(): boolean {
  try {
    const output = execSync(
      `grep -rn 'updateStatus([^,]*,\\s*["\\']done["\\']' src --include="*.ts" | grep -v "src/plan-lifecycle.ts" | grep -v "__tests__"`,
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
    return true; // grep sem match retorna exit code 1 — não é erro, é "nada encontrado" (bom)
  }
}

// No fluxo principal do script, antes do "if (failed)" final:
if (!checkForDirectDoneWrites()) {
  failed = true;
}
```

**Validação retroativa desta auditoria:** rodei esse grep contra o código real antes de escrever este plano — hoje ele aponta exatamente um resultado, `src/commands/plan/md-done.ts:26`, que é o M.4. Depois do M.4 corrigido, o grep deve voltar vazio; esse script é o que garante que fique vazio daqui pra frente.

**Critério de aceite:** adicionar propositalmente um `engine.updateStatus(id, "done")` num arquivo novo qualquer fora de `plan-lifecycle.ts` → `git commit` bloqueia e aponta o arquivo/linha exatos.

---

## Ordem de execução desta parte (1/3)

1. **M.1** primeiro — é regressão ativa gerando ruído agora, correção isolada e rápida.
2. **M.4** — é o bypass mais grave (comando de primeira classe, zero fricção pra usar por engano).
3. **M.5** — pré-requisito de dados pro M.6 funcionar sem redundância.
4. **M.2** — muda o schema de `VerificationRecord`; fazer depois de M.5 pra não editar o mesmo tipo duas vezes em paralelo.
5. **M.6** — depende de M.4 (resolve de graça) e M.5 (usa o novo contrato de `archivePlan`).
6. **M.3** — depende de M.2 (o teste de invalidação usa `diffHash`).
7. **M.7** — por último, como rede de segurança sobre tudo que os itens anteriores corrigiram.

Depois de cada item: `npm run build && npx vitest run`.

**Continua em `PLAN-2026-07-19-MASTER-2-correcao-dados-e-checks.md` (M.8-M.10) e `PLAN-2026-07-19-MASTER-3-estrutura-e-cobertura.md` (M.11-M.13).**
