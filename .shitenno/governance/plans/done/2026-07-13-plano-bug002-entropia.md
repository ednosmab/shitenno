# Plano Consolidado — Shiten Living: BUG-002 (fim-a-fim), Redesenho da Entropia, Item Futuro

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.027Z
**Date:** 2026-07-12

> **Data:** 2026-07-13
> **Repositório validado:** `shitenno-go-feat-shiten-living` (zip mais recente)
> **Método:** todos os trechos de código abaixo foram confirmados linha a linha contra
> o ficheiro real, e a lógica de cada fix foi executada isoladamente neste ambiente
> (Node + `tsx`, sem deps externas) antes de entrar neste plano. Onde isso não foi
> possível, está marcado explicitamente na secção 6.

---

## Item A — BUG-002: fix incompleto do `docs/generated/` (fim-a-fim)

### A.1 Diagnóstico confirmado, com números reais

`calculateSignificance()` em `src/doc-sync-significance.ts` soma 4 factores com pesos
próprios: artefacto (40%), directório (30%), frequência (20%), tamanho (10%).

O fix anterior corrigiu **só** `DIRECTORY_SCORES["docs/generated/"] = 0.0` (confirmado
no ficheiro — já lá está). Mas `detectArtifactType()` não tem nenhum caso para
`docs/generated/` — cai no fallback `relative.startsWith("docs/") → "doc"`, cujo
`ARTIFACT_SCORES.doc = 0.6`. Isso sozinho contribui `0.6 × 0.4 = 0.24` para o score
final, e um ficheiro grande recém-criado (`sizeScore` alto) já basta para ultrapassar
o `minSignificance` de 0.3 mesmo com `directoryScore = 0`.

**Reproduzi isto com o código real** (`calculateSignificance` chamado directamente,
sem mocks) para `docs/generated/ARCHITECTURE.md`, ficheiro novo de 50 linhas:

```json
{
  "score": 0.36,
  "level": "low",
  "reasons": ["size:(0.8)"],
  "shouldSync": true,
  "outputLevel": "silent"
}
```

`shouldSync: true` — bug confirmado, exactamente como reportado (o número exacto
varia um pouco com o conteúdo/tamanho usado no repro, mas a conclusão é idêntica:
ultrapassa 0.3 mesmo com `directoryScore = 0`).

### A.2 Fix — `src/doc-sync-significance.ts`

Três edições, todas pequenas e localizadas:

```typescript
export type ArtifactType =
  | "skill"
  | "adr"
  | "workflow"
  | "rule"
  | "doc"
  | "config"
  | "script"
  | "telemetry"
  | "report"
  | "feedback"
  | "generated"     // ← NOVO
  | "unknown";
```

```typescript
const ARTIFACT_SCORES: Record<ArtifactType, number> = {
  skill: 1.0,
  adr: 1.0,
  workflow: 0.9,
  rule: 0.7,
  doc: 0.6,
  config: 0.3,
  script: 0.3,
  telemetry: 0.0,
  report: 0.0,
  feedback: 0.0,
  generated: 0.0,   // ← NOVO — mesmo peso zero de report/telemetry: é saída, não entrada
  unknown: 0.1,
};
```

```typescript
export function detectArtifactType(filePath: string, shitenDir: string): ArtifactType {
  const relative = filePath.slice(shitenDir.length + 1);

  if (relative.startsWith("docs/generated/")) return "generated"; // ← NOVO, ANTES do docs/skills etc.
  if (relative.startsWith("docs/skills/")) return "skill";
  if (relative.startsWith("docs/adrs/")) return "adr";
  if (relative.startsWith("governance/WORKFLOW")) return "workflow";
  if (relative.startsWith("governance/rules/")) return "rule";
  if (relative.startsWith("governance/agents/")) return "config";
  if (relative.startsWith("governance/")) return "doc";
  if (relative.startsWith("docs/")) return "doc";
  // ... resto inalterado
}
```

A ordem importa: são `if` sequenciais (não "prefixo mais longo primeiro" como em
`DIRECTORY_SCORES`), por isso `docs/generated/` tem de vir antes de qualquer
`docs/*` mais genérico.

**Apliquei este fix e re-corri o mesmo repro** (mesmo ficheiro, mesmo conteúdo):

```json
{
  "score": 0.12,
  "level": "ignore",
  "reasons": ["size:(0.8)"],
  "shouldSync": false,
  "outputLevel": "silent"
}
```

Score cai de 0.36 para 0.12, `shouldSync: false`. Fix confirmado a resolver o problema
real, não só o teórico.

### A.3 Teste de regressão fim-a-fim (faltava — só existia para `detectDirectoryScore`)

Adicionar a `src/__tests__/doc-sync-significance.test.ts`:

```typescript
it("does not trigger sync for files inside docs/generated/ (BUG-002, full pipeline)", () => {
  const tracker = new ChangeHistoryTracker();
  const filePath = `${SHITEN}/docs/generated/ARCHITECTURE.md`;

  const result = calculateSignificance(
    filePath,
    SHITEN,
    null,
    "# Conteúdo gerado\n".repeat(50),
    tracker.recordChange(filePath)
  );

  expect(result.shouldSync).toBe(false); // valida o resultado FINAL, não só directoryScore
  expect(result.level).toBe("ignore");
});
```

Este é o teste que faltou da última vez — o anterior só verificava
`detectDirectoryScore` isoladamente, nunca `calculateSignificance` fim-a-fim, por
isso deixou passar um fix pela metade.

---

## Item B — Redesenho da Entropia (type/lifecycle-aware)

### B.1 Os 3 achados, confirmados contra `src/engineering-state.ts`

**1. Stale ratio (30 dias fixos, sem distinção de tipo) — confirmado 100%, sem nuance:**

```typescript
const staleAssets = assets.filter((a) => {
  const updated = new Date(a.updatedAt);
  return updated < thirtyDaysAgo && a.status === "active";
}).length;
```

Nenhuma diferenciação por `type`. Um `adr`, um `policy`, um `plan` — todos usam os
mesmos 30 dias.

**2. Orphan ratio — parcialmente já mitigado, mas não onde importa:**

```typescript
const orphanedAssets = assets.filter((a) => !connectedIds.has(a.id) && a.type !== "report" && a.type !== "doc").length;
```

`type !== "doc"` já existe, então um documento fundacional tipo `FORBIDDEN_OPERATIONS.md`
(classificado como `type: "doc"` em `discoverAssets()`) já não é penalizado hoje. Mas
a exclusão não cobre `adr` nem `policy` — os tipos mais fundacionais de todos. Um ADR
sem links de entrada continua a ser contado como órfão normalmente.

**3. Pesos estáticos, sem sensibilidade ao lifecycle — confirmado:**

```typescript
const lifecycle = detectLifecycleState(projectRoot, shitenDir);  // linha 548
// ...
const entropy = calculateEntropy(assets, relations);            // linha 579 — lifecycle não é passado
```

`lifecycle` já é calculado na mesma função de consolidação (`consolidateEngineeringState`)
e fica guardado no estado final — só nunca é passado para `calculateEntropy`. Não falta
infraestrutura nenhuma, é literalmente um parâmetro já em escopo e não usado.

**Correcção importante ao desenho anterior:** os valores reais de
`ShitenLifecycleState` (`src/shiten-state-machine.ts`) são:

```typescript
export type ShitenLifecycleState =
  | "uninitialized"
  | "discovered"
  | "assessed"
  | "governed"
  | "evolved";
```

Não são `"incubator"` / `"mature"` como um desenho anterior assumiu — isso não bateria
com o type checker. O código abaixo já usa os valores reais.

### B.2 Achado bónus (não pedido, mas encontrado ao validar) — bug de escala no score final

```typescript
const score = Math.round(
  (orphanRatio * 40 + staleRatio * 30 + depRatio * 30) * 100
);
```

Os pesos (40/30/30) já somam 100 e representam directamente pontos percentuais quando
o ratio correspondente é 1 (100% órfão, por exemplo). Multiplicar essa soma por mais
100 faz o score saturar em praticamente qualquer projecto real: um `orphanRatio` de
apenas 0.1 (10% dos assets órfãos) já dá `0.1 × 40 × 100 = 400`, cortado para 100 pelo
`Math.min(100, score)`. Ou seja, o score de entropia está, na prática, quase sempre em
100 ou perto disso, independentemente da calibração fina que este plano propõe — o
redesenho de tipo/lifecycle não teria efeito visível sem corrigir isto também.

Não encontrei nenhum teste que exercite `calculateEntropy` com ratios reais e verifique
um valor não-saturado — os testes existentes (`engineering-state-history.test.ts`,
`engineering-state-mutations.test.ts`, etc.) injectam objectos `entropy` já prontos
(`score: 20`, `score: 30`...), nunca passam por esta fórmula. Por isso ninguém apanhou
isto até agora.

**Fix:** remover o `* 100` extra — a soma ponderada já está na escala 0–100.

### B.3 Código completo do redesenho — `src/engineering-state.ts`

```typescript
// ── Stale thresholds por tipo de asset ──────────────────────────────────────
// Vida curta: decai rápido de propósito (documentos de trabalho em progresso).
// Vida longa: registo histórico/fundacional — decaimento lento por natureza.
const STALE_THRESHOLDS_DAYS: Record<AssetType, number> = {
  plan: 15,
  checklist: 15,
  prompt: 15,
  decision: 15,
  doc: 30,
  contract: 30,
  runbook: 30,
  context: 30,
  sdr: 30,
  script: 30,
  feedback: 30,
  rule: 45,
  workflow: 45,
  skill: 45,
  policy: 180,
  adr: 180,
  template: 180,
  report: Infinity, // gerado automaticamente — nunca "obsoleto por falta de edição", é regenerado
};

// ADR e policy são fundacionais por definição — ausência de links de entrada
// não é o sinal certo de relevância deles. report/doc já eram exemptos.
const ORPHAN_EXEMPT_TYPES = new Set<AssetType>(["report", "doc", "adr", "policy"]);

function orphanWeightFor(lifecycle: ShitenLifecycleState): number {
  // uninitialized/discovered: fase de descoberta — ideias soltas ainda não
  // amarradas são normais, órfãos pesam menos.
  // governed/evolved: sistema maduro — falta de interligação é sinal real de dívida.
  if (lifecycle === "uninitialized" || lifecycle === "discovered") return 20;
  if (lifecycle === "governed" || lifecycle === "evolved") return 45;
  return 40; // "assessed" — transição, mantém o peso actual
}

function calculateEntropy(
  assets: EngineeringAsset[],
  relations: Relation[],
  lifecycle: ShitenLifecycleState // ← NOVO parâmetro — já existe em escopo no caller
): { orphanedAssets: number; staleAssets: number; missingDependencies: number; score: number } {
  const now = Date.now();

  const connectedIds = new Set<string>();
  for (const r of relations) {
    connectedIds.add(r.source);
    connectedIds.add(r.target);
  }

  const orphanedAssets = assets.filter(
    (a) => !connectedIds.has(a.id) && !ORPHAN_EXEMPT_TYPES.has(a.type)
  ).length;

  const staleAssets = assets.filter((a) => {
    const thresholdDays = STALE_THRESHOLDS_DAYS[a.type] ?? 30;
    if (!isFinite(thresholdDays)) return false;
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;
    return now - new Date(a.updatedAt).getTime() > thresholdMs && a.status === "active";
  }).length;

  const assetIds = new Set(assets.map((a) => a.id));
  const missingDependencies = assets.filter((a) =>
    a.dependencies.some((dep) => !assetIds.has(dep))
  ).length;

  const totalAssets = assets.length || 1;
  const orphanWeight = orphanWeightFor(lifecycle);
  // missingDependencies fica FIXO em 30 — é o único dos 3 sinais puramente
  // objectivo (referência quebrada é sempre bug, em qualquer fase do projecto).
  // orphan e stale são proxies de comportamento humano, mudam de sentido com o contexto.
  const staleWeight = 100 - orphanWeight - 30;

  const orphanRatio = orphanedAssets / totalAssets;
  const staleRatio = staleAssets / totalAssets;
  const depRatio = missingDependencies / totalAssets;

  // SEM o *100 extra do código original (ver B.2) — a soma já está em escala 0-100.
  const score = Math.round(orphanRatio * orphanWeight + staleRatio * staleWeight + depRatio * 30);

  return {
    orphanedAssets,
    staleAssets,
    missingDependencies,
    score: Math.min(100, score),
  };
}
```

**Alteração no caller** (`consolidateEngineeringState`, por volta da linha 579):

```typescript
// Antes:
const entropy = calculateEntropy(assets, relations);

// Depois:
const entropy = calculateEntropy(assets, relations, lifecycle);
```

`lifecycle` já está em escopo (linha 548) — não precisa de nenhum cálculo adicional.

### B.4 Validação da lógica (protótipo isolado, fora do repo — sem deps do projecto)

Corri esta implementação (idêntica à acima, em JS puro) contra 3 cenários antes de a
propor:

| Cenário | Resultado | Confirma |
|---|---|---|
| ADR + doc fundacional, ambos 170 dias parados, projecto `governed` | `staleAssets: 1` (só o doc — threshold 30d; ADR ainda dentro dos 180d), `orphanedAssets: 0` (ambos exemptos) | Achados 1 e 2 |
| `plan` parado 20 dias (threshold 15d) | `staleAssets: 1` | Threshold curto para tipos de vida curta funciona |
| `runbook` órfão, `discovered` vs `evolved` | score 20 vs score 45 (mesmos dados de entrada) | O mesmo órfão pesa mais num projecto maduro do que num em descoberta — achado 3 |

### B.5 Testes a adicionar — `src/__tests__/engineering-state.test.ts`

```typescript
it("does not count a recent ADR as stale even if last touched 170 days ago (lifecycle-aware)", () => {
  const asset: EngineeringAsset = {
    id: "adr-1", type: "adr", name: "ADR", path: "x", description: "",
    tags: [], status: "active",
    createdAt: daysAgo(170), updatedAt: daysAgo(170),
    contributesTo: [], dependencies: [],
  };
  // chamar calculateEntropy (exportar para teste, ou testar via consolidação completa)
  const result = calculateEntropy([asset], [], "governed");
  expect(result.staleAssets).toBe(0);
});

it("counts a stale doc using the 30-day default while an ADR with the same age is not stale", () => {
  const adr = makeAsset({ type: "adr", updatedAt: daysAgo(170) });
  const doc = makeAsset({ type: "doc", updatedAt: daysAgo(170) });
  const result = calculateEntropy([adr, doc], [], "governed");
  expect(result.staleAssets).toBe(1);
});

it("does not count an orphaned ADR or policy against entropy", () => {
  const adr = makeAsset({ type: "adr" });
  const policy = makeAsset({ type: "policy" });
  const result = calculateEntropy([adr, policy], [], "governed");
  expect(result.orphanedAssets).toBe(0);
});

it("weighs the same orphan more heavily in a mature (governed/evolved) project than in discovery", () => {
  const asset = makeAsset({ type: "runbook" }); // órfão, não exempto
  const discovered = calculateEntropy([asset], [], "discovered");
  const evolved = calculateEntropy([asset], [], "evolved");
  expect(evolved.score).toBeGreaterThan(discovered.score);
});

it("does not saturate the score for a small, realistic amount of entropy (regression for the *100 scaling bug)", () => {
  // 1 órfão em 20 assets = 5% ratio — não deveria saturar a 100
  const assets = Array.from({ length: 20 }, (_, i) => makeAsset({ id: `a${i}`, type: "doc" }));
  assets[0] = { ...assets[0], type: "runbook" }; // 1 órfão não-exempto
  const result = calculateEntropy(assets, [], "assessed");
  expect(result.score).toBeLessThan(50); // antes do fix, isto saturava a 100
});
```

(`makeAsset`/`daysAgo` — helpers de fixture; adaptar aos que já existirem no ficheiro
de teste, ou criar `makeAsset(overrides)` simples que gera um `EngineeringAsset`
válido com defaults sensatos.)

`calculateEntropy` é uma função privada do módulo hoje — para estes testes correrem
directamente (em vez de só indirectamente via `consolidateEngineeringState`), exportá-la
(`export function calculateEntropy(...)`), ou manter privada e testar só através da
consolidação completa com fixtures de `discoverAssets`. A primeira opção é mais barata
e mais directa para estes casos.

---

## Item C — Trabalho futuro (registar, não implementar agora)

A crítica mais funda — medir **actividade de ficheiro** (`stat.mtime`) em vez de
**relevância semântica** (o documento ainda reflecte o código-fonte actual?) — é real,
mas é uma categoria de trabalho diferente e bem mais cara. Exigiria comparar o
conteúdo do documento contra o estado actual do código (ex: ADR diz "usamos
Postgres", `package.json` já não tem `pg` como dependência → desactualização real,
independente de quando foi editado). Isso não dá para fazer só com timestamps —
precisa de alguma forma de comparação de conteúdo/NLP.

**Não misturar com o Item B.** Um é calibração da heurística existente (barato, faz
sentido agora); o outro é uma capacidade nova inteira (caro, vale um ADR próprio antes
de começar).

**Registar como candidato futuro**, possivelmente alimentando o `correlation-engine.ts`
do plano do daemon (Fase 3) — "documento provavelmente desactualizado por deriva
semântica" é exactamente o tipo de sinal *report-driven* que faria sentido cruzar com
sinal ao vivo, quando o daemon existir. Sem código nem ADR neste momento — só o
registo da ideia para não se perder.

---

## 4. Ordem de execução recomendada

1. **Item A** (BUG-002 fim-a-fim) — isolado, sem dependências de outros itens, patch
   pequeno e já validado. Fazer primeiro.
2. **Item B** (entropia) — inclui o achado bónus B.2, que é pré-requisito para o
   redesenho ter algum efeito observável. Fazer os dois (redesenho + fix da escala)
   na mesma PR, já que são o mesmo ficheiro e a mesma função.
3. **Item C** — sem acção de código; só criar uma entrada no backlog/plano do daemon
   referenciando esta secção.

## 5. Critérios de saída (reaproveitando o pipeline já desenhado)

- `pnpm test` (cobre os testes novos de A.3 e B.5) + `pnpm lint` a passar.
- Para o Item A: confirmar no log/teste que `docs/generated/*` não dispara sync mesmo
  para ficheiros grandes/novos.
- Para o Item B: correr `shiten status` num projecto real em fase `governed`/`evolved`
  com pelo menos um ADR/policy antigo e confirmar que o score de entropia deixou de
  saturar a 100 artificialmente.

## 6. Nível de confiança por item

- **Item A (fix + teste):** validado por execução real contra o código do repositório
  — reproduzi o bug (score 0.36, `shouldSync: true`), apliquei o fix, e confirmei a
  resolução (score 0.12, `shouldSync: false`) com o mesmo input. Confiança alta.
- **Item B (redesenho type/lifecycle):** lógica validada por protótipo isolado (JS
  puro, mesmos algoritmos, 3 cenários) — não corrida directamente dentro de
  `engineering-state.ts` porque a função não está exportada e `discoverAssets`
  arrasta mais dependências do módulo do que valeria a pena mockar aqui. Confirmar
  com `pnpm test` no ambiente do agente antes de merge.
- **Item B.2 (achado do `*100`):** confirmado por leitura directa da fórmula e por
  ausência de qualquer teste que a exercite com ratios reais — matematicamente
  inequívoco (pesos já somam 100, multiplicar por mais 100 satura quase sempre).
  Confiança alta na análise; o fix em si é uma remoção de uma linha, baixo risco.
- **Item C:** sem implementação — é só um registo de escopo futuro.


