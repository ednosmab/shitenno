# Plano Único Consolidado (2026-08-01) — v2

**Status:** Done
**Updated_at:** 2026-08-01T13:15:29.992Z
**Date:** 2026-08-01

> Nota de quem está adicionando esta seção: o restante deste documento (seções 0-3
> originais) foi gerado por outra sessão, trabalhando com um zip ("zip 10") que eu não
> tenho — mantive o conteúdo original sem alterar, porque não tenho como reverificar contra
> esse zip. Só inseri a **Fase D** abaixo (auditoria adversarial contínua), que é minha, e
> ajustei a numeração de fase que vinha depois dela. Onde meu item depende de algo que a
> outra sessão encontrou (itens 17/18 dela), deixei a dependência explícita — não assumi que
> já está corrigido.

## 0. Transparência antes de tudo

Os três documentos anexados citam uma "validação v4" e duas "regressões" atribuídas a mim — **eu não tenho esse registro**. Minha última validação foi a do zip 10 (`VALIDACAO-ZIP10-2026-07-31.md`), que achou dois problemas diferentes (crossFile sem gate, sinks `res.send`/`write`/`end` com nome quebrado). Não sei se "v4" é uma rodada de validação que vocês fizeram sem mim, ou se é uma forma do seu agente narrar o próprio trabalho — não vou especular sobre isso.

O que fiz: **verifiquei cada alegação checável dos 3 documentos contra o código real do zip 10** (o mais recente que tenho), independente de quem gerou o diagnóstico original. Resultado: **tudo que é verificável bateu**.

| Alegação | Verificação | Resultado |
|---|---|---|
| Listas de nível (`detectors-standard.ts` etc.) são arrays hardcoded independentes, não compostos | `STANDARD_DETECTORS` tem 51 entradas próprias, não deriva de `QUICK_DETECTORS` (7) | ✅ confirmado real |
| `SECURITY_DETECTOR_SELF_PATHS` exclui `"src/audit/taint/"` inteiro | Linha existe em `src/audit/constants.ts:35`, prefixo cobre a pasta toda, não um arquivo específico | ✅ confirmado real |
| `detectMisclassifiedTier` nunca aparece em nenhuma lista de nível | Registrado em `detector-map/git.ts`, chamável, zero ocorrência em `detectors-*.ts` | ✅ confirmado real |
| `detectDependencyStaleness` nunca aparece em nenhuma lista de nível | Registrado em `detector-map/supply-chain.ts`, chamável, zero ocorrência em `detectors-*.ts` | ✅ confirmado real |

Então, apesar de eu não conseguir confirmar a origem da narrativa "v4", **o conteúdo técnico dos 3 documentos é sólido e verificado por mim de forma independente**. Trato como confiável pra fins deste plano.

---

## 1. Como os 3 documentos já se relacionam entre si

Não são 3 planos concorrentes — são sequenciais, e o segundo documento (`ACAO-CORRETIVA-ORFAOS...`) já declara a ordem combinada dos outros dois na própria seção final. Não vou reescrever esse código (já está completo e correto nos anexos) — só vou apontar onde cada peça entra na sequência final, e inserir meus próprios itens em aberto nos pontos certos.

---

## 2. Ordem final única (3 documentos anexos + itens em aberto)

### Fase A — Correções de código, baixo risco, sem decisão pendente

1. **Adicionar os 2 detectores órfãos às listas certas** — `ACAO-CORRETIVA-ORFAOS...md`, seção 1. 2 linhas, risco zero. Fazer primeiro porque é a correção mais isolada de todas.
2. **Regressão 1 — composição automática de níveis** — `PLANO-CORRECAO-REGRESSOES-V5.md`, seção 1 (passos 1.1 a 1.4). Antes de colar: o próprio documento já avisa pra rodar diff contra a lista atual antes de aplicar — não pular esse passo, porque isso muda a superfície de detecção inteira de uma vez.
3. **Teste de regressão pra composição de níveis** — `PLANO-CORRECAO-REGRESSOES-V5.md`, seção 2.
4. **Regressão 2 — reverter exclusão larga de `SECURITY_DETECTOR_SELF_PATHS`** — mesmo documento, seção 3.
5. **Teste de regressão — MD5 dentro de `taint/` continua sendo pego** — mesmo documento, seção 4.
6. **Pendências menores** (`coupling.ts` com `srcDir` hardcoded, texto duplicado em `secrets.ts`) — mesmo documento, seção 5.
7. **Verificação final da Fase A** — mesmo documento, seção 6 (comandos prontos).

### Fase B — Categoria de teste nova (comportamental, não só proxy estrutural)

8. **Manifest único do corpus** (`vuln-corpus/manifest.ts`) — `PLANO-COBERTURA-ORQUESTRACAO-TESTES.md`, seção 1. Atenção ao aviso do próprio documento: conferir `expectedIssueType`/`minLevel` de cada entrada contra o que cada detector retorna de verdade antes de travar — não copiar às cegas.
9. **Migrar `security-benchmark.test.ts` pro manifest** — mesmo documento, seção 2.
10. **`detector-self-exclusion.test.ts`** — mesmo documento, seção 4. Aplicar antes do item 11 (é o mais barato dos dois testes novos e sozinho já travaria a Regressão 2 pra sempre).
11. **`audit-level-matrix.test.ts`** (e2e via CLI real) — mesmo documento, seção 3. Mais caro (builda + roda CLI 3x) — é o que travaria a Regressão 1 de forma definitiva.
12. **Teste de órfão total** (todo detector registrado aparece em algum nível) — `ACAO-CORRETIVA-ORFAOS...md`, seção 2. Generaliza o item 1 — sem ele, um detector novo esquecido no futuro passa despercebido de novo.
13. **Scripts `test:wiring`/`test:matrix` no `package.json`** — `PLANO-COBERTURA-ORQUESTRACAO-TESTES.md`, seção 5.
14. **Plugar os 2 gates novos no CI** — `ACAO-CORRETIVA-ORFAOS...md`, seção 4.

### Fase C — Itens em aberto de rodadas anteriores, ainda sem correção (não cobertos pelos 3 documentos anexos)

Nenhum dos 3 documentos toca nestes. Seguem valendo, e dois deles (15 e 16) são exatamente do mesmo gênero do que a Fase B está institucionalizando — teste de regressão comportamental pra fix que já foi aplicado mas nunca ganhou guarda.

**15. Teste de regressão faltando pro S1** (confirmei agora que não existe em nenhum arquivo de teste do zip 10 — `executeUpdateBacklogStatus` não é testado em lugar nenhum):
```ts
// src/__tests__/rule-engine-actions.test.ts (criar se não existir)
import { describe, it, expect, vi } from "vitest";
import { getEventBus } from "../event-bus.js";
import { executeUpdateBacklogStatus } from "../rule-engine/actions.js";

describe("executeUpdateBacklogStatus — publica task.completed só em estado terminal", () => {
  it("publica task.completed quando toState é estado terminal", () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);
    executeUpdateBacklogStatus(
      { type: "update_backlog_status", params: { taskId: "T1", fromState: "andamento", toState: "concluído" } },
      /* context real do teste — conferir assinatura atual da função antes de colar */
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ taskId: "T1", toState: "concluído" }));
  });

  it("NÃO publica task.completed em transição não-terminal", () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);
    executeUpdateBacklogStatus(
      { type: "update_backlog_status", params: { taskId: "T1", fromState: "backlog", toState: "andamento" } },
      /* mesmo context */
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
```
Conferir a assinatura real de `executeUpdateBacklogStatus` (o `context` que ela espera) antes de colar — não tenho o zip mais recente pra confirmar se mudou desde o zip 10.

**16. R4 — handler global de erro no daemon, ainda sem nenhuma implementação em nenhuma rodada até agora:**
```ts
// src/daemon/index.ts — adicionar antes de setupPeriodicTimers/qualquer subscribe
process.on("uncaughtException", (err) => {
  daemonLog(ctx.logPath, "ERROR", `Uncaught exception: ${err.stack ?? err.message}`);
  try {
    persistState(ctx.state, ctx.statePath, /* force */ true);
  } catch {
    // não deixar o handler de erro quebrar por causa de outro erro
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  daemonLog(ctx.logPath, "ERROR", `Unhandled rejection: ${message}`);
});
```
Confirmar antes se existe supervisor de restart (`systemd`/`pm2`/watchdog do próprio `shugo daemon`) — se não existir, o `process.exit(1)` derruba o daemon até reinício manual; decisão do usuário se isso é aceitável ou se precisa de lógica de restart junto.

**17. ~~crossFile sem gate por nível~~ — ADENDO: verificado e NÃO se aplica ao código atual.**
Confirmei diretamente no arquivo enviado pelo usuário (`src/audit/taint/analyzer.ts:64`):
`crossFile: options.crossFile ?? true` — já é `true` por padrão, e é instanciado sem
nenhuma opção em `src/audit/detector-map/engineering.ts:56`
(`new TaintAnalyzer({ projectRoot: ctx.projectRoot })`). Ou seja, cross-file já roda sempre,
incondicionalmente, em todo nível que usa o `TaintAnalyzer` — o oposto de "sem gate = nunca
liga". A preocupação real, se houver, é a inversa: não tem como *desligar* por nível pra
economizar em projeto muito grande. Deixo como item em aberto só se isso vier a ser um
problema de performance observado na prática — não é correção obrigatória. Removido como
bloqueio da Fase D (ver nota abaixo).

**18. ~~Bug do nome dos sinks `res.send`/`res.write`/`res.end`~~ — ADENDO: verificado e NÃO
se aplica ao código atual.** Os sinks estão registrados com nome completo (`"res.send"`
etc., `src/audit/taint/sinks.ts:102-104`) e isso funciona corretamente: `findTaintSink` casa
por igualdade exata primeiro (`name === s.name`), e uma chamada `res.send(...)` gera
exatamente a string `"res.send"` — bate direto, sem precisar do matching por sufixo. O
matching por sufixo só é necessário pra sinks com nome curto/bare (`"query"`) baterem em
chamada qualificada (`"pool.query"`) — não é o caso de `res.send`. Não há ação a tomar aqui.

> **Nota sobre a origem dos itens 17/18**: o usuário confirmou que o "zip 10" era só o
> contador de downloads duplicados na pasta local dele, não uma versão de código diferente —
> então os itens 17/18, tal como descritos, não correspondem ao código que qualquer um de
> nós tem em mãos. Mantive os dois riscados acima (em vez de apagar) pra não perder o
> registro de que foram checados e descartados com evidência, não ignorados.

### Fase D — Auditoria adversarial contínua (mecanização + LLM delimitado)

> Esta fase é minha (não vem dos 3 documentos anexos nem do zip 10). Objetivo: parar de
> depender só de rodadas manuais de validação pra achar esse tipo de gap — mecanizar o que
> dá pra mecanizar (geração de variantes sintáticas, lint estrutural, diff de baseline) e
> usar LLM só no ponto específico que exige julgamento (avaliar se uma queda de contagem é
> correção ou regressão), de forma delimitada e barata.

**Dependências com a Fase C — atualizado após o adendo dos itens 17/18:**
- ~~Item 17/18 como pré-requisito~~ — removido. Os dois foram verificados contra o código
  confirmado e não se aplicam (ver adendo na Fase C) — não bloqueiam mais o item 19.
- **Único cuidado real que sobra**: como `crossFile` já roda sempre (`true` por padrão, sem
  gate por nível — ver item 17 no adendo), o gerador de variantes do item 19 já vai exercitar
  cross-file em todas as combinações desde a primeira rodada. Se a suíte ficar lenta ou
  consumir muita memória ao rodar o `mutation-corpus` completo, a causa mais provável é essa
  (cross-file sempre ligado), não falta de gate — nesse caso, considerar `crossFile: false`
  só no contexto do teste de matriz, não mudar o comportamento padrão do produto.
- **Item 8 (manifest único da Fase B) e o item 19 abaixo não podem virar duas fontes de
  verdade paralelas** — ver nota de integração dentro do item 19.

**19. Gerador de variantes sintáticas por sink — integrado ao manifest da Fase B, não paralelo a ele**

Na minha primeira versão deste item eu tinha desenhado um `mutation-corpus/` separado do
`vuln-corpus/manifest.ts` da Fase B. Reconsiderando: isso criaria uma terceira fonte de
verdade sobre "o que cada sink deveria detectar" (a primeira é o próprio `sinks.ts`, a
segunda é o `manifest.ts` do item 8). Correção: o gerador lê o **mesmo** `CORPUS_MANIFEST`
do item 8, não uma lista própria — ele só expande cada entrada do manifest nas variantes
sintáticas, em vez de manter fixtures físicas escritas à mão por variante.

```ts
// scripts/security/generate-mutation-corpus.ts
import { CORPUS_MANIFEST } from "../../src/audit/__fixtures__/vuln-corpus/manifest.js";
import { findTaintSink } from "../../src/audit/taint/sinks.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type ImportStyle = "destructured" | "namespace";
type CallStyle = "bare" | "object-method";
type LineSpan = "single-line" | "multi-statement";
type FnBoundary = "same-function" | "cross-function-same-file";

interface MutationAxis { importStyle: ImportStyle; callStyle: CallStyle; lineSpan: LineSpan; fnBoundary: FnBoundary; }

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
  const importLine = axis.importStyle === "destructured"
    ? `import { ${sinkName} } from "example-lib";`
    : `import * as lib from "example-lib";`;
  const callExpr = axis.callStyle === "bare" ? `${sinkName}(payload)` : `lib.${sinkName}(payload)`;
  const buildPayload = axis.lineSpan === "single-line"
    ? `const payload = "prefix " + req.query.id;`
    : `let payload = "prefix ";\n  payload += req.query.id;`;

  if (axis.fnBoundary === "same-function") {
    return `${importLine}\napp.get("/x", (req, res) => {\n  ${buildPayload}\n  ${callExpr};\n});`;
  }
  return `${importLine}\nfunction helper(payload) { return ${callExpr}; }\napp.get("/x", (req, res) => {\n  ${buildPayload}\n  helper(payload);\n});`;
}

function generateAll(outDir: string): void {
  // Uma entrada do manifest por categoria basta como "ponto de partida" — não precisa
  // gerar variante pra cada arquivo de fixture já existente, só por categoria/sink único.
  const seen = new Set<string>();
  for (const entry of CORPUS_MANIFEST) {
    const sinkDef = findTaintSink(entry.category); // ajustar: mapear category -> sink name real
    if (!sinkDef || seen.has(sinkDef.name)) continue;
    seen.add(sinkDef.name);
    for (const axis of validAxisCombinations()) {
      const dir = join(outDir, entry.category, sinkDef.name);
      mkdirSync(dir, { recursive: true });
      const fname = `${axis.importStyle}_${axis.callStyle}_${axis.lineSpan}_${axis.fnBoundary}.ts`;
      writeFileSync(join(dir, fname), renderFixture(sinkDef.name, axis));
    }
  }
}

generateAll(join(process.cwd(), "src/audit/__fixtures__/mutation-corpus"));
```

O teste que consome isso reaproveita o `audit-level-matrix.test.ts` do item 11 em vez de
criar um arquivo de teste próprio — mesma mecânica (rodar CLI real, checar issue type),
só apontando pro diretório `mutation-corpus/` além do `vuln-corpus/` original:
```ts
// src/__tests__/audit-level-matrix.test.ts — estender, não duplicar
// adicionar mutation-corpus como fonte extra de arquivos a copiar no scaffoldMatrixProject(),
// usando o mesmo CORPUS_MANIFEST pra saber qual issue type esperar de cada categoria.
```

**20. Lint estrutural nas definições de sink/source e de exclusão de path**

```ts
// scripts/security/lint-sink-definitions.ts — roda em CI, avisa sem bloquear
import { ALL_SINKS } from "../../src/audit/taint/sinks.js";
import { SECURITY_DETECTOR_SELF_PATHS } from "../../src/audit/constants.js";

let warnings = 0;

for (const sink of ALL_SINKS) {
  if (!sink.name.includes(".") && !sink.comment?.includes("bare-ok")) {
    console.warn(`⚠️  Sink "${sink.name}" é bare sem justificativa — confirmar suffix-match cobre chamada via objeto. (mesma classe do item 18)`);
    warnings++;
  }
}
for (const path of SECURITY_DETECTOR_SELF_PATHS) {
  if (path.endsWith("/")) {
    console.warn(`⚠️  "${path}" exclui um DIRETÓRIO INTEIRO — confirmar que não há código de produção lá. (mesma classe da Regressão 2)`);
    warnings++;
  }
}
if (warnings > 0) console.log(`\n${warnings} aviso(s) — revisar antes de merge.`);
```
Esse item existe especificamente porque os itens 4 (Regressão 2) e 18 (bug de nome de sink)
são o **mesmo tipo de erro** encontrado duas vezes por pessoas/sessões diferentes — o lint
transforma isso em aviso automático de code review, não depende de mais uma rodada de
validação achar de novo.

**21. Diff de baseline por categoria — captura queda silenciosa de contagem**

```ts
// scripts/security/baseline-diff.ts
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BASELINE_PATH = "scripts/security/category-baseline.json";
const THRESHOLD_DROP_PCT = 0.3;

function getCurrentCounts(): Record<string, number> {
  const out = execSync("node dist/bin/shugo.js audit --level enterprise --json --no-cache", { maxBuffer: 20 * 1024 * 1024 }).toString();
  const report = JSON.parse(out);
  const counts: Record<string, number> = {};
  for (const issue of report.issues) counts[issue.type] = (counts[issue.type] ?? 0) + 1;
  return counts;
}

function main() {
  const current = getCurrentCounts();
  if (!existsSync(BASELINE_PATH)) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2));
    console.log("Baseline criado pela primeira vez.");
    return;
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8"));
  const anomalies: Array<{ type: string; before: number; after: number }> = [];
  for (const [type, beforeCount] of Object.entries(baseline)) {
    const before = beforeCount as number;
    const afterCount = current[type] ?? 0;
    if (before > 0 && afterCount < before * (1 - THRESHOLD_DROP_PCT)) anomalies.push({ type, before, after: afterCount });
  }
  if (anomalies.length > 0) {
    console.log("🟡 Categorias com queda >30% — requer revisão:");
    for (const a of anomalies) console.log(`  ${a.type}: ${a.before} → ${a.after}`);
    writeFileSync("/tmp/audit-anomalies.json", JSON.stringify(anomalies, null, 2));
    process.exitCode = 2; // código específico: "revisar", não "quebrou"
  } else {
    console.log("✅ Nenhuma queda anômala.");
  }
}
main();
```
**Gerar o baseline inicial só depois das Fases A/B/C estarem aplicadas** — se gerar agora,
o baseline captura os bugs ainda presentes (ex.: `weak_crypto` com 2 em vez de 3, por causa
da Regressão 2 ainda não corrigida) e o item 21 vai considerar a correção futura como
"anomalia" em vez de melhoria.

**22. LLM delimitado — só entra quando o item 21 sinaliza anomalia**

```ts
// scripts/security/llm-triage-anomaly.ts
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

async function triage() {
  const anomalies = JSON.parse(readFileSync("/tmp/audit-anomalies.json", "utf-8"));
  const changedFiles = execSync("git diff --name-only origin/main...HEAD -- src/audit/").toString().trim().split("\n").filter(Boolean);
  if (changedFiles.length === 0) return;
  const diff = execSync(`git diff origin/main...HEAD -- ${changedFiles.join(" ")}`).toString();

  const prompt = `Você está revisando uma queda de contagem de issues de segurança num audit
estático. Isso pode ser (a) correção legítima de falso-positivo, ou (b) regressão que perdeu
detecção real. Responda em JSON estrito: {"verdicts": [{"category": string, "assessment":
"correção_provável" | "regressão_provável" | "inconclusivo", "reasoning": string (max 2
frases, cite trecho específico do diff)}]}. Não sugira código, só avalie.

Anomalias: ${JSON.stringify(anomalies)}

Diff dos arquivos de detector alterados neste PR:
${diff.slice(0, 8000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-5", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await response.json();
  const text = data.content.find((b: any) => b.type === "text")?.text ?? "{}";
  console.log("### Triagem de anomalia (revisão humana obrigatória)\n");
  console.log(text);
}
triage();
```

```yaml
# .github/workflows/ci.yml — depois do step "Detection matrix" (Fase B, item 13/14)
      - name: Self-audit baseline diff
        run: node scripts/security/baseline-diff.js
        continue-on-error: true
        id: baseline_diff

      - name: LLM triage (só roda se baseline_diff sinalizou anomalia)
        if: steps.baseline_diff.outcome == 'failure'
        run: node scripts/security/llm-triage-anomaly.js
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```
Custo controlado por design: só roda quando há anomalia real, prompt limitado ao diff dos
arquivos alterados (não o repo inteiro), saída é veredito estruturado pra revisão humana —
nunca aprova nem bloqueia PR sozinho.

### Fase E — Decisões que só o usuário toma (nenhuma delas está nos 3 documentos anexos nem na Fase D, seguem pendentes)

- **W2** — poda dos 9 eventos órfãos reais do event bus, ou manter como ponto de extensão documentado.
- **AA2** — propagar o lazy-loading do `opencode.json` real pro template usado por `shugo init`.
- **R5** — refinamento do maturity scoring por capacidade (baixa prioridade, já reduzido de "grave" pra "aproximação otimista").

---

## 3. Por que não separar em vários planos

Dava pra manter os 3 documentos anexos soltos e só adicionar os itens (15-22) como um 4º documento — mas isso reproduziria o mesmo problema que o item 12 (teste de órfão total) resolve pro código: informação que existe mas ninguém junta, e algo passa despercebido. Os itens 15-22 interagem diretamente com o que os 3 documentos já fazem (o item 17 precisa vir antes do 11 e do 19; o item 18 precisa vir antes do 19; o item 19 usa o mesmo manifest do item 8, não um novo). Consolidar numa ordem só evita que essas dependências fiquem implícitas.
