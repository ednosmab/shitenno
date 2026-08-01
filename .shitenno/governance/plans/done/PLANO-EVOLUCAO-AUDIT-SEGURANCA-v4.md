# Plano de Evolução do Audit de Segurança — v4 (consolidado, com código, testado ao vivo)

**Status:** Done
**Updated_at:** 2026-07-31T15:23:15.702Z
**Date:** 2026-07-31

> v4 incorpora o v3 inteiro (nenhum item removido) + os achados de duas rodadas de teste de
> profundidade: (1) build real do projeto, execução dos 4 níveis (`quick/standard/code-review
> /enterprise`) contra o próprio shitenno (656 arquivos), e (2) 8 fixtures isolados, um por
> variável testada, com fonte HTTP direta e sink no caminho mais comum do ecossistema Node,
> pra separar "falta padrão na lista" de "o mecanismo em si não funciona como o código sugere".
>
> Critério de corte mantido do v3: só entra o que corrige um gap confirmado no código real
> (grep + leitura da implementação) ou um PoC reproduzível — nada especulativo. Itens novos
> estão marcados **[NOVO v4]**; itens do v3 ganharam anotação **[confirmado com PoC]** onde
> testei ao vivo, ou **[precisão]** onde o teste ao vivo revelou uma nuance que muda o texto
> original sem mudar a conclusão.
>
> Decisão de escopo mantida: nenhuma ferramenta/serviço de terceiros. Ecossistema
> Node.js/JavaScript/TypeScript. Instalado em projeto de terceiro, não só nos projetos do
> autor.

---

## Item 0 — Benchmark de detecção mensurável (fundação, inalterado)

Corpus de fixtures com vulnerabilidades conhecidas + teste que mede detecção/falso-positivo
por categoria: `src/audit/__fixtures__/vuln-corpus/` + `security-benchmark.test.ts`. Categorias
via CWE Top 25 / OWASP Top 10 como checklist de referência.

**[NOVO v4]** Ajuste ao corpus, motivado pelo achado do Item 1e: cada sink do motor de taint
precisa de **duas** fixtures, não uma — uma chamando o sink "nu" (`query(sql)`, caso raro) e
outra chamando via objeto (`pool.query(sql)`, `res.redirect(url)`, `knex.raw(sql)` — o caso
que é 100% do código real). Hoje o corpus provavelmente só cobre o padrão que o motor
detecta, o que mascara o Item 1e (o benchmark passaria "verde" mesmo com o bug, porque nunca
testou o caso realista).

```
src/audit/__fixtures__/vuln-corpus/
  sql-injection/
    bare-call-vuln.ts        # query(sql) — já coberto hoje
    object-call-vuln.ts      # pool.query(sql) — NOVO, expõe o Item 1e
    multi-statement-vuln.ts  # sql construído em 2+ linhas — NOVO, expõe o Item 1e-bis (§3 abaixo)
  open-redirect/
    object-call-vuln.ts      # res.redirect(url) — categoria inteira sem fixture hoje
  prototype-pollution/
    multiline-for-in-vuln.ts # for(...) { obj[k]=v } em linhas separadas — NOVO, expõe o Item 4b
  cors/
    wildcard-credentials-vuln.ts  # cors({origin:"*",credentials:true}) — NOVO, expõe o Item 1f
  hardcoded-secrets/
    env-fallback-vuln.ts     # process.env.X || "valor-fixo" — NOVO, expõe o Item 1f
```

---

## Item 1 — Correções imediatas nos gaps confirmados **[confirmado com PoC ao vivo]**

**1a. `detectWeakCrypto` não pega import destructurado.** Confirmado com dano real: o próprio
shitenno tem 3 usos reais de MD5/SHA1 não detectados (`src/audit/taint/analyzer.ts:111`,
`src/audit/ts-program-cache.ts:35`, `src/audit/shared.ts:120`).

Achado extra não previsto no v3: o único `weak_crypto` que o audit *reportou* no projeto
inteiro foi o detector se autodetectando — a regex em `src/audit/security/crypto.ts:17`
contém o texto `.createHash(` e bate nela mesma. O arquivo já importa
`isDetectorDefinitionFile` (usado por `detectXSS` e outros no mesmo diretório) mas
`detectWeakCrypto` não chama esse helper. Corrigir os dois problemas juntos:

```ts
// src/audit/security/crypto.ts
import { isDetectorDefinitionFile } from "./helpers.js";

export function detectWeakCrypto(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const weakPatterns = [
    // aceita tanto ".createHash(" quanto "createHash(" nu (import destructurado)
    /(?:^|[.\s(])createHash\s*\(\s*["'](?:md5|sha1)["']\)/i,
    /(?:^|[.\s(])createCipher(?!iv)\s*\(/i,
    /(?:^|[.\s(])createDecipher(?!iv)\s*\(/i,
    /crypto\.createCipheriv\s*\([^)]*[^"']md5/i,
  ];

  for (const file of files) {
    if (isDetectorDefinitionFile(file.relPath)) continue;  // ← faltava isso
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (weakPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "weak_crypto", severity: 2,
          description: `Criptografia fraca em "${file.relPath}:${i + 1}" — MD5/SHA1 ou createCipher`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar algoritmos modernos: SHA-256+, AES-256-GCM em vez de MD5/SHA1",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
```

**1b. XSS não conhece `res.send`/`res.write`/`res.end`.** Confirmado com PoC:
`res.send("<div>" + req.query.name + "</div>")` — zero detecção, testado nos dois motores
(regex e taint). Código do v3 mantido:

```ts
// src/audit/taint/sinks.ts — adicionar ao XSS_SINKS
{ name: "res.send", kind: "call", severity: 2, issueType: "xss_risk", description: "res.send() — HTTP response body" },
{ name: "res.write", kind: "call", severity: 2, issueType: "xss_risk", description: "res.write() — HTTP response chunk" },
{ name: "res.end", kind: "call", severity: 2, issueType: "xss_risk", description: "res.end() — HTTP response end" },
```
```ts
// src/audit/taint/issue-builder.ts — heurística de contexto pra reduzir falso positivo
function looksLikeHtml(sinkNode: TaintNode): boolean {
  return /<[a-z][\s\S]*>/i.test(sinkNode.text);
}
function buildIssue(sink: TaintNode, sourceNodes: TaintNode[], graph: DataFlowGraph, options: IssueBuilderOptions): TaintIssue | null {
  const sinkDef = findTaintSink(sink.variableName ?? "");
  const isHttpResponseSink = ["res.send", "res.write", "res.end"].includes(sinkDef?.name ?? "");
  if (isHttpResponseSink && !looksLikeHtml(sink)) return null;
  // ...resto igual
}
```
⚠️ **Depende do Item 1e abaixo** — como está, `res.send` só bateria em `findTaintSink` se a
definição usar path completo (`"res.send"`, não `"send"`), então esse item já nasce correto
nesse aspecto — mas confirma que o Item 1e precisa ser corrigido *antes*, ou os outros sinks
adicionados nesta rodada caem na mesma armadilha.

**1c. `req.file` (singular) ausente de `sources.ts`.** Código do v3 mantido, sem mudança.

---

## Item 1d — `unsafe_deserialize` com falso-positivo sistemático **[NOVO v4]**

3º tipo de issue mais frequente no `enterprise` do próprio shitenno (79 ocorrências) — causa
raiz identificada com precisão (o relatório anterior tinha só a suspeita, agora tem o
mecanismo exato):

```ts
// src/audit/security/injection.ts — unvalidatedJsonPatterns
/JSON\.parse\s*\(.*readFile/
```
Essa regex bate em **qualquer** `JSON.parse(readFileSync(path))` — o idiom mais comum e mais
inofensivo de ler config local em Node — porque `readFile` aparece como substring de
`readFileSync`, chamado *dentro* da própria expressão do `JSON.parse`. Confirmado nas 79
ocorrências: todas são leitura de arquivo local (`.shitenno/*.json`, `package.json`,
`audit-suppressions.json`), zero são payload de rede.

Problema conceitual maior: `JSON.parse` **nunca executa código**, independente da fonte — ao
contrário de `vm.runInNewContext`/`node-serialize`/`js-yaml.load`, que são RCE de verdade. A
categoria `unsafe_deserialize` está misturando dois riscos diferentes: (a) desserialização
insegura = RCE, e (b) falta de schema validation = robustez/integridade de dados, não
execução de código. Correção: separar os dois em issue types diferentes e restringir o
padrão de JSON.parse a fontes genuinamente não confiáveis.

```ts
// src/audit/security/injection.ts
const realDeserializationSinks = [
  /js-yaml['"]\)?\.load\s*\(/,
  /node-serialize['"]\)?\.unserialize\s*\(/,
  /vm\.runInNewContext\s*\(/,
  /vm\.runInThisContext\s*\(/,
];

// Removido o padrão "readFile" solto — leitura de arquivo local não é fonte não confiável.
// Mantidos só os que de fato indicam dado externo/rede/CLI.
const unvalidatedJsonPatterns = [
  /JSON\.parse\s*\(.*req\./,
  /JSON\.parse\s*\(.*process\.argv/,
  /JSON\.parse\s*\(.*socket\./,
  /JSON\.parse\s*\(.*\.body\b/,
];

for (const file of files) {
  if (isDetectorDefinitionFile(file.relPath)) continue;
  const codeOnly = stripComments(file.content);
  const lines = codeOnly.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (realDeserializationSinks.some((p) => p.test(line))) {
      issues.push({
        type: "unsafe_deserialize", severity: 3,
        description: `Unsafe deserialization em "${file.relPath}:${i + 1}" — risco de RCE`,
        location: `${file.relPath}:${i + 1}`,
        recommendation: "Usar yaml.safeLoad(), vm.runInNewContext com sandbox, ou evitar deserialização de input não confiável",
        confidence: 0.65,
      });
    } else if (unvalidatedJsonPatterns.some((p) => p.test(line))) {
      // Categoria separada — não é RCE, é robustez de parsing
      issues.push({
        type: "missing_schema_validation", severity: 1,
        description: `JSON.parse de fonte externa sem schema validation em "${file.relPath}:${i + 1}"`,
        location: `${file.relPath}:${i + 1}`,
        recommendation: "Validar JSON com schema (zod/joi) antes de processar",
        confidence: 0.6,
      });
    }
  }
}
```

---

## Item 1e — Bug estrutural no matching de sinks do motor de taint **[NOVO v4 — maior achado]**

`findTaintSink()` (`src/audit/taint/sinks.ts`) faz `s.name === name`, igualdade exata.
`getCallName()` (`src/audit/taint/ast-utils.ts:27`) retorna o **path pontilhado completo**
quando a chamada é via propriedade de objeto: `pool.query(...)` → `"pool.query"`,
`res.redirect(...)` → `"res.redirect"`, `fs.readFile(...)` → `"fs.readFile"`. Só retorna
nome nu (`"query"`) quando a chamada é um identificador solto — import destructurado sem
prefixo.

As definições em `sinks.ts` são majoritariamente nomes nus:
```ts
export const SQL_SINKS = [{ name: "query" }, { name: "execute" }, { name: "raw" }];
export const REDIRECT_SINKS = [{ name: "redirect" }, ...];
export const PATH_SINKS = [{ name: "readFile" }, { name: "writeFile" }, ...];
```
Isso significa: **SQL injection e Open Redirect via motor de taint são inatingíveis** para o
estilo de chamada mais comum de qualquer driver/ORM real (`pool.query()`, `db.execute()`,
`knex.raw()`, `res.redirect()` — não existe forma idiomática de chamar essas APIs sem
prefixo de objeto). `PATH_SINKS` só funciona quando o import é destructurado
(`import { readFileSync } from "fs"`, chamado nu) — funciona parcialmente por acaso, não por
design.

**PoC confirmado** (fonte HTTP direta, mesma função, caso mais fácil possível):
```ts
app.get("/user", async (req, res) => {
  const id = req.query.id;
  const sql = "SELECT * FROM users WHERE id = " + id;
  const result = await pool.query(sql);   // taint engine: SILÊNCIO TOTAL
});
app.get("/go", (req, res) => {
  const dest = req.query.url;
  res.redirect(dest as string);           // taint engine: SILÊNCIO TOTAL, nenhum detector pega
});
```

**Correção — casar por sufixo de path, não igualdade exata:**
```ts
// src/audit/taint/sinks.ts
export function findTaintSink(name: string): TaintSinkDef | undefined {
  return ALL_SINKS.find((s) => name === s.name || name.endsWith("." + s.name));
}
```
Isso resolve `pool.query` → bate em `"query"`, `res.redirect` → bate em `"redirect"`, sem
quebrar os casos que hoje já funcionam (nome nu continua batendo em si mesmo). Risco de
efeito colateral: nomes de método genéricos e curtos (`"raw"`, `"execute"`) podem colidir com
métodos homônimos não relacionados a SQL (ex.: `template.raw()` de alguma lib de template).
Mitigar com confidence um pouco mais baixa (0.55 em vez de 0.65) pros sinks que ganharam esse
matching mais amplo, e cobrir esse caso especificamente no benchmark do Item 0
(`object-call-vuln.ts` + um fixture *seguro* com método homônimo não relacionado, pra medir
falso-positivo).

**Este item precisa entrar antes do 1b** — os sinks `res.send`/`res.write`/`res.end` que o
Item 1b adiciona são paths completos com `.`, então só funcionam de verdade depois dessa
correção (com igualdade exata eles até bateriam, já que são definidos com o path completo —
mas o padrão geral do arquivo `sinks.ts` fica inconsistente se não for corrigido junto).

---

## Item 2 — Habilitar análise cross-file (inalterado do v3)

`crossFile` existe como opção mas nunca é passado `true` em nenhum lugar do código —
confirmado por grep completo em `src/`. Ligar, medir custo com o benchmark do Item 0 num
projeto de ~150k linhas (o próprio shitenno), decidir `standard` vs `enterprise` conforme
resultado.

---

## Item 2b — Propagação de taint por parâmetro de função, mesmo dentro do mesmo arquivo **[NOVO v4]**

Mais grave que o Item 2 sozinho resolveria. PoC: handler extrai `req.query.term`, monta SQL,
chama uma função auxiliar **no mesmo arquivo** que executa `pool.query()`:
```ts
function runQuery(sql: string) { return pool.query(sql); }
app.get("/search", (req, res) => {
  const term = req.query.term;
  const sql = "SELECT * FROM items WHERE name = '" + term + "'";
  runQuery(sql);   // taint engine: não propaga pro parâmetro `sql` de runQuery
  res.send("ok");
});
```
Zero `tainted_input`. Mesmo se o Item 2 for implementado e `crossFile: true` virar padrão,
esse caso continuaria falhando, porque o problema é intra-arquivo: `propagateTaintAtCall`
não mapeia argumento tainted → parâmetro correspondente da função chamada. Isso é
pré-requisito conceitual pro Item 2 ter valor real — sem isso, cross-file só ajudaria em
casos onde o dado tainted atravessa o import diretamente como valor, não via chamada de
função (que é o padrão dominante em qualquer API organizada em camadas).

**Esboço de correção** (2 passadas são necessárias por causa de ordem de declaração —
`runQuery` pode ser declarada antes de ser chamada, então o corpo já foi visitado antes de
sabermos que o parâmetro é tainted; isso é mais trabalho de implementação que os itens
anteriores, entra como item de esforço maior, não "correção imediata"):

```ts
// src/audit/taint/ast-visitor.ts
// Passada 1: para cada CallExpression, se o(s) argumento(s) já são tainted no escopo do
// caller, resolve a declaração da função chamada via checker e marca os parâmetros
// correspondentes como tainted no Map de taint global do arquivo (não só do escopo local).
export function propagateTaintThroughLocalCall(
  node: ts.CallExpression,
  variableTaint: Map<string, VariableInfo>,
  checker: ts.TypeChecker,
): void {
  const signature = checker.getResolvedSignature(node);
  const decl = signature?.declaration;
  if (!decl || !(ts.isFunctionDeclaration(decl) || ts.isFunctionExpression(decl) || ts.isArrowFunction(decl))) return;

  node.arguments.forEach((arg, i) => {
    const argName = getSymbolName(arg, checker, variableTaint);
    const argTaint = argName ? variableTaint.get(argName) : undefined;
    if (!argTaint?.tainted) return;
    const param = decl.parameters[i];
    if (!param || !ts.isIdentifier(param.name)) return;
    // Chave por nome do parâmetro — funciona porque a análise é por-arquivo (mesmo Map);
    // colisão de nome entre funções diferentes é um falso-positivo aceitável nesta v4,
    // documentar como limitação conhecida até o motor ganhar escopo por função.
    variableTaint.set(param.name.text, {
      name: param.name.text, tainted: true,
      source: argTaint.source, declarations: [param],
    });
  });
}

// Passada 2: reprocessar os corpos de função depois da passada 1 (ou processar o arquivo
// inteiro 2x), pra pegar sinks dentro de runQuery() já com o parâmetro marcado tainted.
```
Marcado explicitamente como item de esforço maior — não é "correção imediata" como o Item 1,
mas é o que faz o Item 2 (cross-file) valer a pena de verdade. Sugiro medir o ganho do 2b
sozinho (intra-arquivo) antes de partir pro cross-file, com o mesmo corpus/benchmark.

---

## Item 1f — Padrões de CORS e secrets que faltam no caso mais perigoso **[NOVO v4]**

**CORS** — os 2 padrões existentes só pegam o header manual literal e `cors()` sem
argumento. A configuração real mais perigosa (`cors({ origin: "*", credentials: true })`,
que viola a própria spec do CORS) não bate porque tem argumentos:
```ts
// src/audit/security/cors.ts
export function detectInsecureCORS(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  for (const file of files) {
    if (file.relPath.includes("__tests__")) continue;
    if (isDetectorDefinitionFile(file.relPath)) continue;

    // Padrões originais, linha a linha (mantidos)
    const lines = file.content.split("\n");
    const corsPatterns = [
      /Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]/,
      /\bcors\s*\(\s*\)/,
    ];
    for (let i = 0; i < lines.length; i++) {
      if (corsPatterns.some((p) => p.test(lines[i]!))) {
        issues.push({ type: "insecure_cors", severity: 2,
          description: `CORS wildcard em "${file.relPath}:${i + 1}"`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Especificar origens permitidas em vez de usar wildcard *",
          confidence: 0.65 });
      }
    }

    // NOVO — objeto de config precisa ser lido como bloco, não linha a linha, porque
    // "origin" e "credentials" costumam estar em linhas separadas dentro do mesmo cors({...})
    const corsCallRegex = /\bcors\s*\(\s*\{([\s\S]{0,300}?)\}\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = corsCallRegex.exec(file.content)) !== null) {
      const body = match[1]!;
      const hasWildcardOrigin = /origin\s*:\s*["']\*["']/.test(body);
      const hasCredentials = /credentials\s*:\s*true/.test(body);
      if (hasWildcardOrigin && hasCredentials) {
        const lineNum = file.content.substring(0, match.index).split("\n").length;
        issues.push({ type: "insecure_cors", severity: 3,
          description: `CORS wildcard + credentials em "${file.relPath}:${lineNum}" — combinação viola a spec do CORS e permite roubo de credenciais cross-origin`,
          location: `${file.relPath}:${lineNum}`,
          recommendation: "Nunca combinar origin:'*' com credentials:true — especificar lista de origens permitidas",
          confidence: 0.8 });
      }
    }
  }
  return issues;
}
```

**Secrets — fallback de env var.** O padrão mais perigoso da categoria (parece usar env var,
passa despercebido em review, mas cai pro valor fixo se a env var não estiver setada) hoje
não bate em nenhum dos regexes existentes:
```ts
// src/audit/security/secrets.ts — adicionar aos secretPatterns
{
  regex: /(?:secret|token|key|password)\w*\s*[=:]\s*process\.env\.\w+\s*\|\|\s*["'][^"']{8,}["']/gi,
  name: "secret com fallback hardcoded",
},
```
Confidence sugerida mais alta que os outros padrões da lista (0.8 em vez de 0.65) — ao
contrário de uma string solta que pode ser mock/teste, esse padrão é inequivocamente uma
env var com fallback fixo, risco real em qualquer ambiente que esqueça de setar a variável.

---

## Item 3 — Novos sinks/sources, escopo restrito ao stack real (inalterado do v3)

Mesma lista técnica: NoSQL injection, SSTI, deserialização insegura, GraphQL resolver
sources, upload sources — ancorado em popularidade real do ecossistema Node
(mongoose/driver nativo, handlebars/ejs/pug, js-yaml/node-serialize, Apollo/GraphQL-Yoga,
multer/formidable). JWT sem `algorithms` explícito continua como detector separado, fora do
motor de taint.

---

## Item 4 — Passe de correção nos outros detectores regex, escopo ampliado **[precisão v4]**

Causa-raiz do Item 1a se repete — confirmado com um segundo exemplo, de natureza diferente
(não é "\.metodo\(" desta vez, é regex multi-linha processada per-line):

**Bug confirmado:** `detectPrototypePollution` (`src/audit/security/misc.ts:59`) tem um
padrão "genérico" com `[\s\S]{0,80}` — pensado pra casar através de múltiplas linhas — mas o
loop em volta testa `lines[i]` (uma linha por vez, resultado de `.split("\n")`), então o
regex nunca vê duas linhas ao mesmo tempo. O padrão mais comum de prototype pollution real —
```ts
for (const key in req.body) {
  settings[key] = req.body[key];   // linha separada do "for"
}
```
— nunca é detectado, confirmado com PoC (`req.body` direto no loop, zero issues). O
interessante: o próprio código-base já tem o padrão certo em
`detectEmptyCatchBlocks` (`src/audit/engineering/hygiene.ts:44`), que roda a regex sobre
`file.content` inteiro em vez de linha por linha. É inconsistência entre detectores do mesmo
diretório, não falta de ideia.

```ts
// src/audit/security/misc.ts — trocar o loop desse padrão específico
export function detectPrototypePollution(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const pollPatterns = [ /* ... mantido, roda per-line normalmente ... */ ];
  const genericPollPattern = /for\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+\w+\s*\)[\s\S]{0,80}\[\s*\w+\s*\]\s*=/g;

  for (const file of files) {
    // padrões de linha única (mantido, per-line)
    // ...

    // NOVO — roda sobre o conteúdo inteiro, igual detectEmptyCatchBlocks já faz
    let match: RegExpExecArray | null;
    while ((match = genericPollPattern.exec(file.content)) !== null) {
      const lineNum = file.content.substring(0, match.index).split("\n").length;
      issues.push({
        type: "proto_pollution", severity: 2,
        description: `Possível prototype pollution em "${file.relPath}:${lineNum}" — atribuição indexada dentro de for...in sem allowlist de chaves`,
        location: `${file.relPath}:${lineNum}`,
        recommendation: "Usar allowlist de chaves permitidas, ou Object.create(null) como alvo, ou Map em vez de objeto plano",
        confidence: 0.6,
      });
    }
  }
  return issues;
}
```

**Ampliação do escopo deste item (processo mecânico, igual v3 propunha para `\.metodo\(`)**:
além de listar todo regex ancorado em `\.metodo\(`, listar também todo detector que (a)
contém `[\s\S]` na definição da regex **e** (b) está dentro de um loop que itera
`file.content.split("\n")` — essa combinação é o sintoma exato do bug encontrado aqui, e é
fácil de grepar em lote:
```bash
# processo mecânico sugerido pro agente rodar antes de corrigir manualmente
grep -rl '\[\\s\\S\]' src/audit/ --include=*.ts | xargs grep -L 'file\.content)' 
# arquivos que têm regex multi-linha MAS não aplicam sobre file.content inteiro em nenhum
# lugar são candidatos a ter o mesmo bug do prototype pollution
```

**Achado adicional que entra neste item**: `detectSQLInjection` (regex) só pega quando a
keyword SQL e a concatenação estão na mesma linha — construção em 2+ statements passa batido:
```ts
let sql = "SELECT * FROM users WHERE id = ";
sql += userId;
pool.query(sql);   // zero issues, nem regex nem taint (ver Item 1e/2b)
```
Sem correção de código isolada proposta aqui — a solução real é o Item 1e + 2b (taint engine
funcionando corretamente resolve isso via fluxo de dados, não via regex melhor). Registrar
como motivação adicional pra priorizar 1e/2b, não como item de regex separado.

---

## Item 5 — Self-mutation testing do próprio motor (inalterado do v3)

Sem mudança — reaproveita `ts.Program`/`ts.transform` do `TaintAnalyzer`. Ver código completo
no v3 (`scripts/security/mutate-and-test.ts`). Recomendo rodar isso **depois** dos Itens
1e/2b — hoje o self-mutation testaria principalmente os detectores regex (que já
"funcionam", só com escopo limitado); o ganho maior de achar pontos cegos vem depois que o
motor de taint em si estiver casando sinks corretamente.

---

## Item 6a — `srcDir` hardcoded **[precisão v4]**

Confirmado no código:
```
src/audit/taint/analyzer.ts:84      const srcDir = this.options.projectRoot + "/src";
src/audit/ts-program-cache.ts:84    const srcDir = projectRoot + "/src";
src/audit/architecture/coupling.ts:130  const srcDir = join(projectRoot, "src");
```
**Nuance encontrada com teste ao vivo** (2 projetos-fixture idênticos, um com código em
`src/`, outro em `app/`): o hardcode afeta especificamente o `TaintAnalyzer` (`ts.Program`) e
o `ts-program-cache` — os detectores regex de superfície (`detectSQLInjection`, `detectXSS`,
etc.) operam sobre uma lista de `SourceFileInfo` que não depende de `srcDir`, e continuaram
detectando normalmente em `app/`. Ou seja: o Item 6a é real e continua prioritário (ordem
mantida), mas o texto "boa parte do resto roda no escuro" merece a ressalva — o que fica
cego é especificamente a análise de taint baseada em AST/`ts.Program` (que é justamente onde
os Itens 1e/2b atuam), não os detectores regex. Isso não muda a prioridade, mas evita
superestimar o ganho de corrigir só isso sem 1e/2b andarem junto.

```ts
// src/audit/taint/analyzer.ts — ler de config, com fallback pro comportamento atual
const srcDir = this.options.srcDirOverride
  ?? findLikelySourceDir(this.options.projectRoot)
  ?? this.options.projectRoot + "/src";

function findLikelySourceDir(projectRoot: string): string | null {
  const candidates = ["src", "app", "lib", "source"];
  for (const c of candidates) {
    if (existsSync(join(projectRoot, c))) return join(projectRoot, c);
  }
  return null; // cai no fallback "/src" pra manter compatibilidade
}
```

---

## Item 6b — Sinal explícito de check pulado em SCA/license (inalterado do v3)

Sem mudança — código completo já no v3 (`detectDependencyVulnerabilities`,
`detectIncompatibleLicenses` com `audit_check_skipped`).

---

## Item 7 — SCA nativo aprimorado, sem serviço externo (inalterado do v3)

Sem mudança — typosquatting (Levenshtein + lista curada), staleness, SBOM CycloneDX, tudo
local. Código completo já no v3.

---

## Item 8 — Scoring CVSS, aditivo (inalterado do v3)

Sem mudança — `cvssVector` opcional por sink, `severity` derivado quando presente, zero
breaking change. Código completo já no v3.

---

## Ordem sugerida (revisada v4)

1. **Item 0** — benchmark, sempre primeiro. Incluir os fixtures novos de object-call
   (§Item 0 acima) desde o início, não depois — senão os Itens 1e/2b não têm como medir
   progresso.
2. **Item 6a** — corrigir `srcDir` hardcoded, com a ressalva de escopo (§precisão acima).
3. **Item 1** — os três gaps confirmados do v3 (crypto com fix de auto-detecção, XSS,
   `req.file`), baixo risco.
4. **Item 1d** — `unsafe_deserialize` com falso-positivo sistemático — separar RCE de
   schema-validation, barato e alto valor de confiança (para de gerar ruído que já fez o
   detector inteiro parecer não-confiável no teste ao vivo).
5. **Item 1e** — corrigir `findTaintSink` pra sufixo de path. **Maior alavanca única do plano
   inteiro** — destrava SQL injection e Open Redirect via taint engine pra qualquer chamada
   via objeto, que é o padrão dominante do ecossistema. Precisa vir antes do Item 2/2b pra não
   desperdiçar o esforço de ligar cross-file num motor que não casa os sinks certos.
6. **Item 6b** — sinal explícito de check pulado — barato, independente do resto.
7. **Item 4** — correção em lote nos detectores regex, escopo ampliado (grep de
   `[\s\S]` + per-line, não só `\.metodo\(`).
8. **Item 1f** — CORS wildcard+credentials e secret-fallback — barato, independente.
9. **Item 2b** — propagação de taint por parâmetro de função, mesmo arquivo. Esforço maior
   (2 passadas), mas é pré-requisito conceitual pro Item 2 valer a pena.
10. **Item 2** — cross-file, agora com Item 1e + 2b já resolvidos por baixo — o "maior lever"
    do v3 só entrega o valor esperado depois desses dois.
11. **Item 5** — self-mutation testing — depois do motor de taint estar casando sinks
    corretamente, senão mede principalmente os detectores regex.
12. **Item 3** — cobertura nova (NoSQL, SSTI, deserialização, GraphQL, upload).
13. **Item 7** — SCA nativo aprimorado — independente, roda em paralelo a qualquer momento.
14. **Item 8** — CVSS aditivo — incremental, sink por sink, conforme cada um é revisado acima.

---

## O que foi conscientemente deixado de fora, e por quê (mantido do v3, +1 item)

- **Integração com Semgrep** — dependência de binário de terceiro. Descartado por decisão
  explícita de escopo.
- **OSV.dev / feeds de vulnerabilidade externos** — dependência de serviço de terceiro.
  `npm audit` local continua sendo o teto de cobertura de SCA neste plano.
- **Camada de revisão semântica via LLM** — depende de chamada a API externa. Fica fora
  desta versão; maior retorno pra achar falhas de lógica de autorização (IDOR e afins) que
  taint analysis estrutural não alcança — inclusive depois de 1e/2b/2, porque IDOR não é um
  padrão de fluxo de dados sink-based, é uma checagem de autorização ausente.
- **[NOVO v4] Escopo por função no motor de taint** (namespace do `variableTaint` por
  função em vez de por arquivo inteiro) — o Item 2b usa uma solução simplificada que reusa o
  mesmo `Map` global do arquivo, o que pode gerar falso-positivo se duas funções diferentes
  tiverem parâmetro com o mesmo nome. Resolver de verdade exige rastrear taint por escopo
  léxico (um `Map` por function scope, com herança de closure) — mudança estrutural maior no
  motor, fica fora desta versão; documentado como limitação conhecida do Item 2b.
