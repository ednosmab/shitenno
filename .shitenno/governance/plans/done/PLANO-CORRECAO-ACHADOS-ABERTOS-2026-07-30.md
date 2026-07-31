# Plano de Correção — Achados em Aberto (2026-07-30)

**Status:** Done
**Updated_at:** 2026-07-31T05:06:57.510Z
**Date:** 2026-07-30

> Confirmado antes de tudo: `task-completion-pipeline.ts` foi **substituído por completo**, não parcialmente — arquivo apagado, zero import residual em `.ts`, só menções em documentação histórica (ADRs arquivadas, planos `done/`), que é o esperado. Não precisa de nenhuma ação aqui.

Este plano cobre só o que ficou pendente depois da validação da Fase 1 e da checagem de segurança feita nesta sessão. Tudo abaixo foi confirmado lendo o zip mais recente (`__9_.zip`), não é achado antigo repetido sem checar.

---

## 1. `normalizePlanHeader` — resíduo do T1, lado da leitura

**Onde:** `src/markdown-plan-engine.ts`, dentro da classe, método privado `normalizePlanHeader`.

O lado da escrita (`updateLegacyStatus` + `updateStatus()` lançando erro) já foi corrigido. Este é o outro lado — roda a cada leitura de plano (`parsePlan`), e ainda falha silenciosamente:

```ts
// atual — src/markdown-plan-engine.ts
private normalizePlanHeader(filePath: string, content: string): string {
  if (/^\*\*Status:\*\*/m.test(content)) return content;
  if (YAML_BLOCK_RE.test(content)) return content;

  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
  const status = (closedBoxes > 0 && openBoxes === 0) ? "Done" : "In Progress";

  const lines = content.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));
  if (titleIndex === -1) return content; // <- mesmo no-op silencioso do T1 original

  lines.splice(titleIndex + 1, 0, "", `**Status:** ${status}`);
  const updated = lines.join("\n");

  writeFileSync(filePath, updated, "utf-8");
  return updated;
}
```

**Correção sugerida** (mesmo padrão de fallback já usado em `updateLegacyStatus`):

```ts
private normalizePlanHeader(filePath: string, content: string): string {
  if (/^\*\*Status:\*\*/m.test(content)) return content;
  if (YAML_BLOCK_RE.test(content)) return content;

  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
  const status = (closedBoxes > 0 && openBoxes === 0) ? "Done" : "In Progress";

  const lines = content.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));

  let insertAt: number;
  if (titleIndex !== -1) {
    insertAt = titleIndex + 1;
  } else {
    const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
    insertAt = firstNonEmpty === -1 ? 0 : firstNonEmpty + 1;
  }

  lines.splice(insertAt, 0, "", `**Status:** ${status}`);
  const updated = lines.join("\n");

  writeFileSync(filePath, updated, "utf-8");
  return updated;
}
```

Baixo risco — mesmo padrão já validado em produção no `updateLegacyStatus`.

---

## 2. Testes de regressão faltando para T1 e S1

Os dois fixes mais importantes desta rodada não têm teste dedicado guardando o comportamento — se alguém reescrever essas funções no futuro, a suíte não vai acusar a régressão.

```ts
// src/__tests__/markdown-plan-engine-status.test.ts — adicionar

describe("updateLegacyStatus — arquivo sem cabeçalho '# '", () => {
  it("insere Status mesmo sem título markdown", () => {
    const content = "Só um parágrafo qualquer, sem título markdown.\n";
    const result = updateLegacyStatus(content, "andamento");
    expect(result).toMatch(/\*\*Status:\*\*\s*In Progress/i);
  });
});

describe("normalizePlanHeader — arquivo sem cabeçalho '# '", () => {
  it("insere Status mesmo sem título markdown (lado da leitura)", () => {
    // usar o mesmo fixture do teste acima, mas passando pela leitura do engine
    // (parsePlan -> normalizePlanHeader), não só a função isolada
  });
});

describe("updateStatus — falha alta quando não consegue escrever Status", () => {
  it("lança erro em vez de arquivar silenciosamente", () => {
    // fixture "hostil": conteúdo sem '# título' e sem **Status:**
    // engine.updateStatus(id, "done") deve lançar, não seguir em frente
  });
});
```

```ts
// src/__tests__/rule-engine-actions.test.ts — adicionar

describe("executeUpdateBacklogStatus — publica task.completed só em estado terminal", () => {
  it("publica task.completed quando toState é 'concluído'", () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);
    executeUpdateBacklogStatus(
      { type: "update_backlog_status", params: { taskId: "T1", fromState: "andamento", toState: "concluído" } },
      context,
    );
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ taskId: "T1", toState: "concluído" }));
  });

  it("NÃO publica task.completed em transição não-terminal", () => {
    const bus = getEventBus();
    const spy = vi.fn();
    bus.subscribe("task.completed", spy);
    executeUpdateBacklogStatus(
      { type: "update_backlog_status", params: { taskId: "T1", fromState: "backlog", toState: "andamento" } },
      context,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});
```

Ajustar os fixtures/imports conforme o padrão de teste já usado nos arquivos vizinhos (`markdown-plan-engine.test.ts`, `rule-engine/actions.test.ts` se existir, ou criar um novo).

---

## 3. Template de `shugo init` não recebeu a otimização de lazy-loading

**Onde:** `src/templates/base/opencode.json` (usado em todo projeto novo) vs. `opencode.json` real deste projeto (já otimizado).

Hoje o template ainda carrega 4 arquivos fixos e não usa o `session-bootstrapper.ts`/lazy-loading via MCP que o projeto real já adotou:

```json
// template atual — src/templates/base/opencode.json
"instructions": [
  "./.shitenno/docs/AGENTS.md",
  "./.shitenno/docs/opencode-context.md",
  "./.shitenno/governance/MANDATORY_CONTEXT.md",
  "./.shitenno/governance/context/context_buffer.yaml"
],
```

**Correção sugerida** — replicar o padrão já validado no projeto real:

```json
"instructions": [
  "./.shitenno/docs/AGENTS.md",
  "./.shitenno/governance/context/context_buffer.yaml",
  "LAZY LOADING: Use shitenno_getSkills(name) or shitenno_getSkills(task) to load project skills on-demand. Optional files (opencode-context.md, MANDATORY_CONTEXT.md, skill-manifest.yaml, rule-manifest.yaml, agent contracts) are loaded via MCP when needed. NEVER use the built-in skill tool."
],
```

**Atenção do agente antes de aplicar:** isso muda o comportamento de todo projeto novo criado via `shugo init` — o agente de IA passa a depender de chamar `getMandatoryContext`/`getSkills` via MCP em vez de já receber tudo no primeiro turno. Só vale a pena se o `AGENTS.md` do template já instrui isso explicitamente (o mesmo texto do `instructions[]` real menciona `shitenno_getSkills`, então o `AGENTS.md` shipado precisa dizer a mesma coisa, ou o agente recém-inicializado não vai saber que precisa pedir). Testar com um `shugo init` limpo e conferir se o primeiro turno do agente ainda funciona bem antes de fechar isso.

---

## 4. Daemon sem handler global de erro (R4, ainda em aberto)

**Onde:** `src/daemon/index.ts`. O daemon é processo de longa duração com estado só em memória (`persistState` grava a cada 30s ou quando `dirty`), mas não tem rede de segurança contra erro não tratado.

```ts
// src/daemon/index.ts — adicionar próximo à inicialização do daemon,
// antes de setupPeriodicTimers/qualquer subscribe

process.on("uncaughtException", (err) => {
  daemonLog(ctx.logPath, "ERROR", `Uncaught exception: ${err.stack ?? err.message}`);
  try {
    persistState(ctx.state, ctx.statePath, /* force */ true);
  } catch {
    // não deixar o handler de erro quebrar por causa de outro erro
  }
  process.exit(1); // falhar rápido e visível, não continuar num estado inconsistente
});

process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
  daemonLog(ctx.logPath, "ERROR", `Unhandled rejection: ${message}`);
  // aqui não precisa derrubar o processo — promise rejeitada não corrompe
  // estado do jeito que uma exceção síncrona corrompe, mas precisa ficar no log
});
```

**Decisão do agente ao aplicar:** `process.exit(1)` em `uncaughtException` é a prática recomendada (não confiar em continuar rodando após um erro não tratado), mas se o daemon tiver algum supervisor/restart automático (`systemd`, `pm2`, ou o próprio `shugo daemon start` com watchdog), confirmar que o restart automático existe antes — senão o usuário perde o daemon silenciosamente até reiniciar manualmente. Se não houver supervisor, vale considerar logar + tentar `cleanupAudit()`/fechar handles antes do `exit`.

---

## 5. `capability-engine/maturity.ts` — scoring por capacidade ainda aproximado (R5)

Já foi parcialmente corrigido: as três funções (`checkCapabilitySkills`, `checkCapabilityTemplates`, `checkCapabilityMetrics`) agora checam se a capacidade **declara** relevância pra aquele tipo de arquivo antes de contar pontos — bom avanço em relação ao "conta pra tudo" de antes. Mas o passo final ainda é impreciso:

```ts
// atual
function checkCapabilitySkills(capability: Capability, shitennoDir: string): boolean {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return false;
  const capabilityFiles = getCapabilityFilesForEngine(capability);
  const hasRelevantSkill = capabilityFiles.some((f) => f.startsWith("docs/skills/"));
  if (!hasRelevantSkill) return false;
  return readdirSync(skillsDir).filter((f) => f.endsWith(".md")).length > 0; // <- qualquer .md na pasta, não necessariamente da capacidade
}
```
Isso ainda dá pontos pra capacidade B se existir QUALQUER skill `.md` na pasta, mesmo que seja da capacidade A. É bem menos grave que o bug original (que dava pontos globais pra tudo, incondicionalmente), mas ainda não é "por capacidade" de verdade.

**Correção sugerida** (exige que `getCapabilityFilesForEngine` devolva nomes de arquivo específicos, não só prefixos de pasta — checar se o formato atual permite isso; se `capabilityFiles` já tiver caminhos completos tipo `docs/skills/onboarding.md`, o fix é direto):

```ts
function checkCapabilitySkills(capability: Capability, shitennoDir: string): boolean {
  const skillsDir = join(shitennoDir, "docs", "skills");
  if (!existsSync(skillsDir)) return false;
  const capabilityFiles = getCapabilityFilesForEngine(capability)
    .filter((f) => f.startsWith("docs/skills/"));
  if (capabilityFiles.length === 0) return false;

  // Em vez de contar qualquer .md na pasta, checar se ALGUM dos arquivos
  // específicos desta capacidade existe de fato.
  return capabilityFiles.some((f) => existsSync(join(shitennoDir, "..", f)));
}
```
Ajustar o `join` conforme a base real usada em `getCapabilityFilesForEngine` (confirmar se os caminhos ali são relativos à raiz do projeto ou ao `shitennoDir` antes de aplicar — não assumir, checar as outras funções `check*` que já usam esse padrão pra ver a convenção).

**Prioridade:** baixa. Já não é mais "todo mundo em 100% incondicionalmente" (o bug grave original), é só uma aproximação otimista. Pode ficar pra depois dos itens 1-4.

---

## 6. Eventos verdadeiramente órfãos (Bloco W2, decisão já reduzida a 9)

Não é código pra aplicar direto — é limpeza de tipo. Se você já decidiu podar (em vez de documentar como ponto de extensão), a mudança é só remover as entradas mortas do union type:

```ts
// src/event-bus.ts — remover, SE a decisão for podar
// (checar de novo antes: talvez algum desses já tenha sido religado desde a última auditoria)
| "plan.format_warning"
| "context.p4_loaded"
| "watcher.error"
| "daemon.ready"
| "proactive.digest_ready"
| "action.pre_sensitive"
| "pipeline.partial_failure"
| "semantic.pattern_detected"
| "semantic.insight_detected"
| "context.tier_mismatch"
```
Recomendo pedir ao agente pra **rodar a mesma busca que eu fiz antes de remover qualquer um** (`grep -rn "publish(\"<evento>\"" src/` e `grep -rn "\"<evento>\"" src/rule-engine/engine.ts src/daemon/event-handlers.ts src/daemon/semantic-runner.ts`) — essa lista foi levantada há um dia, pode ter mudado com as implantações recentes.

---

## Ordem sugerida

1. **Item 1** (normalizePlanHeader) — mesmo padrão do T1, baixíssimo risco, faz sentido fechar o par.
2. **Item 4** (handler de erro no daemon) — maior severidade real das pendências (processo de longa duração sem rede de segurança).
3. **Item 2** (testes de regressão) — não muda comportamento, só protege o que já foi corrigido.
4. **Item 3** (template opencode.json) — testar com `shugo init` limpo antes de fechar, por causa da mudança de comportamento do agente.
5. **Item 5** (maturity scoring) — baixa prioridade, aproximação já é bem menos grave que antes.
6. **Item 6** (poda de eventos) — só se a decisão de escopo já foi tomada; senão, deixar quieto.
