# PLAN — Proactive Visibility, Notification Precision & System Improvements

**Data:** 2026-07-23
**Updated_at:** 2026-07-24T14:30:00.000Z
**Status:** checked
**Date:** 2026-07-24
**Prioridade:** P0

---


## Checklist

- [x] `shugo briefing` mostra proactive alerts pendentes
- [x] Challenge de severity `high` dispara notificação desktop em <5s
- [x] Notificações funcionam em Linux e macOS (Windows via fallback log)
- [x] `shugo init` em projeto terceiro gera `.gitignore` completo
- [x] `shugo daemon status` mostra circuit breaker, proactive engine, último audit
- [x] Pipeline proativo tem teste e2e cobrindo file→event→challenge→notification
- [x] Documentação `docs/DAEMON.md` existe e é precisa

## Progresso

| Bloco | Descrição | Estado | Commit |
|-------|-----------|--------|--------|
| A | Proactive Visibility | ✅ Done | (previous sessions) |
| B | Notification Precision | ✅ Done | (previous sessions) |
| C | File-watcher scope | ✅ Done | 3485d73 |
| D | .gitignore scaffolding | ✅ Done | (pre-existing) |
| E | Daemon Observability | ✅ Done | e3dde2c |
| F | Hardening & Quality | ✅ Done | (pre-existing) |

**Todos os 6 blocos concluídos.**

## Diagnóstico

### Problema 1: Proatividade invisível

O proactive engine (`prioritization/triggers.ts`) gera `challenge.generated` events que ficam
acumulados em `state.challenges[]` no daemon — mas **nunca chegam ao usuário**. Não há:
- Notificação desktop para challenges
- Superfície no `shugo status` / `shugo briefing` que mostre challenges pendentes
- Mecanismo de "push" — o usuário precisa chamar `shugo daemon status` ou `query_challenges` via IPC manualmente

O proactive engine também é **reativo a eventos que podem nunca ser publicados**:
- `engineering_state.consolidated` — quem publica? Só o daemon, e só em `runPeriodicAudit` (4-6h)
- `knowledge_debt.detected` — depende de outro módulo publicar
- Resultado: entre audits periódicos, o proactive engine fica **silencioso**

### Problema 2: Notificações imprecisas e limitadas

`desktop-notifier.ts` escuta apenas 2 eventos:
- `task.completed`
- `session.end`

**Não notifica sobre:**
- Challenges proativos (entropy degrading, health critical, knowledge gaps)
- Drift detection (`workdir.large_uncommitted_drift`)
- Plan inconsistencies (`plan.inconsistency_detected`)
- Large commits detectados
- Reminders stale removidos
- Circuit breaker trips

Além disso:
- **Linux-only** (`notify-send`) — macOS e Windows ficam sem notificações
- Cooldown global de 60s é cego — uma notificação de `session.end` com `bypassCooldown=true`
  pode "gastar" o slot e suprimir um challenge crítico que veio 5s depois

### Problema 3: File-watcher não observa o código do projeto

`file-watcher.ts` observa apenas `.shitenno/governance/` e `.shitenno/docs/`.
Mudanças em `src/`, `tests/`, `package.json` do projeto **não disparam eventos**.
O proactive engine nunca reage a:
- Novo arquivo sem teste
- Remoção de um ADR referenciado
- Mudança em `package.json` (nova dependência, script alterado)

### Problema 4: `.gitignore` scaffolding incompleto

`scaffolder.ts:237-245` injeta apenas `.shitenno/docs/feedback/` no `.gitignore` do projeto alvo.
O `.gitignore` do próprio repo exclui ~12 paths de runtime. Terceiros vão versionar
cache, daemon state, executions, checkpoints — poluição acidental.

### Problema 5: Falta observabilidade do daemon

Não há um comando claro que responda: "O que o daemon está fazendo AGORA proativamente?"
O `shugo daemon status` (via IPC `status`) mostra uptime e contagens, mas não:
- Último challenge gerado e quando
- Último audit periódico e resultado
- Próximos timers agendados
- Estado do circuit breaker (closed/open/half-open)
- Se o proactive engine está ativo ou parado

---

## Plano de Execução

### BLOCO A — Proactive Visibility (P0)

**A.1 — Proactive digest periódico no daemon**

Adicionar um timer periódico (default: 30min, configurável via env `SHITENNO_PROACTIVE_INTERVAL_MS`)
que:
1. Consolida `state.challenges[]` pendentes (não entregues ao usuário)
2. Consolida drift, health trend, reminders stale
3. Grava um `proactive-digest.md` em `.shitenno/daemon/` com timestamp
4. Publica `proactive.digest_ready` no event bus
5. Limpa challenges entregues (marca como `deliveredAt`)

Arquivo: `src/daemon/proactive-digest.ts` (novo)
Teste: `src/__tests__/proactive-digest.test.ts`

**A.2 — Surfar challenges no briefing e status**

- `shugo briefing`: nova seção "Proactive Alerts" que lê `state.challenges[]` não-entregues
- `shugo status`: linha "⚠ N proactive alerts pending" com `--verbose` mostrando detalhes
- `getBriefing` MCP tool: incluir challenges no output JSON

Arquivos: `src/briefing.ts`, `src/commands/status.ts`, `src/mcp-server-handlers.ts`
Teste: estender testes existentes

**A.3 — Consolidar engineering state proativamente**

Adicionar timer no daemon (default: 15min) que publica `engineering_state.consolidated`
periodicamente, garantindo que o proactive engine não fique silencioso entre audits de 4-6h.

Arquivo: `src/daemon/index.ts` (extender `setupPeriodicTimers`)
Teste: `src/__tests__/daemon-proactive-timer.test.ts`

---

### BLOCO B — Notification Precision (P0)

**B.1 — Expandir escopo do desktop-notifier**

Adicionar subscrições para:
- `challenge.generated` (severity high → notificação imediata; medium → respeitar cooldown)
- `workdir.large_uncommitted_drift`
- `plan.inconsistency_detected`
- `proactive.digest_ready`

Manter cooldown global, mas com **prioridade por severidade**:
- `critical`/`high`: bypass cooldown
- `medium`: cooldown normal
- `low`: nunca notificar (só log)

Arquivo: `src/desktop-notifier.ts`
Teste: `src/__tests__/desktop-notifier.test.ts` (estender)

**B.2 — Notificações cross-platform**

Substituir `notify-send` por detecção multi-plataforma:
- Linux: `notify-send` (existente)
- macOS: `osascript -e 'display notification'`
- Windows: `powershell -c [System.Windows.MessageBox]` ou `msg.exe`
- Fallback: log + escrever em `.shitenno/daemon/notifications.jsonl` (persistente, consultável)

Arquivo: `src/notify.ts` (refatorar)
Teste: `src/__tests__/notify.test.ts` (novo ou estender)

**B.3 — Notification log persistente**

Toda notificação (enviada ou throttled) grava em `.shitenno/daemon/notifications.jsonl`:
```jsonl
{"ts":"...","title":"...","message":"...","severity":"high","delivered":true,"channel":"notify-send"}
```

Permite `shugo daemon notifications` para ver histórico.

Arquivo: `src/notify.ts` + `src/commands/daemon.ts`
Teste: estender testes existentes

---

### BLOCO C — File-watcher scope (P1)

**C.1 — Observar código do projeto (opt-in)**

Adicionar `extraPaths` configurável no daemon para observar `src/` (ou o source dir detectado
pelo analyser). Eventos gerados:
- `source.file_added` → verificar se tem teste correspondente
- `source.file_deleted` → verificar se ADRs/skills referenciam o arquivo
- `package.json` change → `engineering_state.updated`

**Opt-in**: default OFF. Ativar via `shugo daemon start --watch-source` ou
env `SHITENNO_WATCH_SOURCE=1`.

Arquivo: `src/daemon/index.ts`, `src/infrastructure/persistence/file-watcher.ts`
Teste: `src/__tests__/file-watcher-source.test.ts`

**C.2 — Reactivity a git events**

O file-watcher não captura git events (commit, merge, branch switch).
Adicionar watch em `.git/HEAD` e `.git/refs/` para detectar:
- Commit → publicar `git.commit_detected` → proactive engine reage
- Branch switch → invalidar caches de briefing/riskmap

Arquivo: `src/infrastructure/persistence/file-watcher.ts`
Teste: estender testes existentes

---

### BLOCO D — `.gitignore` scaffolding completo (P1)

**D.1 — Injetar exclusões completas no `shugo init`**

Substituir o bloco único de feedback por todas as exclusões de runtime:

```gitignore
# Shitenno — runtime state (auto-generated, do not version)
.shitenno/.cache/
.shitenno/daemon/
.shitenno/telemetry/
.shitenno/feedback/records/
.shitenno/feedback/summary.json
.shitenno/governance/executions/
.shitenno/governance/context/checkpoints/
.shitenno/governance/context/context_buffer.yaml
.shitenno/docs/generated/
```

Idempotente: verificar se cada linha já existe antes de adicionar.

Arquivo: `src/scaffolder.ts` (refatorar `updateGitignore`)
Teste: `src/__tests__/scaffolder.test.ts` (estender)

---

### BLOCO E — Daemon Observability (P1)

**E.1 — `shugo daemon status` enriquecido**

Expandir o output do comando para incluir:
- Circuit breaker state (closed/open/half-open + last trip time)
- Proactive engine: ativo? último challenge? quantos pendentes?
- Último audit periódico: score, quando, nível
- Próximos timers: próximo audit, próximo proactive digest
- Notification count: enviadas vs throttled nas últimas 24h

Arquivo: `src/commands/daemon.ts`, `src/daemon/ipc.ts` (novo message type `query_proactive`)
Teste: estender testes de daemon

**E.2 — `shugo daemon notifications`**

Novo subcomando que lê `notifications.jsonl` e mostra histórico formatado.
Flags: `--last N`, `--severity high`, `--json`.

Arquivo: `src/commands/daemon.ts`
Teste: `src/__tests__/daemon-notifications.test.ts`

**E.3 — Daemon heartbeat no briefing**

O briefing deve mostrar se o daemon está rodando e saudável:
- "Daemon: active (uptime 3h, last audit 45min ago, 2 proactive alerts)"
- "Daemon: not running (reactive mode — run 'shugo daemon start' for proactive features)"

Arquivo: `src/briefing.ts`
Teste: estender testes de briefing

---

### BLOCO F — Hardening & Qualidade (P2)

**F.1 — Rate limiting no proactive engine**

O proactive engine pode gerar challenges em cascata (ex: 10 knowledge gaps → 10 challenges).
Adicionar deduplication: mesmo `type + description` dentro de 1h → merge, não duplicar.

Arquivo: `src/prioritization/triggers.ts`
Teste: estender testes existentes

**F.2 — Daemon graceful degradation documentado**

Criar `docs/DAEMON.md` com:
- O que funciona com daemon vs sem daemon
- Footprint esperado (CPU/RAM)
- Como desativar (`shugo daemon stop`, remover `daemon.approved`)
- Circuit breaker: o que faz, quando trip, como resetar

Arquivo: `docs/DAEMON.md` (novo)

**F.3 — Teste de integração do pipeline proativo completo**

Teste e2e que simula: file change → watcher → event → proactive engine → challenge → notification.
Garante que o pipeline não quebra silenciosamente.

Arquivo: `src/__tests__/proactive-pipeline.e2e.test.ts`

---

## Ordem de Execução

1. **BLOCO A** (proactive visibility) — resolve o problema central
2. **BLOCO B** (notifications) — torna a proatividade visível fora do terminal
3. **BLOCO D** (.gitignore) — rápido, evita poluição em terceiros
4. **BLOCO E** (observability) — dá confiança ao operador
5. **BLOCO C** (file-watcher scope) — amplia reactividade
6. **BLOCO F** (hardening) — robustez final

## Critérios de Aceitação

- [ ] `shugo briefing` mostra proactive alerts pendentes
- [ ] Challenge de severity `high` dispara notificação desktop em <5s
- [ ] Notificações funcionam em Linux e macOS (Windows via fallback log)
- [ ] `shugo init` em projeto terceiro gera `.gitignore` completo
- [ ] `shugo daemon status` mostra circuit breaker, proactive engine, último audit
- [ ] Pipeline proativo tem teste e2e cobrindo file→event→challenge→notification
- [ ] Documentação `docs/DAEMON.md` existe e é precisa
