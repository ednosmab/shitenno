# Plano Consolidado Final — Shitenno/Shugo

**Status:** Done

**Base:** consolidação de 3 rodadas de análise ponta a ponta (documentação + código real, execução real de `pnpm install`, `tsc`, `eslint`, `vitest`, e auditoria dedicada do mecanismo de notificação).
**Objetivo:** eliminar todo mecanismo de verificação que hoje relata sucesso sem checar nada de verdade, e fechar os bugs funcionais confirmados — para que cada ✅ do sistema signifique o que diz significar.

**Veredito resumido (não repita este padrão ao revisar o próprio trabalho):** o código funcional (build, lint, lógica de CLI) está sólido — 0 erros de `tsc`, 0 problemas de `eslint`, 2250/2250 testes passando. O problema é sistêmico e específico: **a camada de verificação/confiança (gates, checks, stats, notificações, o próprio teste-canário que deveria vigiar essa camada) tem um padrão recorrente de reportar sucesso sem checar nada.** Esse é o fio condutor de quase todo item P0 abaixo — corrija o padrão, não só cada instância isolada.

Cada item tem: **evidência**, **causa raiz**, **sugestão de código**. Passe direto ao agente — cada bloco é implementável isoladamente.

---

# P0 — O gate de "done" mente (mesmo padrão em 5 lugares diferentes)

## P0.1 — Timeouts de `checkBuild`/`checkTests` descalibrados — TESTS é instável, pode falhar sempre

**Evidência:** suíte real roda em ~108–139s (variação observada entre máquinas). `checkTests` em `src/plan/checks.ts` usa `timeout: 120_000` (120s) — abaixo da variação superior observada. `checkBuild` usa `timeout: 60_000` contra ~35–59s reais, sem margem.

**Causa raiz:** timeouts calibrados numa fase anterior do projeto (suíte menor) e nunca revisados. Não há alarme quando o timeout se aproxima do limite.

**Correção:**

```ts
// src/plan/checks.ts
const BUILD_TIMEOUT_MS = 180_000;  // era 60_000
const TEST_TIMEOUT_MS = 300_000;   // era 120_000

export function checkBuild(projectRoot: string): CompletionCheck {
  try {
    execSync("npx tsc --noEmit", { cwd: projectRoot, encoding: "utf-8", timeout: BUILD_TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "BUILD", passed: true, message: "TypeScript compilation succeeded" };
  } catch (err) {
    return { name: "BUILD", passed: false, message: describeExecError(err, "TypeScript compilation") };
  }
}

export function checkTests(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  const scriptName = pkg?.scripts?.["test:unit"] ? "test:unit" : pkg?.scripts?.["test"] ? "test" : null;
  if (!scriptName) return { name: "TESTS", passed: false, message: "No 'test' or 'test:unit' script in package.json" };
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(run(scriptName), { cwd: projectRoot, encoding: "utf-8", timeout: TEST_TIMEOUT_MS, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "TESTS", passed: true, message: `${scriptName} passed` };
  } catch (err) {
    return { name: "TESTS", passed: false, message: describeExecError(err, `${scriptName}`) };
  }
}

// Diferencia timeout de falha real — hoje as duas mensagens ficam idênticas
function describeExecError(err: unknown, label: string): string {
  const isTimeout = err && typeof err === "object" && "signal" in err && (err as { signal?: string }).signal === "SIGTERM";
  if (isTimeout) return `${label} timed out — increase the timeout constant in plan/checks.ts or split the suite`;
  return `${label} failed: ${extractExecError(err).slice(0, 300)}`;
}
```

**Complementar (P1, não bloqueante):** considerar `test:gate` rodando só testes relacionados ao diff (`vitest related`), com fallback para suíte completa em diffs grandes — ataca a causa (suíte crescendo) e não só o sintoma.

## P0.2 — `checkGateIntegrity` nunca roda nada, só finge (script `"validate"` não existe)

**Evidência:** `checkGateIntegrity` procura `pkg.scripts["validate"]` — string literal que não existe no `package.json` (existem `validate-publish`, `validate:docs`, `validate:architecture`, `validate:session`, mas não `validate`). Resultado: sempre retorna `passed: true, message: "No validate script — skipped"`. Nunca verificou nada, desde sempre.

**Correção:**

```json
// package.json — script real, composto pelos existentes
"validate": "npm run validate:architecture && npm run typecheck"
```

```ts
// src/plan/checks.ts
export function checkGateIntegrity(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  const scriptName = "validate";
  if (!pkg?.scripts?.[scriptName]) {
    return { name: "GATE_SELF_TEST", passed: false, message: `No '${scriptName}' script in package.json — gate integrity cannot be verified` };
  }
  const { run } = resolveRunner(projectRoot);
  try {
    execSync(run(scriptName), { cwd: projectRoot, encoding: "utf-8", timeout: 30_000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "GATE_SELF_TEST", passed: true, message: "Gate integrity check passed" };
  } catch (err) {
    return { name: "GATE_SELF_TEST", passed: false, message: `Gate integrity check failed: ${extractExecError(err).slice(0, 300)}` };
  }
}
```

Nota: mudar `passed: true` (skip silencioso) para `passed: false` quando o script não existe — "skip silencioso" nunca deveria contar como "passou" em um check de integridade.

## P0.3 — `plan-format-validator.ts` nunca é consultado por `plan done`

**Evidência:** `validatePlanFormat` só é chamado em `commands/plan.ts` dentro de `runPrepare()`. `runAutoVerification()` (chamada por `plan done`) importa só `[checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation]` — formato não está na lista. Um plano pode ir para `done/` com formato quebrado, desde que build/test/lint passem.

**Correção:**

```ts
// src/plan/checks.ts — novo check, primeiro da lista (mais barato, falha rápido)
import { validatePlanFormat } from "../plan-format-validator.js";
import { readFileSync } from "node:fs";

export function checkPlanFormat(shitennoDir: string, planId: string, filePath: string): CompletionCheck {
  try {
    const content = readFileSync(filePath, "utf-8");
    const result = validatePlanFormat(filePath, content);
    if (result.errors.length > 0) {
      return { name: "FORMAT", passed: false, message: `Plan format errors: ${result.errors.map(e => e.message).join("; ")}` };
    }
    return { name: "FORMAT", passed: true, message: result.warnings.length > 0 ? `Passed with ${result.warnings.length} warning(s)` : "Format valid" };
  } catch (error) {
    return { name: "FORMAT", passed: false, message: `Could not validate format: ${String(error)}` };
  }
}
```

```ts
// src/plan/verification.ts
import { checkBuild, checkTests, checkLint, checkGateIntegrity, checkDocumentation, checkPlanFormat } from "./checks.js";

export function runAutoVerification(shitennoDir: string, projectRoot: string, planId: string): VerificationRecord {
  const engine = new MarkdownPlanEngine(shitennoDir);
  const plan = engine.getById(planId);

  const checks: CompletionCheck[] = [
    checkPlanFormat(shitennoDir, planId, plan.filePath), // primeiro — mais barato, falha rápido
    checkBuild(projectRoot),
    checkTests(projectRoot),
    checkLint(projectRoot),
    checkGateIntegrity(projectRoot),
    checkDocumentation(projectRoot),
  ];
  // ...resto igual
}
```

## P0.4 — O teste-canário que deveria travar exatamente o bug do P0.3 também está quebrado

**Evidência:** `src/__tests__/done-entrypoints-coverage.test.ts` existe especificamente para detectar dessincronia entre os dois portões de "done" (`prepare` vs `done`), mas:

```ts
const PIPELINE_GATES = ["tests", "lint", "documentation", "backlog", "plan_status"];
const LIFECYCLE_CHECKS = ["BUILD", "TESTS", "LINT", "GATE_SELF_TEST"]; // falta DOCS, que é real; falta FORMAT
```

É um snapshot de arrays digitados à mão — não lê `checks.ts` nem `runAutoVerification`. Se um check for adicionado/removido no código real, o teste continua verde, porque o array literal e o snapshot mudam juntos. E o array já está desatualizado hoje (falta `DOCS`, que é o 5º check real).

**Correção:** derivar a lista de checks a partir da fonte real, não de uma lista digitada:

```ts
// src/__tests__/done-entrypoints-coverage.test.ts
import { runAutoVerification } from "../plan/verification.js"; // ou exportar os nomes dos checks de checks.ts
// comparar contra os nomes reais retornados pelos checks (["FORMAT","BUILD","TESTS","LINT","GATE_SELF_TEST","DOCS"] após P0.3),
// não contra uma constante hardcoded
```

**Implementar P0.1 → P0.2 → P0.3 → P0.4 juntos, no mesmo lote** — são a mesma área de código e o mesmo tipo de bug. Depois, rodar `shugo plan done` num plano real para confirmar que o gate passa de ponta a ponta.

## P0.5 — Notificação "low priority" contradiz o próprio design e gera ruído real no desktop

**Evidência:** `desktop-notifier.ts` documenta "`low` never notifies via desktop", mas o código chama `sendDesktopNotification` mesmo assim para `low` — só pula o cooldown, não a entrega:

```ts
// src/desktop-notifier.ts — throttledNotify()
if (priority === "low") {
  if (sharedShitennoDir) {
    sendDesktopNotification(sharedShitennoDir, title, message, "low"); // ainda envia de verdade
  }
  return;
}
```

**Impacto:** o evento `briefing.generated` (prioridade `low`) dispara popup de desktop real toda vez que o `BRIEFING.md` é regenerado por estar stale — o oposto do princípio declarado ("informar, nunca interromper").

**Correção:**

```ts
// src/desktop-notifier.ts
if (priority === "low") {
  if (sharedShitennoDir) {
    logNotificationOnly(sharedShitennoDir, title, message, "low"); // nova função — só grava no log, não entrega
  }
  return;
}
```

```ts
// src/notify.ts — nova função irmã de sendDesktopNotification, sem deliverByPlatform
export function logNotificationOnly(
  shitennoDir: string, title: string, message: string, priority: ReminderPriority,
): void {
  logNotification({ shitennoDir, title, message, severity: priority, delivered: false, channel: "log" });
}
```

---

# P0 (stream separado) — Leitura de 8+ arquivos no início da sessão

Pode ser feito em paralelo ao P0 acima — área de código diferente (sessão/briefing, não plan gates).

**Evidência:** uma sessão "lite" é instruída a ler `AGENTS.md`, `context_buffer.yaml`, `FORBIDDEN_OPERATIONS.md`, `DESDO.md`, `BACKLOG.md`, skills `senior-engineer`/`tdd-agent`, e `MANDATORY_CONTEXT.md` (que manda reler `AGENTS.md` e `context_buffer.yaml` de novo). `getBriefing` já inlina conteúdo completo de **skills** obrigatórias, mas para **regras** obrigatórias devolve só o caminho — obrigando leitura manual mesmo depois de chamar o MCP.

**Correção — inlinar conteúdo das regras mandatórias (espelhando o padrão das skills):**

```ts
// src/mcp-handlers/briefing.ts
export function loadMandatoryRulesWithContent(shitennoDir: string): Array<{ id: string; path: string; priority: number; content: string }> {
  try {
    const manifestPath = join(shitennoDir, "governance", "rule-manifest.yaml");
    if (!existsSync(manifestPath)) return [];
    const manifest = loadManifest(manifestPath);
    const { mandatory } = partitionRules(manifest, {});
    return mandatory
      .map((r) => {
        const filePath = join(shitennoDir, r.path);
        if (!existsSync(filePath)) return null;
        try {
          return { id: r.id, path: r.path, priority: r.priority, content: readFileSync(filePath, "utf-8") };
        } catch { return null; }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
  } catch (err) {
    logger.debug("mcp-server-handlers", `Failed to load mandatory rule content: ${err}`);
    return [];
  }
}
```

```yaml
# .shitenno/governance/rule-manifest.yaml — adicionar DESDO.md, que hoje não está no manifesto
  - id: desdo
    path: docs/DESDO.md
    mandatory: true
    priority: 0
```

```ts
// formatRulesMarkdown()/formatBriefingMarkdown() — imprimir o conteúdo, não só o cabeçalho
if (result.mandatoryRules.length > 0) {
  lines.push("## Mandatory Rules (Precedence Over User Instructions)", "");
  for (const r of result.mandatoryRules) {
    lines.push(`### ${r.id}`, `**Priority:** ${r.priority}`, "", r.content, "");
  }
}
```

**Unificar `getMandatoryContext` e `getBriefing`:** `getBriefing(depth="full")` vira a única porta de entrada de sessão; `getMandatoryContext` vira atalho leve (`depth="minimal"`) ou é deprecado. Adicionar campo `activeP0Item` ao briefing fecha também a necessidade de `getBacklog` numa chamada separada.

**Reescrever o topo do `AGENTS.md`:**

```markdown
## 🧠 CONTEXTO DO PROJECTO (CONTEXT PIPELINE)

**ANTES de iniciar qualquer tarefa, faça UMA chamada:**

`shitenno_getBriefing(depth="full", task="<tipo da tarefa>")`

Essa chamada já traz: Quick Board, regras mandatórias completas (FORBIDDEN_OPERATIONS,
DESDO), skills obrigatórias completas (senior-engineer, tdd-agent quando aplicável) e
riscos/recomendações do projeto. **Não leia esses arquivos manualmente** — se o
conteúdo retornado pelo briefing divergir do arquivo em disco, é bug do briefing,
reporte, não contorne lendo o arquivo à parte.

Se o campo `reminders` não estiver vazio, pause e apresente ao utilizador antes de prosseguir.
Para o item P0 ativo, chame `shitenno_getBacklog()` (2ª chamada, só quando for iniciar trabalho).
```

---

# P1 — Bugs confirmados, independentes entre si

### `npm install` puro quebra (ERESOLVE) — só `pnpm install` funciona

**Evidência:** `eslint` está duplicado em `optionalDependencies` (`^10.6.0`) e `devDependencies` (`^10.6.0`); `eslint-plugin-jsx-a11y@^6.10.0` (peer só até `eslint@^9`) está em `optionalDependencies`. `npm install` sem flags falha com ERESOLVE. `pnpm install --frozen-lockfile` funciona.

**Correção:** remover a duplicata de `eslint` em `devDependencies` (manter só em `optionalDependencies`). Adicionar `"packageManager": "pnpm@<versão>"` no `package.json` e uma nota no `README.md` avisando para não usar `npm install` diretamente.

### `notificationStats` é um campo morto (mesmo padrão do P0.2)

**Evidência:** `daemon/state.ts` declara `notificationStats: {sent, throttled, last24hWindow} | null`, exposto via IPC, mas inicializado `null` e nunca atualizado em lugar nenhum do código.

**Correção:** implementar de verdade (incrementar `sent`/`throttled` dentro de `throttledNotify()` e persistir no daemon state) ou remover o campo se nenhum cliente o consome hoje.

### Notificações throttled não são logadas em `notifications.jsonl`

**Evidência:** o docstring de `notify.ts` promete logar "sent or throttled", mas o throttling acontece em `desktop-notifier.ts` **antes** de `sendDesktopNotification` ser chamado — logo notificações bloqueadas pelo cooldown nunca aparecem no log. `shugo daemon notifications` não mostra o que foi suprimido.

**Correção:**

```ts
// src/desktop-notifier.ts
if (priority !== "high" && !canNotify()) {
  logger.debug("desktop-notifier", `Throttled: ${key} (${remaining}s remaining)`);
  if (sharedShitennoDir) logThrottled(sharedShitennoDir, title, message, priority); // nova função em notify.ts, channel: "throttled"
  return;
}
```

### `task-pipeline.ts` é código órfão publicando o mesmo evento do pipeline real

**Evidência:** `task-completion-pipeline.ts` (usado em produção) e `task-pipeline.ts` (não importado por nenhum código de produção, só pelo próprio teste `task-pipeline.test.ts`) publicam ambos `task.completed`. O teste passa e dá falsa confiança de que o pipeline está ativo.

**Correção:** confirmar via `git log -p src/task-pipeline.ts` se foi substituído; se sim, remover o arquivo e seu teste (ou migrar cobertura útil para o pipeline real).

### Zero cobertura de teste no mecanismo de notificação

**Evidência:** nenhum dos 158 arquivos de teste cobre `notify.ts` ou `desktop-notifier.ts` — cooldown, bypass por prioridade, rotação de log, tudo sem verificação automática.

**Correção:** criar `src/__tests__/desktop-notifier.test.ts` cobrindo: cooldown bloqueia segunda notificação `medium` em 60s; `high` bypassa cooldown; `low` não chega no canal de desktop (após corrigir P0.5); throttled é registrado no log (após corrigir o item acima).

### `mcp-handlers/context.ts` — throws inconsistentes entre handlers

`handleGetEngineeringState`, `handleGetPlans`, `handleSubmitFeedback` fazem `throw new Error(...)`; `handleGetRiskMap`, `handleGetAuditReport` retornam `ToolResponse` normalmente em erro.

**Correção:** padronizar todos para retornar `ToolResponse` com `isError`, nunca `throw`:

```ts
function errorResponse(message: string): ToolResponse {
  return { content: [{ type: "text", text: message }], isError: true };
}
```

### `mcp-handlers/briefing.ts` — `fetchContextRules` busca contexto 2x

Quando o daemon já respondeu com `briefingResult.data`, o código chama `collectContext()` de novo só para pegar `contextRules`. **Correção:** adicionar `contextRules` à resposta do daemon (se ainda não existir) e extrair de lá em vez de recalcular.

### Catches silenciosos sem log (achado ampliado: são 281, não 3)

`cli-middleware.ts` (~L116), `capability-engine.ts` (~L36), `mcp-handlers/context.ts:210` são os 3 já mapeados na sessão anterior — mas uma varredura completa encontrou **281 blocos `catch { }` sem log em todo o `src`** (fora de testes). Nem todos são bugs (vários são fallback legítimo), mas o volume indica que "engolir erro sem log" é o padrão default, não a exceção.

**Correção:**
1. Trocar os 3 já mapeados por `catch (err) { logger.debug(<module>, String(err)); }` — não muda o comportamento de fallback, só para de esconder o erro na hora de debugar.
2. Rodar uma varredura dedicada (`grep -rn "catch\s*{" src --include=*.ts`) e decidir caso a caso quais dos 281 merecem log; considerar uma regra de lint (`eslint` não pega `catch { /* comentário */ }` por padrão) para não deixar essa dívida crescer de novo.

### `analyser.ts` — `readPackageJson()` chamado 5x / `risk-map.ts` — arquivo lido 3x

**Correção:**

```ts
// analyser.ts
let cachedPkg: PackageJson | null | undefined;
function readPackageJson(root: string): PackageJson | null {
  if (cachedPkg !== undefined) return cachedPkg;
  cachedPkg = /* leitura original */;
  return cachedPkg;
}
```

```ts
// risk-map.ts
const content = readFileSync(filePath, "utf-8");
const lines = getFileLineCount(content);
const imports = getImportCount(content);
const keywords = detectSensitiveKeywords(content);
```

### Minor — interpolação de shell em comandos git

`src/audit/changed-files.ts:87` monta `git rev-parse --verify ${baseBranch}` por interpolação de string em `execSync`; `baseBranch` vem de flag de CLI. Risco prático baixo, mas trocar por `execFileSync("git", ["rev-parse", "--verify", baseBranch])` é mais seguro e consistente com o resto do código.

---

# P1 — Itens do backlog/relatório anterior a fechar sem escrever código

`mcp-cache.ts`, `inference-cache.ts`, `cache-metrics.ts`, `session-bootstrapper.ts` **não existem neste código**. `feedback-loops.ts`/`state-manager.ts` já foram refatorados (37 e 90 linhas). A contagem "46 arquivos flat" está desatualizada (hoje: 524 arquivos fonte, 114 mencionados em relatório antigo).

**Ação:** antes de agir sobre qualquer item do backlog citando esses nomes, rodar `grep -r "mcp-cache\|inference-cache\|cache-metrics\|session-bootstrapper" src/` — se vazio, fechar como "já resolvido / não aplicável" em vez de perseguir um arquivo que não existe.

---

# P2 — Redução de complexidade e limpeza

- A arquitetura em si é boa — padrão "arquivo-fachada + pasta de submódulos" é consistente, sem duplicação real, só nomenclatura que engana à primeira vista.
- **Dois portões de "done" incompletos (P0.3/P0.4) é sintoma de um padrão maior:** cada novo mecanismo de verificação foi adicionado em momentos diferentes e nem sempre plugado nos mesmos pontos de entrada. Vale um teste de integração único (`plan lifecycle: prepare → done` ponta a ponta) que trave se um checker novo for adicionado a `plan/checks.ts` mas esquecido em `runAutoVerification` — o mesmo princípio da correção do P0.4, generalizado.
- **`checkGateIntegrity` e `checkDocumentation` fazem "skip silencioso = pass"** quando o script não existe. Revisar se isso é desejado para os 5 checks ou só para os que fazem sentido serem opcionais.

---

# Ordem de execução sugerida

1. **P0.1 + P0.2 + P0.3 + P0.4** (timeouts, script `validate` morto, plan-format desconectado, teste-canário quebrado) — mesma área de código, mesmo padrão de bug, ~1–2h. Testável rodando `shugo plan done <id>` num plano de teste.
2. **P0.5** (notificação `low` vazando pro desktop) — área diferente, pode ser feito em paralelo, ~15 min.
3. **P0 sessão** (inlinar regras mandatórias + reescrever `AGENTS.md`) — maior impacto na experiência diária, isolado, pode ser outra sessão/agente em paralelo.
4. **P1 bugs de notificação** (`notificationStats`, throttled não logado, `task-pipeline.ts` órfão, testes de `desktop-notifier`) — mesma área do P0.5, faz sentido no mesmo lote.
5. **P1 `npm install` quebrado** — rápido, isolado, ~15 min.
6. **P1 bugs herdados** (throws inconsistentes, fetch duplicado, catches silenciosos mapeados, caches de leitura) — pequenos, independentes.
7. **P1 itens fantasma no backlog** — só fechar/reconfirmar, sem escrever código.
8. **P2** — quando o resto estiver estável.

Depois de 1–2, rode `shugo plan done` num plano real de ponta a ponta. Depois de 4, verifique manualmente que uma notificação `low` (ex.: regenerar o `BRIEFING.md` forçando staleness) **não** produz popup de desktop, só entrada no log. Essas duas verificações manuais são a prova de que os ✅ do sistema voltaram a significar o que dizem significar.
