# Plano: transformar o daemon no kernel do shitenno-go

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.056Z
**Date:** 2026-07-16

> Baseado em leitura direta de `src/daemon.ts`, `src/daemon-client.ts`, `src/mcp-server.ts`,
> `src/mcp-server-handlers.ts`, `src/briefing-cache.ts`, `src/cli-middleware.ts` e
> `docs/adr/ADR-002-event-driven-state.md`. Todo trecho de código abaixo referencia arquivos
> e assinaturas reais do repositório enviado (`shitenno-go-main.zip`), não pseudocódigo genérico.

---

## 1. Diagnóstico (evidência, não opinião)

Fatos confirmados no código, não inferências:

1. **O daemon já tem estado rico e vivo.** `DaemonState` em `src/daemon.ts:123` guarda `drift`,
   `sessions`, `health`, `challenges`, `debt`, `events` — e responde a 8 tipos de query IPC
   (`query_events`, `query_health`, `query_drift`, `query_sessions`, `query_challenges`,
   `query_debt`, além de `status`/`ping`).
2. **`daemon-client.ts` só expõe 2 dessas 8 queries** para o resto do sistema: `pingDaemon()` e
   `queryDaemonStatus()`. As outras 6 (`query_events`, `query_drift`, `query_sessions`,
   `query_challenges`, `query_debt`) não têm nenhuma função cliente — são inacessíveis fora do
   próprio `daemon.ts`.
3. **`grep` de `daemon-client` no restante de `src/` retorna exatamente 2 arquivos**:
   `cli-middleware.ts` (só para autoiniciar o daemon) e `commands/daemon.ts` (o comando
   `shiten daemon` em si, para mostrar status). Nenhum outro comando, nenhum handler do MCP,
   consulta o daemon.
4. **`mcp-server-handlers.ts` recomputa tudo do disco a cada chamada**: `collectContext()`,
   `generateRiskMap()`, `loadRules()`, `getEngineeringState()` — nenhuma dessas funções sabe que
   o daemon existe.
5. **Já existe um cache de briefing** (`briefing-cache.ts`), mas é um cache *pull*: cada processo
   CLI/MCP calcula um hash SHA-256 dos inputs e decide se recalcula. É correto, mas caro e
   duplicado — o daemon já observa os mesmos arquivos via `chokidar` (`startWatching` em
   `daemon.ts`) e poderia invalidar de forma *push*, uma vez, para todos os consumidores.

Conclusão honesta: o daemon não é fachada, mas também não é o cérebro do sistema — é um
apêndice que roda, observa e guarda estado que **quase ninguém lê**. A "identidade maior" que
você imagina não requer inventar um conceito novo; requer conectar fiação que já existe.

---

## 2. Arquitetura-alvo

```
                     ┌─────────────────────────┐
                     │   shiten daemon (kernel)  │
                     │  DaemonState em memória   │
                     │  chokidar watch + eventos │
                     │  cache de briefing/risco  │
                     └───────────┬───────────────┘
                     IPC (unix socket, já existe)
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                    ▼
        CLI commands         MCP handlers        shiten daemon (cmd)
   (status/briefing/…)   (getBriefing, etc.)      status/debug
              │                   │
              └─── fallback disco quando daemon não está rodando ───┘
```

Princípio que **já está escrito** no cabeçalho de `daemon.ts` e deve ser preservado:
> *"PRINCIPLE: The daemon is opt-in. The CLI always works without it."*

Isso significa: cada ponto de integração abaixo precisa de fallback síncrono para o cálculo
atual em disco. Não é opcional — é a garantia que evita que `shiten` vire um sistema frágil
que quebra sem o daemon rodando.

---

## 3. Fase 0 — Expor as queries que o daemon já sabe responder

**Arquivo: `src/daemon-client.ts`** — hoje só tem `pingDaemon` e `queryDaemonStatus`, cada
um duplicando a mesma lógica de socket (connect → write → timeout → parse). Primeiro passo é
extrair isso para um cliente genérico:

```typescript
// src/daemon-client.ts — adicionar

/**
 * Generic IPC query against the running daemon.
 * Returns null on any failure (daemon down, timeout, malformed response) —
 * callers must always have a disk-based fallback, never throw here.
 */
export function queryDaemon<T extends { type: string }>(
  shitenDir: string,
  message: Record<string, unknown> & { type: string },
  timeoutMs = 1_500
): Promise<T | null> {
  return new Promise((resolve) => {
    const socketPath = getSocketPath(shitenDir);
    if (!existsSync(socketPath)) {
      resolve(null);
      return;
    }

    const client = createConnection(socketPath);
    const timer = setTimeout(() => {
      client.destroy();
      resolve(null);
    }, timeoutMs);

    client.once("connect", () => {
      client.write(JSON.stringify(message) + "\n");
    });

    client.once("data", (data) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(data.toString().trim()) as T);
      } catch {
        resolve(null);
      }
      client.destroy();
    });

    client.once("error", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}
```

Depois, `pingDaemon` e `queryDaemonStatus` podem ser reescritos em cima de `queryDaemon` (menos
duplicação), e você ganha `queryDaemon({ type: "query_health" })`,
`queryDaemon({ type: "query_debt" })` etc. de graça, sem tocar em `daemon.ts`.

**Custo:** baixo. **Risco:** baixo — é aditivo, não muda nenhum comportamento existente.

---

## 4. Fase 1 — Novas queries no daemon: briefing e risk map cacheados

Hoje o daemon não sabe nada sobre briefing/risk map — só sobre drift/health/sessions/debt.
Para o daemon virar dono do cache (em vez de cada processo recalcular hash), ele precisa:

1. Computar `collectContext()` / `generateRiskMap()` sob demanda na primeira query.
2. Guardar o resultado em `DaemonState`.
3. Invalidar quando `chokidar` disparar mudança relevante (ele já observa os arquivos).

```typescript
// src/daemon.ts — extensão de DaemonState

interface DaemonState {
  drift: DriftInfo | null;
  sessions: SessionInfo[];
  health: HealthInfo | null;
  challenges: ChallengeInfo[];
  debt: DebtInfo | null;
  events: EventEntry[];
  startedAt: string;
  // NOVO:
  briefingCache: { computedAt: string; data: unknown } | null;
  riskMapCache: { computedAt: string; data: unknown } | null;
}
```

```typescript
// src/daemon.ts — novo case no handleMessage()

case "query_briefing": {
  if (!state.briefingCache) {
    const { collectContext } = await import("./context-collector.js");
    const snapshot = collectContext(process.cwd(), shitenDir); // projectRoot precisa ser passado ao runDaemon
    state.briefingCache = { computedAt: new Date().toISOString(), data: snapshot.briefing };
  }
  sendJson(socket, { type: "briefing", ...state.briefingCache });
  break;
}
```

E no watcher de arquivos (onde hoje só se chama `checkAndArchiveDonePlans` /
`auditHealth`), invalidar o cache quando o watch disparar:

```typescript
// dentro do handler de chokidar em daemon.ts, ao lado do que já existe:
state.briefingCache = null;
state.riskMapCache = null;
```

**Observação honesta:** isso exige passar `projectRoot` para `runDaemon`/`handleMessage`, que
hoje só recebe `shitenDir`. É uma mudança de assinatura pequena, mas toca em vários pontos —
vale fazer em um commit isolado antes da Fase 2, com teste próprio (o projeto já tem
`daemon-client.test.ts` e `daemon-circuit-breaker.test.ts`, então o padrão de teste existe).

---

## 5. Fase 2 — MCP handlers consultam o daemon primeiro, disco depois

**Arquivo: `src/mcp-server-handlers.ts`.** Hoje `handleGetBriefing` chama `collectContext`
direto. Novo padrão — "daemon-first, disk-fallback":

```typescript
// src/mcp-server-handlers.ts

import { queryDaemon, isDaemonRunning } from "./daemon-client.js";

export async function handleGetBriefing(
  projectRoot: string,
  shitenDir: string,
  args: Record<string, unknown>
): Promise<ToolResponse> {
  const format = (args.format as string) ?? "json";
  const depth = (args.depth as string) ?? "standard";

  let briefing: Briefing;

  if (isDaemonRunning(shitenDir)) {
    const result = await queryDaemon<{ type: string; data: Briefing }>(shitenDir, {
      type: "query_briefing",
    });
    briefing = result?.data ?? collectContext(projectRoot, shitenDir).briefing;
  } else {
    briefing = collectContext(projectRoot, shitenDir).briefing;
  }

  // ...resto da função permanece igual (formatação json/markdown/summary)
}
```

Isso precisa que `handleGetBriefing` (e os outros 6 handlers) passem a ser `async` — hoje são
síncronos. `mcp-server.ts` já faz `await` implicitamente no `switch` do `CallToolRequestSchema`?
Não — hoje retorna direto (`return handleGetBriefing(...)`). Como o handler do SDK MCP já
suporta `Promise<ToolResponse>` (é assim que `submitFeedback` provavelmente funcionaria também
se fizesse I/O assíncrono), basta adicionar `async`/`await` nas 7 funções e no `switch` de
`mcp-server.ts` — mudança mecânica, mas em 8 arquivos/funções, não 1.

**Por que vale a pena:** uma sessão de agente de IA chama `getBriefing`, `getRiskMap`,
`getEngineeringState` repetidamente ao longo de uma sessão longa. Hoje cada chamada recalcula
do zero. Com o daemon como cache vivo, a primeira chamada de qualquer processo (CLI ou MCP)
aquece o cache para todos os outros.

---

## 6. Fase 3 — CLI também consulta o daemon (não só `shiten daemon status`)

**Arquivo: `src/commands/status.ts` / `src/commands/briefing.ts` (não lidos em detalhe, mas
seguem o mesmo padrão de `mcp-server-handlers.ts` — chamam `collectContext`/`generateRiskMap`
direto).** Mesmo padrão da Fase 2 se aplica: tentar `queryDaemon`, fallback para o cálculo
atual. Isso é reaproveitamento puro do trabalho da Fase 1 — nenhuma lógica nova, só troca do
ponto de entrada.

Dado o volume (40 comandos), **não vale a pena aplicar em todos de uma vez.** Sugiro priorizar
pelos que já são chamados com frequência dentro de uma sessão de agente: `status`, `briefing`,
`context`, `digest`. Os demais (comandos de configuração, `init`, `policy`) não se beneficiam —
rodam uma vez, não precisam de cache.

---

## 7. Fase 4 — Consequência para a identidade (não é o passo 1, é o resultado)

Depois das Fases 0–3, a frase correta para descrever o projeto deixa de ser
*"CLI de governança"* e passa a ser algo como: **"um daemon de governança de engenharia com
CLI e MCP como duas portas de entrada para o mesmo estado vivo."** Isso é uma mudança de
posicionamento real, sustentada por arquitetura, não só por marketing — e é só neste ponto que
faz sentido revisitar nome/tagline, porque só aí você sabe o que está nomeando.

Não escolho um nome novo agora — seria inventar identidade antes da arquitetura estar pronta,
exatamente o erro que você já identificou. Quando as Fases 0–3 estiverem no código, me chame
de novo para essa parte.

---

## 8. O que **não** fazer

- Não tornar o daemon obrigatório. `shouldSkipDaemon()` (`SHITEN_NO_DAEMON=1`, `CI=true`) e o
  fallback síncrono precisam continuar funcionando sempre — é o princípio já documentado no
  próprio código, e violá-lo quebra CI e uso não-interativo.
- Não mover `checkAndArchiveDonePlans` / `auditHealth` para dentro dos handlers MCP achando
  que "já que estamos integrando, integra tudo". Escopo desse plano é leitura de estado
  (queries), não side-effects — misturar os dois aumenta risco sem necessidade.
- Não versionar o cache do daemon em disco por enquanto. Ele já é efêmero por design
  (`KNOWN_LIMITATIONS.md` documenta isso para eventos) — manter em memória é consistente com o
  resto do sistema e evita problema novo de sincronização disco↔memória.

---

## 9. Ordem sugerida e esforço

| Fase | O que entrega | Esforço relativo | Depende de |
|------|----------------|-------------------|------------|
| 0 | `queryDaemon()` genérico em `daemon-client.ts` | Baixo (1 arquivo) | — |
| 1 | Cache de briefing/riskmap no daemon + invalidação por watch | Médio (assinatura de `runDaemon` muda) | Fase 0 |
| 2 | MCP handlers async, daemon-first | Médio (8 funções + `mcp-server.ts`) | Fase 0, 1 |
| 3 | CLI (status/briefing/context/digest) daemon-first | Baixo-médio, repetitivo | Fase 0, 1 |
| 4 | Revisão de identidade/nome | — | 0–3 concluídas |

Cada fase é committável e testável isoladamente — nenhuma quebra as anteriores, e o fallback
para disco garante que o sistema nunca fica pior do que está hoje, só mais rápido/coerente
quando o daemon está de pé.
