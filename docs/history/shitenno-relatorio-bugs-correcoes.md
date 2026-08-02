---
category: reference
lifecycle: Historical
---

# Shitenno — Relatório de Execução E2E + Correções

> Gerado após instalar, buildar, testar e executar o pacote `shitenno`
> de ponta a ponta (não só ler o código). Cada item abaixo tem evidência
> real de execução — comando rodado e saída obtida — não é suposição.

## Resumo executivo

- `npm install`, `npm run build`, `npm run typecheck`: ✅ limpos
- `npm test`: 415/415 passam (o número do README está correto)
- `npm run lint`: ❌ falha — incompatibilidade de versão do ESLint
- Execução E2E real (scaffold → status → detect → audit → assess → run → evolve → doctor → validate → report): rodou, mas revelou **3 bugs reais** e **1 inconsistência de documentação**

Um dos bugs (regex do scaffolder) já foi corrigido e testado nesta sessão — está abaixo com o diff aplicado. Os outros 3 ainda estão **abertos** e precisam de decisão/implementação.

---

## 🐛 BUG 1 — RESOLVIDO: Regex corrompe `shitenno-profile/*.config.ts`

### Causa raiz

Em `src/scaffolder.ts`, a função que gera o profile do projeto usa:

```ts
.replace(/areas: \[.*?\]/s, `areas: [\n${areasStr}\n  ]`)
```

O placeholder no template (`src/templates/base/shitenno-profile/_template.config.ts`) é a string literal `"[AREAS]"` — que contém um `]` **dentro da própria string**. A regex non-greedy `.*?\]` para no primeiro `]` que encontra, que é esse colchete literal, não o fechamento real do array. Resultado: o arquivo gerado fica com sintaxe TypeScript inválida — conteúdo duplicado depois do `]`:

```ts
areas: [
  "src",
]",        // ← lixo: resíduo do placeholder original
],
```

### Correção aplicada

```diff
- const profileContent = profileTemplate
-   .replace(/\[PROJECT_NAME\]/g, projectName)
-   .replace(/areas: \[.*?\]/s, `areas: [\n${areasStr}\n  ]`);
+ // NOTA: o placeholder "[AREAS]" contém um "]" literal dentro da string.
+ // Uma regex genérica `areas: \[.*?\]` (non-greedy) para nesse colchete
+ // literal, não no fechamento real do array, corrompendo o arquivo gerado.
+ // Por isso a regex aqui ancora explicitamente no padrão exato do
+ // placeholder + a quebra de linha + o "]" de fechamento que vem depois.
+ const profileContent = profileTemplate
+   .replace(/\[PROJECT_NAME\]/g, projectName)
+   .replace(/areas: \[[\s\S]*?"\[AREAS\]",\s*\n\s*\]/, `areas: [\n${areasStr}\n  ]`);
```

**Arquivo:** `src/scaffolder.ts`, função que gera `ProjectProfile` (próximo ao comentário `// Generate ProjectProfile`).

### Teste de regressão adicionado

Em `src/__tests__/scaffolder.test.ts`, novo bloco `describe("generated shitenno-profile/*.config.ts content")` com 5 testes que leem o **conteúdo real** do arquivo gerado (não só verificam se ele existe):

```ts
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from "node:fs";
// ... (adicionar readFileSync ao import existente)

describe("generated shitenno-profile/*.config.ts content", () => {
  const coreCaps: Capability[] = ["core", "knowledge"];

  function readGeneratedProfile(dir: string): string {
    const projectName = dir.split(/[/\\]/).pop()!.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const profilePath = join(dir, "shitenno-profile", `${projectName}.config.ts`);
    expect(existsSync(profilePath)).toBe(true);
    return readFileSync(profilePath, "utf-8");
  }

  it("does not leak the [AREAS] placeholder literal into the generated file", () => {
    scaffoldShitenno(tempDir, makeAnswers(), coreCaps);
    const content = readGeneratedProfile(tempDir);
    expect(content).not.toContain("[AREAS]");
  });

  it("does not contain duplicated/corrupted array syntax after areas:", () => {
    scaffoldShitenno(tempDir, makeAnswers(), coreCaps);
    const content = readGeneratedProfile(tempDir);
    expect(content).not.toMatch(/\]"\s*,?\s*\n\s*\],/);
  });

  it("produces an areas array that is valid, parseable TypeScript syntax", () => {
    scaffoldShitenno(tempDir, makeAnswers(), coreCaps);
    const content = readGeneratedProfile(tempDir);
    const match = content.match(/areas:\s*\[([\s\S]*?)\]/);
    expect(match).not.toBeNull();
    if (!match) throw new Error("areas array not found in generated profile");
    const inner = (match[1] ?? "").trim();
    const isValidStringArrayBody = /^("[^"]*",?\s*)*$/.test(inner);
    expect(isValidStringArrayBody).toBe(true);
  });

  it("includes the real detected area (src/) inside the areas array, exactly once", () => {
    scaffoldShitenno(tempDir, makeAnswers(), coreCaps);
    const content = readGeneratedProfile(tempDir);
    const occurrences = content.split('"src"').length - 1;
    expect(occurrences).toBe(1);
  });

  it("keeps the fields that follow areas (sensitiveKeywords, churnWindowDays) intact", () => {
    scaffoldShitenno(tempDir, makeAnswers(), coreCaps);
    const content = readGeneratedProfile(tempDir);
    expect(content).toContain("sensitiveKeywords:");
    expect(content).toContain("churnWindowDays:");
    expect(content).toContain("export const profile: ProjectProfile = {");
  });
});
```

**Validação feita:** revertendo a correção temporariamente, o teste `does not contain duplicated/corrupted array syntax` **falha** (prova de que pega a regressão de verdade). Com a correção, 420/420 testes passam (415 originais + 5 novos), build e typecheck limpos.

---

## 🐛 BUG 2 — ABERTO: `shugo run` ignora o lifecycle gate que `shugo evolve` respeita

### Evidência

```bash
$ shugo evolve
⚠ Command 'evolve' cannot run in 'assessed' state.
Required state: governed or later.

$ shugo run
✔ Pipeline complete — 5 stage(s) succeeded
  ✔ analyze (1ms)
  ✔ score (31ms)
  ✔ detect (2ms)
  ✔ audit (1ms)
  ✔ evolve (3ms)          ← roda o MESMO estágio de evolução, sem bloqueio
```

No mesmo estado do projeto (`assessed`), chamar `shugo evolve` diretamente é bloqueado pela state machine, mas o estágio `evolve` dentro de `shugo run` executa sem checagem.

### Causa raiz

Em `src/commands/run.ts`, o `checkLifecycleGate` é chamado **uma vez para o comando `"run"` como um todo**, não para cada estágio individual do pipeline:

```ts
if (!checkLifecycleGate("run", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
// ...
.addStage(evolveStage); // nunca checa o gate específico de "evolve"
```

### Sugestão de correção

Decidir conscientemente uma das duas opções (isto é uma decisão de design, não só código):

**Opção A — Pipeline respeita os gates de cada estágio:**
```ts
// Dentro de evolveStage.execute, ou antes de adicionar o stage:
if (!checkLifecycleGate("evolve", ctx.projectRoot, ctx.shitennoDir, true)) {
  // pular o estágio com aviso, não abortar o pipeline inteiro
  return { ...ctx, errors: [...ctx.errors, { stage: "evolve", error: new Error("Skipped: lifecycle gate not met") }] };
}
```

**Opção B — Documentar que `run` é uma "via expressa" intencional**, que avança o estado conforme necessário em vez de bloquear (mais alinhado com "Shugo propõe, humano decide": rodar `run` é uma ação humana explícita, então pode ser tratado como consentimento implícito para rodar tudo). Se for essa a intenção, adicionar um comentário explícito no código justificando, para não parecer um descuido da próxima vez que alguém ler.

Qualquer que seja a escolha, o estado atual (gate existe num caminho, não existe no outro, sem explicação) é a pior opção das três porque parece inconsistência não-intencional.

---

## 🐛 BUG 3 — ABERTO: `shugo report` mostra a mesma dimensão como força E fraqueza

### Evidência

```
💡 Insights
   ✅ Sua força está em Visão Arquitectural. Score: 50/100.
   ⚠️ Área com mais potencial de melhoria: Visão Arquitectural. Score: 50/100.
```

(Ocorreu quando todas as 7 dimensões estavam empatadas em 50/100 — cenário real de projeto novo, não artificial.)

### Causa raiz

Em `src/performance-reporter.ts`:

```ts
let strongest: PerformanceDimension = "decision_making";  // mesmo valor inicial
let weakest: PerformanceDimension = "decision_making";    // mesmo valor inicial

for (const d of allDimensions) {
  if (report.score > maxScore) { maxScore = report.score; strongest = d; }
  if (report.score < minScore) { minScore = report.score; weakest = d; }
}
```

Comparações estritas (`>`, `<`) nunca disparam quando todos os scores são iguais — `strongest` e `weakest` ficam parados no valor inicial idêntico (`decision_making`, ou seja lá qual for a primeira dimensão iterada com o mesmo score).

### Sugestão de correção

Tratar o caso de empate explicitamente — ou inicializar com a primeira dimensão real do array (não um valor hardcoded fixo), ou detectar empate e ajustar a mensagem:

```ts
const scores = allDimensions.map(d => ({ dim: d, score: getScore(d) }));
const maxScore = Math.max(...scores.map(s => s.score));
const minScore = Math.min(...scores.map(s => s.score));
const isAllTied = maxScore === minScore;

if (isAllTied) {
  // mensagem diferente: "Todas as dimensões estão equilibradas em X/100"
  // em vez de apontar força/fraqueza que não existem ainda
} else {
  const strongest = scores.find(s => s.score === maxScore)!.dim;
  const weakest = scores.find(s => s.score === minScore)!.dim;
  // ... mensagens normais
}
```

Isso é especialmente importante porque **todo projeto novo começa com dimensões empatadas** — não é um edge case raro, é o estado inicial padrão de qualquer adoção do Shugo.

---

## ⚠️ INCONSISTÊNCIA — ABERTA: README promete 8 estágios, código real tem 5

### Evidência

`README.md`:
> Executes the 8-stage pipeline: Analysis → Complexity → Patterns → Knowledge Debt → Capability Engine → Engineering State → Recommendation Engine → Evolution.

`src/commands/run.ts` (comentário de cabeçalho real):
> Stages: analyze → score → detect → audit → evolve

São 5 estágios na implementação real, com nomes diferentes dos citados no README (`score` ≠ "Complexity" exatamente, mas é o mesmo conceito; "Knowledge Debt", "Capability Engine" e "Engineering State" não aparecem como estágios próprios do pipeline — provavelmente são módulos consumidos *dentro* de `score`/`audit`/`evolve`, não estágios de primeira classe).

### Sugestão

Decidir qual dos dois está certo e corrigir o outro:
- Se a arquitetura **pretendida** é 8 estágios (Knowledge Debt e Capability Engine merecem ser estágios visíveis, não só lógica interna), o `pipeline.ts`/`run.ts` precisa ser expandido.
- Se 5 estágios é o design final correto, o README precisa ser atualizado para não prometer granularidade que não existe — isso é o tipo de coisa que mina confiança quando alguém lê o README e depois usa o CLI.

---

## ⚠️ NÃO-BUG, mas observação relevante: `shugo init` é 100% interativo, sem flag não-interativa

`shugo init` faz 9 blocos de perguntas via `inquirer` (tipos `input`, `checkbox`, `list`, `confirm`), sem nenhuma flag tipo `--yes` ou `--config <file>` para rodar de forma não-interativa/scriptável. Isso é aceitável para uso manual direto pelo Tech Lead, mas significa que **não é possível automatizar a inicialização do Shugo a partir de outro script ou CI** sem ou (a) adicionar essa flag, ou (b) chamar `scaffoldShitenno` programaticamente (que é o que usei para testar nesta sessão, contornando o prompt).

Se o objetivo for permitir, por exemplo, que um template de projeto já venha com Shugo pré-configurado automaticamente, vale considerar adicionar:

```bash
shugo init --answers-file ./shitenno-answers.json
```

Lendo as respostas de um JSON em vez de perguntar interativamente — útil também para reproduzir scaffolds idênticos em múltiplos projetos.

---

## ✅ O que funcionou bem na execução real (não é só leitura de código)

- `scaffoldShitenno` (pós-correção) gera 24 arquivos / 10 pastas corretamente
- `shugo status` produz health check + complexity breakdown por área, granular e legível
- `shugo assess` recalcula o perfil de maturidade e avança o estado da máquina corretamente
- `shugo doctor` dá a saída mais útil de todas — risco, melhoria, e uma seção "Learn" explicando conceito (ADR vs Skill) de forma natural, sem parecer enfeite
- `shugo report` reusa genuinamente as 7 dimensões do `feedback/TEMPLATE.md` original do course-platform — a herança conceitual é real, não só similar de nome
- A lifecycle state machine (`discovered → assessed → governed → ...`) bloqueia uso fora de ordem na maioria dos comandos testados (exceto o Bug 2 acima)

## Como aplicar estas correções

1. Aplicar o diff do **Bug 1** em `src/scaffolder.ts` (já validado nesta sessão — pode aplicar com confiança).
2. Adicionar o bloco de testes do **Bug 1** em `src/__tests__/scaffolder.test.ts`, incluindo `readFileSync` no import de `node:fs` no topo do arquivo.
3. Decidir e implementar a opção certa para o **Bug 2** (gate em `run.ts`) — isto é decisão de design, recomendo discutir antes de codar.
4. Corrigir o **Bug 3** em `src/performance-reporter.ts` — tratamento de empate.
5. Resolver a **inconsistência de 8 vs. 5 estágios** — decidir qual lado corrigir.
6. Rodar `npm run build && npm test && npm run typecheck` depois de cada correção para confirmar que nada regrediu.
