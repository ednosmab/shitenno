# Plano Final Único — Health Scores, `shugo update`, Limpeza da Raiz

**Status:** In Progress
**Data:** 2026-08-02 | **Prioridade:** Máxima — cobre os dois achados de "score degradado a zero" (validados por execução real, causas raiz distintas e complementares) + o que já estava pendente da branch de MCP.
**Regra de ouro pro agente:** cada bloco tem TDD obrigatório (teste vermelho antes do fix, verde depois) e um passo de validação por execução real — não considerar nenhum item concluído só porque compilou.

---

## Bloco A — Já corrigido e validado neste sandbox (só aplicar, não reinvestigar)

Rodei tudo isso de ponta a ponta, com testes reais passando. Aplicar direto na branch:

**A1. `src/commands/update.ts`** — religar pra usar as funções corretas:
```diff
 import {
   readManifest,
   writeManifest,
-  scanTemplateHashes,
-  diffManifests,
+  diffManifestsV2,
   updateManifest,
   type Manifest,
   type ManifestDiff,
 } from "../manifest.js";
```
```diff
-  const spinner = ora("Scanning templates for changes...").start();
-  const newHashes = scanTemplateHashes(ctx.shitennoDir);
-  spinner.succeed("Scan complete");
-
-  const newManifest: Manifest = { ...currentManifest, templateHashes: newHashes };
-  const diff = diffManifests(currentManifest, newManifest);
+  const spinner = ora("Scanning templates for changes...").start();
+  const newManifest = updateManifest(currentManifest, {
+    cliVersion: currentCliVersion,
+    shitennoDir: ctx.shitennoDir,
+    capabilities: currentManifest.capabilities,
+    maturityScore: currentManifest.maturityScore,
+  });
+  spinner.succeed("Scan complete");
+
+  const diff = diffManifestsV2(currentManifest, newManifest);
   const hasChanges =
-    diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;
+    diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0 ||
+    (diff.conflict?.length ?? 0) > 0;
```

**A2. `src/commands/update/display.ts`** — `displayDiff()` estava mudo sobre `diff.conflict`, caindo no fallback enganoso "Everything is up to date" mesmo com conflito real:
```diff
+  if ((diff.conflict?.length ?? 0) > 0) {
+    outputWarning(`    ⚠ ${diff.conflict!.length} file(s) in conflict — customizados localmente E alterados no template`);
+    for (const f of diff.conflict!.slice(0, 10)) {
+      output(chalk.magenta(`      ⚠ ${f}`));
+    }
+    if (diff.conflict!.length > 10) {
+      output(chalk.gray(`      ... and ${diff.conflict!.length - 10} more`));
+    }
+    output(chalk.gray("      Não aplicados automaticamente — revisar manualmente."));
+  }
+
   if (
     diff.added.length === 0 &&
     diff.removed.length === 0 &&
-    diff.changed.length === 0
+    diff.changed.length === 0 &&
+    (diff.conflict?.length ?? 0) === 0
   ) {
     outputSuccess("    No changes detected. Everything is up to date.");
   }
```
Validado: `--apply` com um arquivo em conflito reportou "Updated 0 file(s)" e o MD5 do arquivo local não mudou — a proteção já funcionava, só a exibição mentia.

**A3.** Suíte completa depois de A1+A2: **18 arquivos, 439/439 testes passando**, zero regressão.

---

## Bloco B — Limpeza da raiz, item que faltou mapear

```bash
git rm -r governance/executions
rmdir governance 2>/dev/null || true
```
(`.shitenno/governance/executions/` já é o real, já está no `.gitignore`; a cópia da raiz é fóssil do mesmo tipo do `context_buffer.yaml` que já foi removido.)

---

## Bloco C — Daemon Health Score (achado 1, causa raiz confirmada por simulação)

**Sintoma:** painel do daemon mostra `Score: 0/100` mesmo com o projeto saudável (audit completo = 83/100 no mesmo estado).

**Causa:** `runPeriodicAudit()` roda audit incremental (só arquivos do `git diff`) e joga o resultado na MESMA fórmula/campo que o audit completo usa. A fórmula (`calculateHealthScore`) é calibrada pra um denominador grande (piso de 10, mas pensado pra centenas de arquivos); com poucos arquivos alterados e um cluster de achados severos, ela zera matematicamente — simulei: 3 arquivos + 30 achados severidade-3 → score 0, sem o projeto estar degradado.

**Fix — separar as duas métricas, não recalibrar a fórmula:**
```diff
--- a/src/daemon/timers.ts
+++ b/src/daemon/timers.ts
 export async function runPeriodicAudit(ctx: DaemonContext): Promise<void> {
   try {
     const level = getAuditLevel(ctx);
     const changedFiles = getChangedFiles(ctx.projectRoot);
     const report = await auditHealth(ctx.projectRoot, ctx.shitennoDir, level, changedFiles);

-    ctx.state.health = {
-      score: report.healthScore,
-      previousScore: ctx.state.health?.score ?? null,
-      checkedAt: report.auditedAt,
-    };
+    // "Saúde geral" só faz sentido vindo de sweep completo (denominador grande o
+    // suficiente pra diluir achados). Audit incremental mede outra coisa — issues
+    // introduzidos por ESTE commit — e não deve sobrescrever o mesmo campo.
+    if (!changedFiles || changedFiles.length === 0) {
+      ctx.state.health = {
+        score: report.healthScore,
+        previousScore: ctx.state.health?.score ?? null,
+        checkedAt: report.auditedAt,
+      };
+    } else {
+      ctx.state.lastDeltaAudit = {
+        changedFilesCount: changedFiles.length,
+        newIssueCount: report.issues.length,
+        checkedAt: report.auditedAt,
+      };
+    }

     recordEvent(ctx.state, "health.checked");
```
Precisa adicionar `lastDeltaAudit?: { changedFilesCount: number; newIssueCount: number; checkedAt: string }` ao tipo `DaemonState`, e expor no `query_health` (`src/daemon/ipc.ts`) como campo separado do `score` principal — nunca misturado nele.

**Verificar depois de aplicar:** se o intervalo do sweep completo (`getAuditIntervalMs`) é frequente o suficiente pra `ctx.state.health.score` não ficar `null` por muito tempo numa sessão de trabalho ativa — não investiguei esse ponto a fundo.

**Teste TDD obrigatório:**
```ts
// src/daemon/__tests__/periodic-audit-score-isolation.test.ts (novo)
describe("runPeriodicAudit — isolamento de métricas", () => {
  it("audit incremental (changedFiles) NÃO sobrescreve ctx.state.health.score", async () => {
    ctx.state.health = { score: 83, previousScore: 80, checkedAt: "..." };
    // mock auditHealth pra simular poucos arquivos + achados severos concentrados
    await runPeriodicAudit(ctxComChangedFiles);
    expect(ctx.state.health.score).toBe(83);
    expect(ctx.state.lastDeltaAudit?.newIssueCount).toBeGreaterThan(0);
  });

  it("audit completo (sem changedFiles) atualiza normalmente", async () => {
    await runPeriodicAudit(ctxSemChangedFiles);
    expect(ctx.state.health.score).toBe(83); // bate com sweep completo real
  });
});
```

---

## Bloco D — Instabilidade de amostra pequena nas 4 fórmulas de health score (achado do outro agente, validado)

Confirmei os 4 arquivos e a caracterização matemática batendo com o código real. Uma correção ao próprio plano recebido: o script de reprodução original (seção 0 do documento anexado) usa um cenário de 2 assets que **não ultrapassa o limiar de 40** que ele mesmo define — rodei e deu `score=23`. Corrigido abaixo pra um cenário de 1 asset, que dá `score=45` de verdade — TDD vermelho genuíno antes do fix.

### D0. Reprodução corrigida (rodar ANTES de qualquer fix, deve falhar)
```ts
// scripts/verify/health-score-small-sample.ts
import { calculateEntropy } from "../../src/engineering-state/entropy.js";

let failed = false;
const now = new Date().toISOString();

// Cenário corrigido: 1 único asset catalogado, órfão — o pior caso realista de
// uma branch/projeto recém-iniciado, não 2 assets (que não reproduz o problema).
const oneAsset = [
  { id: "a1", type: "plan", status: "active", updatedAt: now, dependencies: [] },
] as any;
const result = calculateEntropy(oneAsset, [], "governed");

console.log(`Cenário: 1 asset, 1 órfão → entropy.score = ${result.score}`);
if (result.score > 40) {
  console.error(
    `❌ Um único asset/órfão gerou entropy=${result.score} — ruído estatístico ` +
    `de amostra pequena, não sinal real de degradação.`
  );
  failed = true;
}
if (failed) process.exit(1);
console.log("✅ Sem instabilidade de amostra pequena.");
```
Confirmado rodando de verdade: hoje dá `score=45` → falha, prova o problema antes do fix.

### D1. Utilitário compartilhado (a fórmula do audit é a referência correta — extrair, não reinventar)
```ts
// src/shared/bounded-health-score.ts
export interface SeverityBucket {
  key: string;
  weight: number;
  count: number;
  avgConfidence?: number;
}

export interface BoundedHealthScoreInput {
  buckets: SeverityBucket[];
  sampleSize: number;
  minSampleSize?: number;
  decayFactor?: number;
}

export function calculateBoundedHealthScore(input: BoundedHealthScoreInput): number {
  const { buckets, sampleSize, minSampleSize = 10, decayFactor = 2 } = input;
  const rawPenalty = buckets.reduce((sum, b) => {
    if (b.count <= 0) return sum;
    const conf = b.avgConfidence ?? 1.0;
    return sum + b.weight * Math.sqrt(b.count) * conf;
  }, 0);
  const normalizer = Math.max(sampleSize, minSampleSize);
  const density = rawPenalty / normalizer;
  const score = 100 * Math.exp(-density * decayFactor);
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

### D2. `src/audit/health-score.ts` — vira o primeiro consumidor (refatoração pura, zero mudança de número)
```ts
import { calculateBoundedHealthScore, type SeverityBucket } from "../shared/bounded-health-score.js";

export function calculateHealthScore(issues: HealthIssue[], totalFiles: number): number {
  const weights: Record<number, number> = { 3: 5, 2: 2, 1: 0.5 };
  const bySeverity: Record<number, number> = { 3: 0, 2: 0, 1: 0 };
  const confidenceBySeverity: Record<number, number> = { 3: 0, 2: 0, 1: 0 };
  for (const issue of issues) {
    bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
    confidenceBySeverity[issue.severity] = (confidenceBySeverity[issue.severity] ?? 0) + (issue.confidence ?? 1.0);
  }
  const buckets: SeverityBucket[] = [3, 2, 1].map((sev) => ({
    key: String(sev),
    weight: weights[sev]!,
    count: bySeverity[sev]!,
    avgConfidence: bySeverity[sev]! > 0 ? confidenceBySeverity[sev]! / bySeverity[sev]! : 1.0,
  }));
  return calculateBoundedHealthScore({ buckets, sampleSize: totalFiles, minSampleSize: 10 });
}
```
⚠️ Depois deste passo: rodar `security-benchmark.test.ts` e `audit-level-matrix.test.ts` (já confirmei ambos passando na suíte de hoje) e conferir que **nenhum número mudou**. Se mudar, a extração introduziu erro de arredondamento — parar e investigar antes de prosseguir.

### D3. `src/engineering-state/entropy.ts` — corrige o problema de fato (piso de amostra, formato ratio-based, não usa o utilitário de D1)
```diff
--- a/src/engineering-state/entropy.ts
+++ b/src/engineering-state/entropy.ts
+const MIN_ASSET_SAMPLE = 8; // ponto de partida — calibrar contra dados reais de maturity-profile se disponível
+
 export function calculateEntropy(
   assets: EngineeringAsset[],
   relations: Relation[],
   lifecycle: ShitennoLifecycleState
 ): { orphanedAssets: number; staleAssets: number; missingDependencies: number; score: number } {
   ...
-  const totalAssets = assets.length || 1;
+  const rawTotal = assets.length || 1;
+  const totalAssets = Math.max(rawTotal, MIN_ASSET_SAMPLE);
```
Rodar o script D0 de novo depois — deve passar.

### D4. `src/health-score-registry.ts` — manter as 3 funções nomeadas, corrigir 2 delas
Decisão: **manter** o registry como está estruturado (não apagar/consolidar em algo menor) — é desenhado como contrato estável (`HealthScoreResult` já é JSON-serializável) pra um futuro painel web que vai consumir as mesmas funções que o `doctor` usa hoje.
```ts
import { calculateBoundedHealthScore, type SeverityBucket } from "./shared/bounded-health-score.js";
import { HEALTH_SCORE_DEDUCTIONS } from "./formatting.js";

export function getCodeSecurityScore(issues: { severity: string }[], totalFiles: number): HealthScoreResult {
  if (totalFiles === 0) {
    return { type: "code_security", label: "Code Health", score: 100, maxScore: 100, formula: "No files to audit" };
  }
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const i of issues) bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
  const buckets: SeverityBucket[] = Object.entries(HEALTH_SCORE_DEDUCTIONS).map(([key, weight]) => ({
    key, weight, count: bySeverity[key] ?? 0,
  }));
  const score = calculateBoundedHealthScore({ buckets, sampleSize: totalFiles, minSampleSize: 10 });
  return { type: "code_security", label: "Code Health", score, maxScore: 100,
    formula: "amortecido: sqrt(count) por severidade, piso de amostra = 10 arquivos" };
}

export function getEngineeringRiskScore(findings: { severity: string }[]): HealthScoreResult {
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of findings) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
  const buckets: SeverityBucket[] = Object.entries(HEALTH_SCORE_DEDUCTIONS).map(([key, weight]) => ({
    key, weight, count: bySeverity[key] ?? 0,
  }));
  const score = calculateBoundedHealthScore({ buckets, sampleSize: findings.length, minSampleSize: 5 });
  return { type: "engineering_risk", label: "Engineering Risk", score, maxScore: 100,
    formula: "amortecido: sqrt(count) por severidade, piso de amostra = 5 findings" };
}
```
`getKnowledgeHealthScore` não muda de fórmula própria — mas herda a correção do D3 automaticamente, já que consome `ctx.entropy.score`.

### D5. `src/commands/doctor/analysis.ts` — por último, é o único com número visível mudando
```diff
-let healthScore = 100;
-for (const f of allFindings) healthScore -= calculateHealthPenalty(f.severity);
-healthScore = Math.max(0, Math.min(100, healthScore));
+import { getEngineeringRiskScore } from "../../health-score-registry.js";
+const healthScore = getEngineeringRiskScore(allFindings).score;
```
⚠️ **Recalibração visível, não refatoração neutra.** Antes de trocar direto: rodar old vs. new lado a lado contra alguns projetos reais (o próprio shitenno incluso) e comparar. Se a diferença for grande o suficiente pra confundir quem já está acostumado com a escala atual do `doctor`, anunciar a mudança em vez de trocar silenciosamente.

---

## Ordem de execução única, consolidando tudo

| Ordem | Item | Depende de |
|---|---|---|
| 1 | Bloco A (aplicar update.ts/display.ts já validados) | — |
| 2 | Bloco B (`git rm -r governance/executions`) | — |
| 3 | D0 (script de reprodução corrigido) — confirma vermelho | — |
| 4 | D1 (`bounded-health-score.ts`) — utilitário novo, zero risco | — |
| 5 | D2 (`audit/health-score.ts`) — refatoração pura, testes idênticos obrigatório | 4 |
| 6 | D3 (`entropy.ts`) — o fix de fato; rodar D0 de novo, deve passar | 3 |
| 7 | D4 (`health-score-registry.ts`) | 4 |
| 8 | Bloco C (`daemon/timers.ts` — isolar métricas) — independente do D, pode ser feito em paralelo com 3-7 | — |
| 9 | D5 (`doctor/analysis.ts`) — por último, número visível muda, comparar old vs new antes de travar | 7 |
| 10 | Suíte completa + `shugo audit`/`shugo status`/`shugo daemon start` reais, conferir os dois painéis (Daemon Health e Knowledge Health) não zerando mais em cenários pequenos | 1-9 |

## Guardrails finais

- TDD em cada bloco: teste vermelho antes, verde depois — não só "escrever o teste", rodar de verdade contra o código atual pra confirmar que ele pega o problema.
- D2 é o item de maior risco de regressão silenciosa (refatoração que deveria ser 100% neutra) — se qualquer teste de audit mudar de número, parar e investigar antes de continuar pra D3+.
- D5 é o único item com mudança de comportamento visível ao usuário — não aplicar sem o comparativo old vs new.
- Depois de tudo aplicado: iniciar o daemon de verdade (`shugo daemon start`), fazer um commit pequeno, e observar o painel de status por um ciclo de audit incremental real — é o único jeito de confirmar que o Bloco C resolveu o sintoma original que você viu, não só os testes unitários isolados.
