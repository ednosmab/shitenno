# Shitenno — Plano de Correção Consolidado (para repasse ao agente)

**Status:** Done
**Updated_at:** 2026-07-25T04:37:34.331Z

> Documento único que substitui os planos anteriores desta sessão. Reúne: (1) achados da análise profunda de daemon/MCP/CLI/engines, (2) achados de uma auditoria independente enviada pelo usuário — **todos os 6 itens dela foram validados de forma independente contra o código-fonte real, e dois foram reproduzidos ao vivo com execução real do código** — e (3) uma correção a essa auditoria (R7), encontrada durante a validação.
>
> Metodologia: nada neste documento é baseado só em leitura estática sem checagem. Cada item tem causa raiz confirmada — por leitura de código cruzada com comportamento observado, ou por execução direta (CLI real, cliente MCP real, daemon real, ou `tsx` importando os módulos TypeScript originais diretamente).

---

## Resumo executivo

| # | Área | Severidade | Como foi confirmado |
|---|---|---|---|
| R6 | decision-core (invoke) | **Alto** | Executado ao vivo — script bloqueado registrado como sucesso |
| P0.10 | daemon (CLI middleware) | **Alto** | Reproduzido ao vivo 2x — dois processos do daemon simultâneos |
| P0.11 | CLI / output global | **Alto** | Reproduzido ao vivo num repo real — `--json` produz JSON inválido |
| P0.4 | backlog / MCP | Alto | Reproduzido ao vivo via cliente MCP real — perda de dados mascarada |
| R2 | rule-engine (segurança) | Médio | Executado ao vivo — bypass de allowlist confirmado |
| R1 | daemon / status | Médio | Lido e confirmado — lógica de `trend` invertida |
| R5 | capability-engine | Médio | Lido e confirmado — 3 de 5 dimensões de scoring não discriminam |
| R7 (novo) | knowledge-graph | Médio | Descoberto durante validação — persistência nunca é acionada em projeto novo |
| P1.5 | autofix-engine | Médio | Lido e confirmado — substituição por string não verifica unicidade |
| P1.6 | dependências | Médio | Reproduzido — `npm install` falha sem `--legacy-peer-deps` |
| P0.2/P0.3 | daemon (paths) | Baixo/Médio | Reproduzido — watch de source não cobre projetos sem `src/` |
| R4 | daemon (robustez) | Baixo/Médio | Mesmo achado que P0.1 abaixo — consolidado |
| R3 | mcp-server.ts | Baixo | Lido e confirmado — import/export duplicado |
| P2.7/P2.8 | governança/CI | Baixo | Lido e confirmado — regras documentadas sem gate automático |
| P2.9 | daemon IPC | Baixo | Testado — sem limite de tamanho de mensagem |

---

## FASE 0 — Correções críticas (maior risco, maior confiança na causa raiz)

### 1. [R6 — Alto] Trilha de auditoria registra ações bloqueadas/falhas como sucesso

**Onde:** `src/decision-core/invoke.ts` (`buildSuccessResult`), consumido por todos os executors em `src/decision-core/executors/`.

**Causa raiz — reproduzida ao vivo nesta sessão**, importando o código real via `tsx`:

```
Output real do RunScriptExecutor: {"executed":false,"message":"Script \"rm-rf-everything\" not in allowlist"}
Resultado que iria pra trilha de auditoria: {"success":true,"message":"Executed run_script","executionId":"test-exec-id"}
🔴 BUG CONFIRMADO
```

```ts
// src/decision-core/invoke.ts — ATUAL
function buildSuccessResult(actionType: ActionType, output: Record<string, unknown>, executionId: string): InvokeResult {
  const actionSuccess = output.success !== false; // undefined !== false → true
  return { success: actionSuccess, message: actionSuccess ? `Executed ${actionType}` : (output.message as string ?? `Failed: ${actionType}`), executionId };
}
```

5 de 6 executors (`RunScriptExecutor`, `RunLocalScriptExecutor`, `RunShugoCommandExecutor`, `CreateReminderExecutor`, `ApplyAutofixExecutor`) não retornam `success` — usam `executed`/`created`/`status`. Isso significa que scripts rejeitados pela allowlist, comandos shugo bloqueados, e autofixes com `status: "skipped"` são todos gravados como `record.status = "completed"`, `record.result = "success"` em `governance/executions/{id}.json` — a fonte de verdade que o resto do sistema (incluindo `verify-done-plans.ts`) trata como histórico confiável.

**Patch — `src/decision-core/invoke.ts`:**

```ts
function buildSuccessResult(actionType: ActionType, output: Record<string, unknown>, executionId: string): InvokeResult {
  const actionSuccess = output.success === true; // default é FALHA quando ausente, não sucesso
  return {
    success: actionSuccess,
    message: actionSuccess ? `Executed ${actionType}` : (output.message as string ?? `Failed: ${actionType}`),
    executionId,
  };
}
```

**Patch — `src/decision-core/executors/run-script.ts`** (aplicar o mesmo padrão nos 3 pontos de retorno de cada um dos dois executors nesse arquivo):

```ts
if (!script) return { success: false, executed: false, message: "No script specified" };
if (!isScriptAllowed(script)) return { success: false, executed: false, message: `Script "${script}" not in allowlist` };
if (!command) return { success: false, executed: false, message: `No command mapping for script: ${script}` };
// no bloco try, sucesso real:
return { success: true, executed: true, script, output: output.slice(0, 2000) };
// no catch:
return { success: false, executed: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
```

**Patch — `src/decision-core/executors/create-reminder.ts`:**

```ts
return { success: true, created: true, message: `Reminder already exists: ${reminder} — skipped` };
// ...
return { success: true, created: true, message: `Created reminder: ${reminder} [${priority}/${category}]` };
```

**Patch — `src/decision-core/executors/apply-autofix.ts`:**

```ts
if (result.status === "reverted") throw new Error(`Autofix reverted: ${result.reason}`);
return { success: result.status === "applied", status: result.status, suggestion: result.suggestion };
```

**Teste de regressão:**

```ts
it("reports success: false when run_script is rejected by the allowlist", async () => {
  const result = await invokeAction({
    action: { type: "run_script", params: { script: "rm-rf-everything" } },
    context: mockContext,
    mode: "manual",
  });
  expect(result.success).toBe(false);
  const record = JSON.parse(readFileSync(latestExecutionRecordPath(), "utf-8"));
  expect(record.result).toBe("failure");
});
```

---

### 2. [P0.10 — Alto] Race condition: `shugo daemon start` pode subir dois processos simultâneos

**Onde:** `src/cli-middleware.ts`.

**Causa raiz — reproduzida ao vivo duas vezes** em ambiente limpo: `daemon.pid` recebeu duas escritas a 1ms de diferença (PID 569 depois PID 568), ambos processos inicializando a stack inteira em duplicidade, e o CLI reportando falha (`"socket did not appear within timeout"`) mesmo com processos vivos rodando.

O hook `preAction` do Commander roda com `thisCommand` = subcomando mais profundo (`"start"`, não `"daemon"`). O guard de auto-start compara contra o nome do **programa raiz**, que é sempre `"shugo"`:

```ts
// ATUAL (quebrado)
function getRootCommandName(cmd: Command): string {
  let c: Command | null = cmd;
  while (c?.parent) c = c.parent; // sobe até o topo — sempre "shugo"
  return c?.name() ?? "";
}
function tryAutoStartDaemon(shitennoDir: string, command: Command) {
  if (shouldSkipDaemon() || getRootCommandName(command) === "daemon") return; // NUNCA true
  ...
}
```

**Patch:**

```ts
function isDescendantOfCommand(cmd: Command, name: string): boolean {
  let c: Command | null = cmd;
  while (c) {
    if (c.name() === name) return true;
    c = c.parent;
  }
  return false;
}

function tryAutoStartDaemon(shitennoDir: string, command: Command) {
  if (shouldSkipDaemon() || isDescendantOfCommand(command, "daemon")) return;
  ...
}
```

Recomendado também endurecer `startDaemon()`/`checkDuplicateDaemon()` com um lock atômico (`daemon.lock`, `open(path, 'wx')` que falha se já existir) para eliminar de vez a janela de corrida entre check e spawn, não só a causa mais óbvia.

**Validação:** `pkill -f daemon.js`, limpar `daemon.pid`/`daemon.sock`, rodar `shugo daemon start` uma única vez, confirmar `ps aux | grep daemon.js` retorna um único processo e o CLI reporta sucesso.

---

### 3. [P0.11 — Alto] `shugo audit --json` produz stdout que não é JSON válido

**Onde:** `src/output.ts`, `src/cli-middleware.ts`.

**Causa raiz — reproduzida ao vivo** num clone real do `expressjs/express` (143 arquivos, ~21k LOC): o stdout de `shugo audit --json` começa com um bloco de texto humano ("📋 Quick Board: ...") antes do JSON, quebrando qualquer `JSON.parse` no output. `output()` não tem nenhum gate global de modo JSON — cada chamador precisa lembrar de checar `isJson` manualmente, e algo disparado no evento `session.start` do middleware (que roda antes do `action` handler do `audit` saber que está em modo `--json`) não faz essa checagem.

Existe inclusive um plano já marcado `done` (`fix-plan-json-stdout-pollution-shitenno-go.md`) tratando desse tipo de poluição — isso é provavelmente uma regressão ou um caminho que aquela correção não cobriu.

**Patch — `src/output.ts`:**

```ts
let globalJsonMode = false;
export function setGlobalJsonMode(enabled: boolean): void { globalJsonMode = enabled; }
export function output(msg: string, opts?: { quiet?: boolean }): void {
  if (globalJsonMode || opts?.quiet) return;
  process.stdout.write(msg + "\n");
}
```

**Patch — `src/cli-middleware.ts`** (ou no bootstrap do `bin/shugo.ts`, o mais cedo possível, antes de qualquer hook rodar):

```ts
import { setGlobalJsonMode } from "./output.js";
setGlobalJsonMode(process.argv.includes("--json"));
```

Isso resolve a classe inteira do problema, não só o sintoma pontual — qualquer módulo que chame `output()` durante um comando `--json` fica automaticamente silenciado.

**Validação:** `shugo init` + `shugo audit --json > out.json` num repositório real, confirmar `node -e "JSON.parse(require('fs').readFileSync('out.json','utf-8'))"` não lança erro.

---

### 4. [P0.4 — Alto] `addBacklogItem` recria arquivo apagado sem avisar o agente

**Onde:** `src/backlog-writer.ts` (`appendBacklogSection`), `src/backlog-mcp-tools.ts` (`handleAddBacklogItem`).

**Causa raiz — reproduzida ao vivo via cliente MCP real** (protocolo stdio, não simulado): deletei `.shitenno/docs/backlog/ACTIVE.md` e chamei `addBacklogItem` via MCP. Resultado: `isError: false`, arquivo recriado do zero, nenhum sinal de que o histórico anterior foi perdido.

**Patch — `src/backlog-writer.ts`:**

```ts
export function appendBacklogSection(backlogPath: string, items: BacklogItem[], date: string): BacklogWriteResult {
  const dir = dirname(backlogPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const fileExistedBefore = existsSync(backlogPath); // NOVO
  const existingContent = fileExistedBefore ? readFileSync(backlogPath, "utf-8") : "";
  const newItems = items.filter((item) => !isDuplicate(existingContent, item));

  if (newItems.length === 0) {
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, message: "All items are duplicates" };
  }

  const section = formatBacklogSection(newItems, date);
  let content = existingContent;
  if (content.length === 0) {
    content = `# BACKLOG\n\n${section}`;
  } else {
    const insertionIdx = findInsertionPoint(content);
    content = insertionIdx >= 0
      ? content.slice(0, insertionIdx) + section + "\n\n" + content.slice(insertionIdx)
      : content + `\n${section}`;
  }
  writeFileSync(backlogPath, content, "utf-8");

  return {
    itemsAdded: newItems.length,
    itemsSkipped: items.length - newItems.length,
    sectionInserted: true,
    fileWasRecreated: !fileExistedBefore, // NOVO
    message: fileExistedBefore
      ? `Added ${newItems.length} item(s)`
      : `WARNING: backlog file did not exist and was recreated from scratch. Added ${newItems.length} item(s). Any prior history is lost if this wasn't expected.`,
  } as BacklogWriteResult & { fileWasRecreated: boolean };
}
```

**Patch — `src/backlog-mcp-tools.ts`** (`handleAddBacklogItem`):

```ts
const backlogExistedBefore = existsSync(paths.active); // import existsSync no topo
const result = addItem(paths.active, { id, title, /* ...resto igual */ });
const text = !backlogExistedBefore
  ? `⚠️ Backlog file did not exist and was recreated. ${result.message}`
  : result.message;
return { content: [{ type: "text", text }], isError: !result.success };
```

**Validação:** deletar `ACTIVE.md`, chamar `addBacklogItem` via MCP, confirmar que a resposta contém o aviso `⚠️`.

---

## FASE 1 — Segurança

### 5. [R2 — Médio, segurança] Allowlist do rule-engine aceita chaves herdadas de `Object.prototype`

**Onde:** `src/rule-engine/security.ts`.

**Causa raiz — reproduzida ao vivo**, importando o módulo real via `tsx`:

```
isScriptAllowed('constructor'): true
🔴 BUG CONFIRMADO: 'constructor' passa no gate de allowlist sem estar nela
```

`isScriptAllowed`/`isShugoCommandAllowed` usam o operador `in`, que enxerga a cadeia de protótipos. O próprio arquivo já define `DANGEROUS_KEYS` para proteção contra prototype pollution, mas essas duas funções — o gate de segurança de execução de comandos — não a usam. Em `RunShugoCommandExecutor`, o valor herdado é interpolado num template string antes de ir para `execSync`, forçando coerção via `.toString()` — um bypass real do gate, limitado hoje pelos valores nativos de `Object.prototype`, mas um bypass mesmo assim.

**Patch — `src/rule-engine/security.ts`:**

```ts
export function isScriptAllowed(script: string): boolean {
  return Object.hasOwn(ALLOWED_SCRIPTS, script) && !DANGEROUS_KEYS.has(script);
}
export function isShugoCommandAllowed(command: string): boolean {
  return Object.hasOwn(ALLOWED_SHUGO_COMMANDS, command) && !DANGEROUS_KEYS.has(command);
}
```

(`Object.hasOwn` disponível — projeto já usa `target: es2022`.)

**Teste de regressão:**

```ts
it("rejects inherited Object.prototype keys", () => {
  expect(isScriptAllowed("constructor")).toBe(false);
  expect(isScriptAllowed("toString")).toBe(false);
  expect(isScriptAllowed("__proto__")).toBe(false);
  expect(isShugoCommandAllowed("constructor")).toBe(false);
});
```

---

## FASE 2 — Correção de indicadores e scoring (confiabilidade da informação exposta ao usuário)

### 6. [R1 — Médio] `shugo status` e o banner do daemon mostram 🟢 para saúde crítica

**Onde:** `src/daemon/ipc.ts` (`handleQueryHealth`), `src/daemon-context-banner.ts`, `src/commands/status.ts`.

**Causa raiz confirmada por leitura direta:**

```ts
// src/daemon/ipc.ts — ATUAL
let trend: "stable" | "improving" | "degrading" | "unknown" = "unknown";
if (prev) {
  trend = prev.score >= 70 ? "stable" : prev.score >= 40 ? "degrading" : "unknown"; // score <40 → "unknown", não "degrading"!
}
```

`"improving"` nunca é atribuído em lugar nenhum (não compara score atual com o anterior, é só um bucket do valor absoluto). Score crítico (<40) cai em `"unknown"`, e os dois consumidores só tratam `"degrading"` como alerta — resultado: projeto com score 10 mostra 🟢, idêntico a um projeto com score 90.

**Patch — `src/daemon/state.ts`** (guardar score anterior):

```ts
export interface HealthInfo {
  score: number;
  previousScore: number | null; // novo
  checkedAt: string;
}
```

**Patch — `src/daemon/index.ts`** (nos dois pontos que atualizam `ctx.state.health`, ~linha 604 e ~814):

```ts
// health.checked
bus.subscribe("health.checked", (payload) => {
  recordEvent(ctx.state, "health.checked");
  const p = payload as { score?: number } | undefined;
  if (p?.score !== undefined) {
    ctx.state.health = { score: p.score, previousScore: ctx.state.health?.score ?? null, checkedAt: new Date().toISOString() };
  }
});

// runPeriodicAudit
ctx.state.health = { score: report.healthScore, previousScore: ctx.state.health?.score ?? null, checkedAt: report.auditedAt };
```

**Patch — `src/daemon/ipc.ts`:**

```ts
function handleQueryHealth(opts: HandleMessageOptions): void {
  const { state } = opts;
  const health = state.health;
  let trend: "improving" | "stable" | "degrading" | "critical" | "unknown" = "unknown";
  if (health) {
    if (health.score < 40) {
      trend = "critical";
    } else if (health.previousScore != null) {
      const delta = health.score - health.previousScore;
      trend = delta > 5 ? "improving" : delta < -5 ? "degrading" : "stable";
    } else {
      trend = "stable";
    }
  }
  // ...resto igual, usando `trend`
}
```

**Patch — `src/daemon-context-banner.ts` e `src/commands/status.ts`** (idêntico nos dois):

```ts
const icon = health.trend === "critical" ? "🔴" : health.trend === "degrading" ? "🟡" : "🟢";
```

**Teste de regressão:** fixar `state.health = { score: 20, previousScore: 25, checkedAt }` e assertar `trend === "critical"`; outro caso score 55/previousScore 60 assertando `"degrading"`.

---

### 7. [R5 — Médio] `capability-engine` calcula 3 de 5 dimensões de maturidade de forma global, não por capacidade

**Onde:** `src/capability-engine/maturity.ts`.

**Causa raiz confirmada por leitura direta** — o próprio código já sinaliza o problema com o prefixo `_`:

```ts
function checkCapabilitySkills(_capability: Capability, shitennoDir: string): boolean {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return false;
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length > 0;
  // não filtra por _capability — responde "existe QUALQUER skill no projeto?"
}
// checkCapabilityTemplates e checkCapabilityMetrics têm o mesmo padrão
```

Assim que o projeto tem qualquer skill e qualquer relatório, **todas** as capacidades instaladas ganham +15 (skills) e +15 (metrics) de bônus, sem relação com a capacidade avaliada. Consequência prática: `IA 100%`, `Governança 100%`, `Documentação 100%` simultaneamente, mascarando lacunas reais.

**Patch** — usar o `fileMap` que já existe em `getCapabilityFilesForEngine` (ou mapeamento equivalente) para filtrar por capacidade real:

```ts
function checkCapabilitySkills(capability: Capability, shitennoDir: string): boolean {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return false;
  return readdirSync(skillsDir)
    .filter((f) => f.endsWith(".md"))
    .some((f) => skillBelongsToCapability(f, skillsDir, capability)); // ler frontmatter/tag do skill
}
```

Se skills/templates/reports hoje não carregam metadado de capacidade, o fix mínimo honesto é renomear a função e deixar claro que é um sinal *global* de maturidade do projeto (não por capacidade), sem somar o bônus individualmente a cada capacidade instalada — ou reduzir o peso pra não dominar o score.

**Teste de regressão:**

```ts
it("does not award skills bonus to a capability with no related skill files", () => {
  // criar projeto temp com 1 skill de "quality" e nenhuma de "compliance"
  // esperar que compliance.score não inclua o bônus de skills
});
```

---

### 8. [R7 — Médio, NOVO] Persistência do Knowledge Graph nunca é acionada em projeto novo — corrige um "falso alarme" da auditoria original

**Onde:** `src/knowledge-graph.ts`, `src/commands/audit.ts`.

**Descoberto durante a validação da auditoria enviada pelo usuário.** O relatório original descartou `knowledge-graph/storage.ts` como falso alarme, validando "rodando `shugo status` neste próprio repositório [do Shitenno]" e vendo `artifacts.jsonl`/`relations.jsonl` populados. Essa validação estava contaminada pelo ambiente: o repositório do próprio Shitenno é auto-hospedado e tem histórico real acumulado — não prova que o bootstrap atual cria esses arquivos.

**Causa raiz confirmada:**

```ts
// src/knowledge-graph.ts
export function initializeKnowledgeGraph(shitennoDir: string): void {
  const bus = getEventBus();
  const eventTypes: ShitennoEventType[] = ["adr.created", "skill.created", "capability.installed"];
  for (const eventType of eventTypes) {
    bus.subscribe(eventType, () => rebuildGraph(shitennoDir)); // só isso chama saveArtifacts/saveRelations
  }
}
```

`initializeKnowledgeGraph` **não é chamada em nenhum lugar do código-fonte** — confirmei com `grep -rn "initializeKnowledgeGraph(" src`, zero call sites fora da própria definição. `commands/audit.ts` chama `discoverArtifacts`/`discoverRelations`/`analyzeGraph` só **em memória** para montar o relatório — nunca `saveArtifacts`/`saveRelations`.

**Confirmado empiricamente** em dois projetos inicializados do zero nesta sessão (incluindo um clone real do Express.js, com `init` + `audit` + `status` + `briefing` rodados): nenhum dos dois tem `.shitenno/governance/knowledge-graph/` criado.

**Patch — `src/daemon/index.ts`** (dentro de `initEngines`, junto aos outros `initialize*`):

```ts
import { initializeKnowledgeGraph } from "../knowledge-graph.js";
// ...
initializeKnowledgeGraph(ctx.shitennoDir);
daemonLog(ctx.logPath, "INFO", "Knowledge graph initialized — subscribed to adr/skill/capability events");
```

**Patch — `src/commands/audit.ts`** (persistir também no fluxo CLI, já que o daemon é opt-in e não deveria ser pré-requisito para o graph existir):

```ts
const artifacts = discoverArtifacts(ctx.shitennoDir);
const relations = discoverRelations(artifacts);
const graphAnalysis = analyzeGraph(artifacts, relations);
saveArtifacts(ctx.shitennoDir, artifacts);   // NOVO
saveRelations(ctx.shitennoDir, relations);   // NOVO
```

**Validação:** `rm -rf` num projeto de teste, `shugo init` + `shugo audit`, confirmar que `.shitenno/governance/knowledge-graph/artifacts.jsonl` e `relations.jsonl` existem e têm conteúdo.

---

## FASE 3 — Robustez e qualidade de código

### 9. [P1.5 — Médio] Autofix pode aplicar correção no lugar errado silenciosamente

**Onde:** `src/audit/autofix-engine.ts`.

`content.replace(suggestion.currentCode, suggestion.suggestedCode)` troca só a primeira ocorrência. Se `currentCode` não for único no arquivo, o autofix pode alterar o trecho errado — só reverte se isso quebrar o typecheck.

**Patch:**

```ts
function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0, idx = haystack.indexOf(needle);
  while (idx !== -1) { count++; idx = haystack.indexOf(needle, idx + needle.length); }
  return count;
}

function applyPatchAndVerify(filePath: string, suggestion: Suggestion, projectRoot: string, verifyCmd: string): ApplyResult {
  const backupPath = `${filePath}${BACKUP_SUFFIX}`;
  copyFileSync(filePath, backupPath);
  try {
    const content = readFileSync(filePath, "utf-8");
    if (!content.includes(suggestion.currentCode)) {
      unlinkSync(backupPath);
      return { suggestion, status: "skipped", reason: "currentCode not found — file changed since audit" };
    }
    const occurrences = countOccurrences(content, suggestion.currentCode);
    if (occurrences > 1) {
      unlinkSync(backupPath);
      return { suggestion, status: "skipped", reason: `ambiguous match — currentCode appears ${occurrences} times, refusing to guess` };
    }
    writeFileSync(filePath, content.replace(suggestion.currentCode, suggestion.suggestedCode), "utf-8");
    execSync(verifyCmd, { cwd: projectRoot, stdio: "pipe", timeout: VERIFY_TIMEOUT_MS });
    unlinkSync(backupPath);
    return { suggestion, status: "applied" };
  } catch (error) {
    copyFileSync(backupPath, filePath);
    unlinkSync(backupPath);
    return { suggestion, status: "reverted", reason: String(error).slice(0, 200) };
  }
}
```

**Validação:** arquivo de teste com o mesmo trecho repetido 2x, sugestão apontando pra ele, confirmar `status: "skipped"` com `reason` mencionando "ambiguous match".

---

### 10. [P0.2/P0.3 — Baixo/Médio] Watch de source do daemon hardcoded e não cobre projetos sem `src/`

**Onde:** `src/daemon/index.ts`, `src/infrastructure/persistence/file-watcher.ts`.

`extraPaths: [join(resolvedProjectRoot, "src", "commands")]` é hardcoded — resíduo de auto-hospedagem, só faz sentido no repo do próprio Shitenno. Watch de source (`SHITENNO_WATCH_SOURCE=1`) assume `<projectRoot>/src` fixo — testei com projeto sem essa pasta e zero eventos foram capturados.

**Patch — `src/daemon/index.ts`:**

```ts
// remover a linha extraPaths hardcoded
ctx.stopWatcher = startWatching(shitennoDir, {
  watchSourceCode: process.env.SHITENNO_WATCH_SOURCE === "1",
  projectRoot: resolvedProjectRoot,
  watchGitEvents: process.env.SHITENNO_WATCH_GIT === "1",
});
```

**Patch — `src/infrastructure/persistence/file-watcher.ts`:**

```ts
if (options.watchSourceCode && options.projectRoot) {
  const candidates = options.sourceDirs?.length
    ? options.sourceDirs
    : ["src", "lib", "app"].filter((d) => existsSync(join(options.projectRoot!, d)));
  const resolvedDirs = candidates.length > 0 ? candidates : ["."];
  for (const dir of resolvedDirs) {
    const fullPath = join(options.projectRoot, dir);
    watchPaths.push(fullPath);
    logger.info("file-watcher", `Source code watching enabled: ${fullPath}`);
  }
}
```

Adicionar `sourceDirs?: string[]` em `WatcherOptions` para configuração explícita (monorepos vão precisar).

Buscar outros resíduos do mesmo tipo: `grep -rn "shitenno-go\|shitenno-cli" src --include="*.ts"` também encontra `isAuditingShitennoItself = projectRoot.includes("shitenno-go")` em `src/health-auditor.ts:59` — trocar por flag explícita (env var ou arquivo marcador), não checagem de nome de diretório.

**Validação:** projeto sem `src/`, `SHITENNO_WATCH_SOURCE=1`, editar arquivo na raiz, confirmar que aparece no log de eventos.

---

### 11. [R4 / P0.1 — Baixo/Médio] Daemon sem handler global de crash — morre silenciosamente

**Onde:** `src/daemon/index.ts`.

**Confirmado tanto por leitura (sem `process.on("uncaughtException"...)` em lugar nenhum) quanto observado ao vivo**: o processo do daemon morreu entre dois comandos nesta sessão sem nenhuma linha de log indicando o motivo.

**Patch** (logo após os handlers de `SIGTERM`/`SIGINT`):

```ts
process.on("uncaughtException", (err) => {
  daemonLog(ctx.logPath, "FATAL", `Uncaught exception — daemon crashing: ${err.stack ?? err.message}`);
  try { persistState(ctx.state, ctx.statePath); } catch { /* best-effort */ }
  cleanup(ctx.pidPath, ctx.sockPath);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
  daemonLog(ctx.logPath, "ERROR", `Unhandled promise rejection: ${msg}`);
  // não derruba o processo — só loga, mesma filosofia defensiva dos try/catch locais
});
```

**Validação:** forçar um `throw` num handler de evento assíncrono e confirmar que `daemon.log` registra `[FATAL]` com stack trace antes do processo morrer.

---

### 12. [R3 — Baixo] `mcp-server.ts` importa e reexporta os mesmos 8 handlers em blocos separados

**Onde:** `src/mcp-server.ts`, linhas 13–33.

```ts
// ATUAL — duplicado
export { handleGetBriefing, ..., handleGetSkills } from "./mcp-server-handlers.js";
import { handleGetBriefing, ..., handleGetSkills } from "./mcp-server-handlers.js";
```

Não quebra o build (`export {} from` não cria binding local), mas expõe handlers internos como API pública sem necessidade — nenhum outro arquivo do projeto importa esses handlers a partir de `mcp-server.ts`.

**Patch:**

```ts
import { handleGetBriefing, handleGetRiskMap, handleGetRules, handleGetEngineeringState,
  handleGetPlans, handleSubmitFeedback, handleGetADRs, handleGetSkills } from "./mcp-server-handlers.js";
```

Se a intenção for expor mesmo como API pública, reexportar as mesmas bindings já importadas em vez de duplicar o import.

---

## FASE 4 — Instalação e governança de processo

### 13. [P1.6 — Médio] `npm install` quebra em ambiente limpo

Conflito de peer dependency: `eslint@^10.6.0` vs `eslint-plugin-jsx-a11y@6.10.2` (aceita só até `eslint@^9`).

```bash
npm info eslint-plugin-jsx-a11y versions --json   # checar se há versão compatível com eslint 10
# se não houver:
npm install eslint@^9 --save-dev
rm -rf node_modules package-lock.json && npm install   # deve terminar sem ERESOLVE
```

### 14. [P2.7 — Baixo] Regra F-06 (arquivo ≤300 linhas) sem gate de CI

68 de ~320 arquivos violam hoje. Não travar tudo de uma vez — usar baseline que só pode diminuir:

```bash
# scripts/check-file-size.sh — modo baseline
BASELINE_FILE="scripts/file-size-baseline.txt"
CURRENT_VIOLATIONS=$(find src -name "*.ts" -not -path "*__tests__*" | xargs wc -l | awk '$1>300 {print $2}' | sort)
NEW_VIOLATIONS=$(comm -23 <(echo "$CURRENT_VIOLATIONS") <(sort "$BASELINE_FILE"))
if [ -n "$NEW_VIOLATIONS" ]; then
  echo "❌ Novos arquivos violando F-06:"; echo "$NEW_VIOLATIONS"; exit 1
fi
```

### 15. [P2.8 — Baixo] Regra FRZ-01 (congelamento de novas engines) sem gate automático

```ts
// src/__tests__/architecture-boundaries.test.ts
describe("FRZ-01: freeze on new engine/detector files", () => {
  it("does not exceed the frozen baseline count", () => {
    const output = execSync(`find src -name "*-engine.ts" -o -name "*-detector.ts" -o -name "*-analyser.ts" | grep -v __tests__ | wc -l`, { encoding: "utf-8" }).trim();
    expect(Number(output)).toBeLessThanOrEqual(48); // atualizar só quando FRZ-01 for encerrada oficialmente
  });
});
```

### 16. [P2.9 — Baixo] IPC do daemon sem limite de tamanho de mensagem

Testei enviar 1MB num payload só — processou sem problema, mas sem limite algum.

```ts
const MAX_MESSAGE_BYTES = 64 * 1024;
server.on("connection", (socket) => {
  let buffer = "";
  socket.on("data", (chunk) => {
    if (buffer.length + chunk.length > MAX_MESSAGE_BYTES) {
      sendJson(socket, { type: "error", message: "Message too large" });
      socket.destroy();
      return;
    }
    buffer += chunk.toString();
    // ...resto do parsing por linha existente
  });
});
```

### 17. [Informativo] `shugo mcp install`

Testado e confirmado seguro — instala `@modelcontextprotocol/server-filesystem` via `npm install -g` (pacote oficial, versão real `2026.7.10` confirmada) e atualiza `opencode.json` do projeto-alvo corretamente. É a única operação que escreve fora do escopo do projeto; comportamento é exatamente o anunciado. Não requer correção — só vale documentar essa exceção no README.

---

## FASE 5 — Caminho para confiabilidade (estrutural, não são bugs pontuais)

Os 17 itens acima são todos corrigíveis com patches localizados. Mas a avaliação honesta do projeto expôs três problemas de **categoria**, não de linha de código — corrigir só os bugs individuais não resolve isso. Eles precisam de um plano próprio.

### 18. [Estrutural — Alto] Padrão sistêmico: os indicadores do sistema mentem sobre seu próprio estado

Não é coincidência que R6, R1, R5 e R7 sejam todos, na essência, o mesmo tipo de falha: **a camada que deveria ser a fonte de verdade do projeto reporta um estado mais favorável do que o real**, especificamente:

- Ação bloqueada → registrada como sucesso (R6)
- Projeto crítico → mostrado como saudável (R1)
- Capacidade sem cobertura → mostrada com maturidade 100% (R5)
- Grafo de conhecimento nunca persistido → sem sinal de que está vazio (R7)

Corrigir os quatro individualmente é necessário mas não suficiente — não há garantia de que não existe um quinto caso do mesmo padrão em outro lugar do código que ninguém achou ainda. Isso é uma consequência natural de um sistema com 48 engines/detectores desenvolvidos por um autor solo sem revisão cruzada.

**Ação recomendada, antes de aplicar os patches item-a-item:**

1. Buscar sistematicamente por todo caminho onde um resultado é derivado de `!== false`, `?? true`, ou qualquer expressão que trate "ausência de informação" como "sucesso"/"saudável"/"completo" por padrão:
   ```bash
   grep -rn "!== false\|?? true\b" src --include="*.ts" | grep -v __tests__
   ```
   Cada ocorrência é candidata a ter o mesmo bug de R6 (fail-open em vez de fail-closed). Revisar uma por uma antes de assumir que R6 foi o único caso.

2. Adicionar um princípio de arquitetura documentado (ADR) declarando explicitamente: *"campos de status/sucesso do sistema devem ser fail-closed — ausência de informação é tratada como falha/desconhecido, nunca como sucesso"* — e um teste de arquitetura que rejeite PRs introduzindo o padrão inverso, na mesma linha do que já existe para outras regras (`architecture-boundaries.test.ts`).

**Validação:** rodar o grep acima no código já corrigido pelos itens 1–17 e revisar manualmente cada resultado restante.

---

### 19. [Estrutural — Alto] Zero validação em projeto de terceiro antes de qualquer alegação de "pronto"

Hoje, testado em ambiente: cria projeto próprio (dogfooding), meus dois projetos de teste nesta sessão. Nenhum dado de uso real, contínuo, por terceiros. Isso não é corrigível com um patch — é um gap de evidência.

**Plano de piloto controlado**, em ordem:

1. Aplicar os itens 1–17 (fases 0–4) e rodar a suíte completa + os testes de regressão novos.
2. Escolher **um único projeto de terceiro real, de porte médio** (não um monorepo gigante, não um projeto trivial) e instalar o Shitenno nele em modo **somente leitura** primeiro — comandos como `status`, `audit`, `briefing` sem o daemon habilitado, sem `apply_autofix`, sem regras autônomas ativas. Objetivo: validar que os indicadores (health, maturidade, knowledge graph) batem com a realidade do projeto, sem risco de escrita.
3. Só depois de uma ou duas semanas nesse modo — e com os números validados manualmente contra a realidade do projeto pelo menos uma vez — habilitar o daemon e as ações automáticas (`apply_autofix`, `run_script` via regras) num ambiente ainda controlado (branch isolado, não a branch principal do time).
4. Definir um critério objetivo de saída do piloto antes de declarar "pronto para produção de terceiros": por exemplo, N dias de daemon rodando sem crash não-explicado (agora rastreável graças ao item 11), zero divergência encontrada entre o `healthScore` reportado e uma avaliação manual do estado do projeto, e nenhuma ação autônoma revertida por engano.

**Por que isso importa mais que os bugs de código:** mesmo com os 17 itens corrigidos, "correto no meu ambiente de teste" e "confiável no ambiente de alguém que não sou eu, ao longo do tempo" são afirmações diferentes. O projeto ainda não tem evidência da segunda.

---

### 20. [Estrutural — Médio] Dívida de governança não executada (além do gate de CI do item 14)

O item 14 cria um gate que impede a situação piorar, mas os 68 arquivos que já violam a regra de 300 linhas continuam existindo. Isso não é urgente do ponto de vista de correção de bug, mas é relevante para "eficiência acima da média", que foi o pedido original — arquivos como `daemon/index.ts` (951 linhas) são mais difíceis de revisar, testar isoladamente, e mais propensos a esconder exatamente o tipo de bug encontrado nesta auditoria.

**Plano de refatoração incremental** (não fazer de uma vez):

1. Gerar a lista completa ordenada por tamanho: `find src -name "*.ts" -not -path "*__tests__*" | xargs wc -l | sort -rn | awk '$1>300'`.
2. Priorizar os 5 maiores que também apareceram nesta auditoria como tendo bugs (`daemon/index.ts`, `commands/audit.ts`) — refatorar e corrigir bug no mesmo PR reduz retrabalho.
3. Meta por sprint: reduzir a lista em N arquivos (definir N conforme capacidade do time), nunca aumentar — o gate do item 14 já garante isso.

---

### 21. [Estrutural — Baixo] Varredura completa de resíduos de auto-hospedagem

O item 10 corrige dois casos encontrados (`extraPaths` hardcoded, `isAuditingShitennoItself`). Não fiz uma varredura exaustiva do projeto inteiro — só achei esses dois por estar testando o daemon especificamente.

**Ação:**
```bash
grep -rln "shitenno-go\|shitenno-cli\|shitenno-feat-refactor" src --include="*.ts" | grep -v __tests__
```
Revisar cada ocorrência individualmente — nem toda menção é um bug (pode ser um comentário ou nome de teste legítimo), mas qualquer checagem condicional baseada no nome do diretório/projeto é candidata ao mesmo problema do item 10.

---

## Ordem de execução recomendada

**Bugs pontuais (código, aplicar nesta ordem):**

1. **#1 (R6)** — trilha de auditoria mentindo sobre sucesso/falha. Mais grave: corrompe a fonte de verdade que o resto do sistema depende.
2. **#2 (P0.10)** — race condition do daemon. Isolado, baixo risco de regressão, alto valor.
3. **#3 (P0.11)** — gate global de JSON mode. Resolve uma classe inteira de bugs de integração com agentes.
4. **#4 (P0.4)** — aviso de recriação do backlog. Previne perda de dados silenciosa.
5. **#18** — antes de seguir pros itens médios/baixos: rodar a varredura de padrão sistêmico (`!== false` / `?? true`) pra confirmar que R6 foi o único caso desse tipo, ou achar os outros agora enquanto o contexto está fresco.
6. **#5 (R2)** — bypass de allowlist via `Object.prototype`. Segurança, baixo esforço de correção.
7. **#6, #7, #8 (R1, R5, R7)** — correção dos indicadores de saúde/maturidade/knowledge-graph expostos ao usuário.
8. **#9, #10, #11, #12** — robustez e limpeza (autofix, paths hardcoded, crash handling, redundância de import).
9. **#21** — varredura completa de resíduos de auto-hospedagem (não só os 2 achados no item 10).
10. **#13** — desbloquear instalação limpa.
11. **#14, #15, #16** — governança de processo e defesa em profundidade no IPC.

**Estrutural (processo, em paralelo ou logo depois):**

12. **#19** — iniciar o piloto controlado com um projeto de terceiro real, modo somente leitura primeiro. Não precisa esperar todos os outros itens terminarem, mas não deve começar antes dos itens #1–#4 estarem corrigidos e validados.
13. **#20** — plano de refatoração incremental dos 68 arquivos que violam F-06, com meta por sprint.

Cada item de código tem um passo de "Validação" — recomendo aplicar e validar isoladamente antes de passar pro próximo, especialmente os itens #1 a #4 (maior superfície de impacto), em vez de aplicar tudo de uma vez e rodar a suíte só no final. O item #19 é o que efetivamente muda o veredito de "promissor, mas não testado em terceiros" para "confiável" — sem ele, os outros 20 itens deixam o código mais correto, mas não respondem à pergunta que mais importa.
