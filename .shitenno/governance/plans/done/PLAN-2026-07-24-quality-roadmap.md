# PLAN-2026-07-24-quality-roadmap — Roadmap de Qualidade Pós-Auditoria

**Status:** Done
**Date:** 2026-07-24
**Updated_at:** 2026-07-24T12:00:00.000Z
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 12h

---


## Checklist

- [x] Passo 1.1 — Atomic writes para session-tracker
- [x] Passo 1.2 — Atomic writes para context-buffer-writer
- [x] Passo 1.3 — Substituir execSync por async em plan-lifecycle
- [x] Passo 1.4 — Habilitar dead letter queue no daemon
- [x] Passo 2.1 — File watcher debounce cleanup
- [x] Passo 2.2 — State persistence logging
- [x] Passo 2.3 — Verification shutdown race
- [x] Passo 2.4 — Plan sidecar orphan recovery
- [x] Passo 3.1 — Empty catch blocks em paths críticos
- [x] Passo 3.2 — BoundedQueue O(n) → ring buffer
- [x] Passo 3.3 — Daemon state hardcoded 50 → MAX_SESSIONS

## Contexto

Auditoria completa do projecto shitenno (health score 85/100) identificou 4 issues High severity, 8 Medium e 7 Low. Os bugs críticos incluem: `execSync` que bloqueia o event loop do daemon (até 420s), race conditions no session tracker e context_buffer, e erros async silenciados no event bus. O dual PID do daemon foi corrigido, mas a infraestrutura de dados precisa de fortalecimento.

## Objetivo

Eliminar todos os issues High e Medium severity, melhorar a resiliência do daemon, e estabelecer padrões de segurança para operações concorrentes.

**Critérios de aceitação:**
1. Zero race conditions em escrita de ficheiros partilhados (session tracker, context_buffer)
2. Daemon não bloqueia event loop durante verificações de planos
3. Todos os empty catch blocks em paths críticos têm logging
4. Testes unitários existentes continuam a passar (regressão zero)

---

## Fase 1: Fixes Críticos (High Severity) — 5h

### Passo 1.1: Atomic writes para session-tracker
**Ficheiro:** `src/session-tracker.ts`
**Acção:** Implementar `writeAtómico` que escreve para ficheiro temp + rename. Proteger `trackCommand`, `trackFeedback` e `endSession` com file lock simples (`.lock` file com PID).
**Verificação:** Criar teste de concorrência: 2 processos simultâneos a escrever no mesmo session file → ambos preservados.

### Passo 1.2: Atomic writes para context-buffer-writer
**Ficheiro:** `src/context-buffer-writer.ts`
**Acção:** Trocar `writeFileSync` por `writeAtómico` (temp + rename). Adicionar file lock para prevenir writes concorrentes de daemon e CLI.
**Verificação:** Teste: daemon e CLI a escrever `context_buffer.yaml` simultaneamente → sem corrupção YAML.

### Passo 1.3: Substituir execSync por async em plan-lifecycle
**Ficheiro:** `src/plan-lifecycle.ts`
**Acção:** Criar `execAsync` wrapper (`execFile` + `Promise`). Substituir `checkBuild`, `checkTests`, `checkLint` para usar `execAsync`. Manter interface síncrona existente via wrapper async no call site do daemon.
**Verificação:** `pnpm run test:unit` passa; daemon não bloqueia durante verificação.

### Passo 1.4: Habilitar dead letter queue no daemon
**Ficheiro:** `src/daemon/index.ts`
**Acção:** Chamar `getEventBus().enableDeadLetterQueue(shitennoDir)` durante inicialização do daemon, antes de subscrições.
**Verificação:** Daemon inicia sem erros; erros async ficam registados em `shitenno/dead-letter/`.

---

## Fase 2: Fixes Medium Severity — 4h

### Passo 2.1: File watcher debounce cleanup
**Ficheiro:** `src/infrastructure/persistence/file-watcher.ts`
**Acção:** Guardar referência de `pendingEvents` Map no módulo. No restart, chamar `pendingEvents.clear()` antes de fechar watcher antigo.
**Verificação:** Teste: restart do watcher durante debounce activo → sem eventos duplicados.

### Passo 2.2: State persistence logging
**Ficheiro:** `src/daemon/state.ts`
**Acção:** Trocar `logger.debug` por `logger.warn` no catch de `persistState`. Publicar evento `watcher.error` quando persistência falha.
**Verificação:** Simular erro de disco → log aparece em warn level.

### Passo 2.3: Verification shutdown race
**Ficheiro:** `src/daemon/index.ts`
**Acção:** No `setupShutdown`, guardar referência ao child process spawned por `execSync`/`spawn` e enviar `SIGTERM` ao process group (`process.kill(-pid, 'SIGTERM')`) antes de release do verification lock.
**Verificação:** Daemon recebe SIGTERM durante verificação → child process termina graciosamente.

### Passo 2.4: Plan sidecar orphan recovery
**Ficheiro:** `src/plan-lifecycle.ts`
**Acção:** No startup scan, detectar ficheiros `.verification.json` órfãos (sem plano correspondente em status "done") e removê-los.
**Verificação:** Criar `.verification.json` manualmente → daemon limpa no próximo startup.

---

## Fase 3: Higiene de Código — 3h

### Passo 3.1: Empty catch blocks em paths críticos
**Ficheiro:** `src/proactive-digest.ts`, `src/daemon/index.ts`, `src/cli-middleware.ts`
**Acção:** Adicionar `logger.debug()` ou `logger.warn()` em todos os catch blocks vazios em módulos do daemon. Módulos non-daemon (audit, semantic) manter como estão (intencional).
**Verificação:** `grep -rn "catch {}" src/ | grep -v __tests__ | grep -v templates` → zero resultados em módulos daemon.

### Passo 3.2: BoundedQueue O(n) → ring buffer
**Ficheiro:** `src/daemon-resources.ts`
**Acção:** Substituir `Array.shift()` por ring buffer com head/tail pointers para O(1) push/pop.
**Verificação:** Benchmark: 1000 pushes → latência constante.

### Passo 3.3: Daemon state hardcoded 50 → MAX_SESSIONS
**Ficheiro:** `src/daemon/index.ts`
**Acção:** Substituir literal `50` por `MAX_SESSIONS` importado de `state.ts`.
**Verificação:** `grep -n "50" src/daemon/index.ts` → nenhum match para session limit.

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | File lock via `.lock` file com PID | `flock` (POSIX) | Mais portable; `flock` não funciona bem em WSL/alguns filesystems |
| 2 | `execAsync` via `execFile` (não `spawn`) | `worker_threads` | `execFile` é mais simples; `worker_threads` adiciona complexidade desnecessária |
| 3 | Ring buffer para BoundedQueue | Circular buffer com `Map` | Array-based ring buffer é mais simples e suficiente para `maxSize=1000` |
| 4 | Manter `execSync` em módulos não-daemon | Converter tudo para async | Impacto mínimo; apenas o daemon event loop é afectado |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | `execAsync` quebra interface existente | Alto | Manter funções síncronas; criar wrappers async apenas no call site do daemon |
| 2 | File lock causa deadlock entre CLI e daemon | Médio | Timeout de 5s no lock; fallback para write sem lock (último writer wins) |
| 3 | Ring buffer quebra serialização de state | Baixo | Testes existentes cobrem persistência de state |
| 4 | Dead letter queue enche disco | Baixo | `MAX_DLQ=100`; auto-cleanup de entradas antigas |
