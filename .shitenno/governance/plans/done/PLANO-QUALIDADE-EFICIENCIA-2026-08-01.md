# Plano de Qualidade de Código e Eficiência (2026-08-01)

**Status:** Done
**Updated_at:** 2026-08-01T04:27:47.892Z
**Date:** 2026-08-01

> Plano isolado, não depende dos anteriores. Base: rodei `shugo audit --json` contra o próprio projeto nos 4 níveis (dogfooding real, não suposição) — 664 issues em `standard`, 930 em `code-review`, 957 em `enterprise`. Amostrei as categorias com maior volume em cada nível. Achado central do plano: parte considerável desses números é **falso positivo por heurística de nome sem type-awareness** — os Achados 1 e 5 são a mesma causa raiz em dois detectores diferentes (taint engine e detector de N+1), e ambos merecem prioridade máxima porque, sem corrigir isso, qualquer número de "saúde do código" que o projeto reporta pra si mesmo é ruído parcialmente inventado. Os Achados 6-9 são diferentes — não são bug da ferramenta, são dívida técnica/decisão real, confirmada, mas que não cabe numa correção de uma linha.

---

## Achado 1 (CRÍTICO) — `crossFile` do motor de taint está produzindo falso positivo com descrição que não corresponde ao código real

Amostrando os 19 issues de `command_injection`, a maioria repete a mensagem idêntica: *"Tainted data from context.timestamp reaches exec()"*, espalhada por 5+ arquivos completamente não relacionados (`src/audit/shared.ts`, `src/audit/supply/dependencies.ts`, `src/audit/docs/helpers.ts`, `src/audit/docs/refs.ts`...). Fui no código real de um deles:

```ts
// src/audit/shared.ts:72 — o que a auditoria aponta como "command injection via exec()"
export function readRules(shitennoDir: string): string[] {
  const agentsPath = join(shitennoDir, "docs", "AGENTS.md");
  ...
  const numberedRegex = /^\d+\.\s+\*\*([^*]+)\*\*/gm;
  ...
}
```
**Não tem `exec()` nenhum nessa função.** Não tem `context.timestamp`. A descrição do issue está factualmente desconectada do código na linha apontada. Isso são **37 issues** (de 664) com esse padrão exato — provavelmente o motor de análise cross-file (ligado por padrão desde a última rodada, `crossFile: options.crossFile ?? true`) está confundindo variáveis/propriedades de mesmo nome (`context`, `timestamp`) entre arquivos totalmente diferentes, e construindo uma cadeia de taint que não existe de verdade — um problema clássico de análise cross-file ingênua: rastrear por *nome* de identificador em vez de rastrear por *aresta real de import/export*.

Isso é mais grave do que "número inflado" — é uma ferramenta de segurança relatando evidência que não bate com o código, o que é exatamente o tipo de coisa que faz um time parar de confiar no relatório e ignorar tudo, inclusive os achados reais que estão junto (o hardcoded_secret e o sql_injection continuam válidos, só que agora enterrados em ruído).

**Recomendação, mais forte do que a anterior:** não é só "gatear por nível" (como o plano anterior já pedia) — é **manter `crossFile` desligado por padrão até a lógica de propagação ser corrigida pra rastrear aresta de import real, não nome de identificador solto**. O gate por nível ainda vale (performance), mas agora tem uma segunda razão, de correção, pra não ser o default em lugar nenhum:

```ts
// src/audit/detector-map/engineering.ts (ou onde o TaintAnalyzer é instanciado)
const analyzer = new TaintAnalyzer({
  projectRoot: ctx.projectRoot,
  crossFile: false, // manter desligado até a Correção 1.1 abaixo
});
```

**Correção 1.1 — investigar a causa raiz antes de reativar** (não estou propondo o fix da lógica interna aqui, porque não pesquisei o grafo de propagação a fundo o suficiente pra garantir que a mudança certa — isso merece uma sessão dedicada só nisso). O ponto de partida pro agente investigar: `src/audit/taint/graph.ts` — como o grafo de fluxo de dados decide que duas ocorrências de `context.timestamp` em arquivos diferentes são "a mesma variável tainted", em vez de duas variáveis não relacionadas que coincidem de nome. Provavelmente falta amarrar o nó do grafo ao `ts.Symbol` real (via `TypeChecker.getSymbolAtLocation`) em vez de comparar só o texto do identificador.

**Teste de regressão pra travar isso:**
```ts
// src/__tests__/taint-analyzer.test.ts — adicionar
it("NÃO confunde variáveis de mesmo nome em arquivos diferentes (crossFile)", () => {
  // arquivo A: `context.timestamp` genuinamente tainted (vem de req.query)
  // arquivo B: `context.timestamp` é só um Date.now() local, sem nenhuma fonte externa
  // rodar com crossFile:true e garantir que só o arquivo A gera issue, não o B
});
```

---

## Achado 2 — `isFileReferenced`/`detectUnusedExports` não distingue "usado pela aplicação" de "usado só pelo próprio teste"

Já expliquei isso na conversa anterior — repito aqui porque é item deste plano de qualidade, e o dado novo é a escala real: dos **64 `orphan_module`** e **380 `unused_export`** reportados, uma fração desconhecida hoje é esse padrão específico (confirmei pelo menos 2 casos concretos: `task-completion-pipeline.ts` e `session-bootstrapper.ts`, ambos históricos desta auditoria).

```ts
// src/audit/engineering/code-health.ts
function isFileReferenced(file: SourceFileInfo, files: SourceFileInfo[], exports: Set<string>): boolean {
  const isTestFile = (f: SourceFileInfo) => f.relPath.includes("__tests__/") || f.relPath.endsWith(".test.ts");

  const isImportedByPath = files.some((other) => {
    if (other.fullPath === file.fullPath) return false;
    if (isTestFile(other) && !isTestFile(file)) return false;
    return other.content.includes(`/${file.basename}.js"`) || other.content.includes(`/${file.basename}"`) || other.content.includes(`/${file.basename}.ts"`);
  });
  if (isImportedByPath) return true;
  if (exports.size === 0) return false;
  return [...exports].some((symbol) => files.some((other) => {
    if (other.fullPath === file.fullPath) return false;
    if (isTestFile(other) && !isTestFile(file)) return false;
    return new RegExp(`\\b${symbol}\\b`).test(other.content);
  }));
}
```
Mesma mudança em `detectUnusedExports` (linha ~153, o `files.some((other) => ...)` que checa `isImported`).

**Depois de aplicar, rodar `shugo audit --json` de novo e comparar a contagem de `orphan_module`/`unused_export`** — se subir bastante, é sinal de que existe mais código morto do gênero task-completion-pipeline que ninguém percebeu ainda. Vale revisar a lista nova manualmente antes de apagar qualquer coisa (o detector aponta candidato, não sentença).

---

## Achado 3 — `isFileReferenced` também falso-positiva em `orphan_module` pro app de dashboard (import dinâmico/config de rota)

Amostrando os 64 `orphan_module`, a maioria é `apps/shitenno-dashboard/src/pages/architecture/*.tsx` — arquivos de página de uma SPA React que, plausivelmente, são referenciados via config de rota (`react-router` com import dinâmico ou objeto de rotas), não por um texto literal `"/NomeDoArquivo"` em outro arquivo, que é tudo que `isFileReferenced` sabe procurar.

**Antes de "corrigir" isso genericamente, confirmar a hipótese** — pedir ao agente pra abrir `apps/shitenno-dashboard/src/` e procurar como as páginas são registradas (`import()` dinâmico dentro de um array de rotas é o padrão mais comum). Se confirmado:

```ts
// src/audit/engineering/code-health.ts — detectOrphanModules
const nonOrphanFiles = files.filter((f) =>
  !f.fullPath.includes("/commands/") &&
  !f.fullPath.includes("/console/") &&
  !f.fullPath.includes("/pages/") // rotas de SPA são referenciadas via config, não import literal
);
```
Ou, melhor que excluir a pasta inteira (menos preciso): ensinar `isFileReferenced` a também procurar o padrão `import(".../NomeDoArquivo")` (import dinâmico) além do `import "..."` estático que já procura. A exclusão por pasta é mais rápida de aplicar; o reconhecimento de import dinâmico é mais correto e vale mais a pena se o `apps/shitenno-dashboard` crescer.

---

## Achado 4 — `empty_catch` (77 ocorrências) não distingue catch comentado/intencional de catch genuinamente silencioso

Amostrei um caso em `bin/shugo.ts:158`:
```ts
try {
  branch = execSync("git branch --show-current", { ... }).trim();
} catch {
  // not a git repo or git not available — skip
}
```
Isso é uma decisão de design legítima e comentada — "best effort, segue sem branch se não tiver git" — não é um erro real sendo escondido. O detector atual provavelmente marca qualquer bloco `catch` sem conteúdo executável como issue, sem checar se há um comentário explicando a omissão.

**Correção sugerida** (reduz ruído sem perder o caso real que importa — catch vazio SEM explicação):
```ts
// onde detectEmptyCatchBlocks estiver definido
function isJustifiedEmptyCatch(catchBlockText: string): boolean {
  // catch { /* comentário */ } — considera justificado se tem qualquer comentário dentro
  return /catch\s*(?:\([^)]*\))?\s*\{\s*\/[/*]/.test(catchBlockText);
}
```
Aplicar esse filtro antes de reportar. **Não recomendo suprimir o issue inteiro** — só rebaixar a severidade ou mudar a mensagem pra "catch vazio comentado — confirmar se a omissão é intencional" em vez de tratar igual a um catch genuinamente mudo. Isso mantém o sinal (ainda vale revisar) sem inflar a contagem com falso alarme.

---

## Achado 5 — `detectNPlusOne` é regex pura, mesma causa raiz do Achado 1 (falso positivo por nome de método, sem type-awareness)

Achado na validação de ponta a ponta seguinte, incluído aqui porque é a mesma classe de problema do Achado 1. Peguei a implementação real:

```ts
// src/audit/performance-detectors.ts — como está hoje
const loopWithQueryPattern = /(?:for|while|forEach)\s*\([^)]*\)\s*\{[^}]*(?:\.find|\.findOne|\.findAll|\.query|SELECT)/g;
```
Isso casa **qualquer** `.find(` dentro de um loop — inclusive `Array.prototype.find` em array constante em memória. Confirmei em `src/commands/status/display.ts:137`:
```ts
for (const cap of installedCapabilities) {
  const info = CAPABILITIES.find((c) => c.id === cap); // CAPABILITIES é array fixo, não banco
}
```
9 dos 664+ issues (nível enterprise) são esse falso positivo.

**Correção sugerida** — exigir que o objeto antes do método pareça um client de banco/ORM, não apenas o nome do método:
```ts
// src/audit/performance-detectors.ts
const DB_LIKE_OBJECT_NAMES = /\b(?:db|database|prisma|knex|mongo|mongoose|sequelize|pool|connection|conn|client|repository|repo|orm|query(?:Builder)?)\s*\.\s*(?:find|findOne|findAll|query)\s*\(/i;
const loopWithQueryPattern = new RegExp(
  `(?:for|while|forEach)\\s*\\([^)]*\\)\\s*\\{[^}]*(?:${DB_LIKE_OBJECT_NAMES.source}|SELECT)`,
  "g"
);
```
Isso reduz falso positivo de "qualquer `.find()`" pra "`.find()`/`.query()` chamado num objeto com nome de client de banco" — ainda é heurística de nome (não tem acesso a tipo aqui), mas já corta o caso mais comum (`Array.find()` em array local). Testar contra o corpus do `Item 0` do plano de segurança anterior antes de travar — adicionar um fixture negativo (`CAPABILITIES.find()` não deveria disparar) e um positivo (`db.query()` dentro de loop deveria).

Se quiser precisão de verdade (não só reduzir o ruído), a correção completa é a mesma do Achado 1: usar `ts.TypeChecker` pra checar o tipo real do objeto antes de flagar, não regex de nome. Tratar como parte da mesma sessão dedicada da Correção 1.1.

---

## Achado 6 — `circular_dep`: 7 dependências circulares reais entre módulos

Diferente dos achados 1 e 5, este **não é falso positivo** — é uma dívida arquitetural real, confirmada:
```
src/constants → src/rule-engine → src/rule-engine/actions → src/constants
src/rule-engine/engine → src/decision-core/invoke → src/rule-engine/index → src/rule-engine/engine
src/decision-core/invoke → src/action-engine → src/action-engine/engine → src/decision-core/invoke
```
`constants.ts` devia ser uma folha da árvore de dependências (só exporta valores fixos, não devia importar nada de volta de `rule-engine`). O padrão dos outros dois ciclos é parecido: um módulo "index"/"engine" e um módulo que ele orquestra importando um do outro.

**Não vou propor o refactor completo aqui** — quebrar um ciclo de import exige entender qual pedaço específico de `constants.ts` o `rule-engine` usa e se dá pra extrair só aquele pedaço pra um arquivo à parte (ex.: `rule-engine-constants.ts`) sem quebrar o resto. Isso é trabalho de investigação, não uma correção de uma linha — recomendo tratar como item de backlog técnico, com uma sessão dedicada a mapear os 3 ciclos e decidir o ponto de corte de cada um. Não bloqueia nada do resto deste plano.

---

## Achado 7 — `srp_violation`: candidatos reais a quebrar em módulos menores (68 ocorrências, backlog de refactor)

Sampleei 2 dos 68:
```
.shitenno/scripts/close-session.ts — 12 funções, 4 responsabilidades
bin/shugo.ts — 9 funções, 7 responsabilidades
```
Ambos plausíveis dado o histórico (o `close-session.ts` passou por uma reescrita inteira na migração do `task-completion-pipeline.ts`; `bin/shugo.ts` é o entrypoint e tende a acumular registro de comando + setup de hooks + bootstrap de daemon no mesmo lugar). Não tenho o desenho de como split-ar cada um — isso é decisão de arquitetura, não uma correção mecânica. Recomendo: pedir ao agente pra listar os 68 completos, agrupar por "arquivo com mais responsabilidades" primeiro, e tratar como backlog técnico contínuo (um ou dois por sessão), não uma correção de uma vez.

---

## Achado 8 — `dead_rule`: 20 regras do `AGENTS.md` nunca referenciadas em 54 sessões (decisão, não código)

```
Regra "NUNCA FAÇA COMMIT SEM PERMISSÃO:" nunca mencionada em 54 sessões
Regra "COMMITS CURTOS EM INGLÊS:" nunca mencionada em 54 sessões
Regra "BOOTSTRAP E SETUP PROATIVO:" nunca mencionada em 54 sessões
```
Antes de apagar qualquer uma: o critério de "nunca mencionada" provavelmente é menção textual literal do nome da regra em log de sessão — um agente pode seguir a regra sem citar o nome dela, então o detector pode estar subestimando quantas são realmente seguidas. Recomendo revisar a lista das 20 manualmente (não em lote) antes de remover — decisão sua, não um fix de código.

---

## Achado 9 — `orphan_skill`: 17 skills documentadas só em prosa, sem detector correspondente (decisão, não código)

```
docs/skills/architectural_integrity.md — sem detector associado
docs/skills/ci_cd_pipeline.md — sem detector associado
docs/skills/clean_code_standards.md — sem detector associado
```
Não é necessariamente erro — nem toda skill precisa virar detector automático. Mas vale checar se alguma das 17 já está coberta por um detector que existe com outro nome (ex.: `clean_code_standards.md` provavelmente se sobrepõe com `srp_violation`/`deep_nesting`/`god_function` do Achado 7) — se sim, a skill em prosa fica redundante e pode ser cortada ou reduzida a um link pros detectores reais, em vez de manter as duas versões (prosa + código) divergindo com o tempo.

---

## Eficiência — o que já foi resolvido em rodadas anteriores não entra aqui de novo

Não vou repetir dirty-check/auditoria incremental/hooks reativos — já confirmados funcionando nas validações anteriores. O item de eficiência novo desta rodada é o próprio **Achado 1**: rodar `crossFile` por padrão não é só impreciso, é caro (confirmei ~400MB/instância na validação anterior) — desligar por padrão resolve os dois problemas de uma vez, correção e performance, com a mesma mudança de uma linha.

---

## Ordem sugerida

1. **Achado 1** — desligar `crossFile` por padrão (1 linha, remove o problema mais grave imediatamente, sem esperar o fix da causa raiz).
2. **Achado 2** — fix do `isFileReferenced`/`detectUnusedExports` pra ignorar import só-de-teste.
3. **Achado 5** — mitigar `detectNPlusOne` (exigir nome de objeto tipo client de banco, não qualquer `.find()`) — mesmo lote de correção do item 1/2, é regex de baixo risco.
4. **Rodar `shugo audit --json` de novo** depois de 1+2+3, comparar a contagem de issues por tipo com os 664/957 originais — isso vira a métrica real de "quanto do relatório de saúde era ruído".
5. **Achado 3** — confirmar a hipótese do import dinâmico no dashboard antes de aplicar a exclusão de pasta.
6. **Achado 4** — reduzir ruído do `empty_catch` (mais cosmético, mais baixa prioridade).
7. **Achado 8** — revisar as 20 `dead_rule` manualmente, decidir o que cortar do `AGENTS.md` (decisão sua, baixo esforço de execução).
8. **Achado 9** — revisar as 17 `orphan_skill`, cortar redundância com detectores existentes onde fizer sentido.
9. **Achado 6** (dependências circulares) e **Achado 7** (`srp_violation`) — backlog técnico contínuo, tratar como refactor de fundo, um item por vez, sem pressa e sem bloquear o resto.
10. **Correção 1.1** (causa raiz do crossFile, cobre também a raiz do Achado 5) — por último, é a mais cara e a que precisa de investigação mais profunda; não bloqueia nada dos outros itens.
