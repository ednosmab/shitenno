# PLAN-2026-07-25-mcp-adaptive-assistant — MCP como Assistente Adaptativo

**Status:** Pending
**Date:** 2026-07-25
**Updated_at:** 2026-07-25T10:00:00.000Z
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 12h

---

## Contexto

O MCP Server do shitenno funciona como um dashboard de leitura: devolve estado (risks, rules, skills, backlog) mas não guia o LLM sobre o que fazer com esse estado. O utilizador precisa de 4-6 chamadas de tools para ter contexto completo para iniciar uma sessão.

Além disso, o MCP devolve os mesmos dados independentemente do perfil do utilizador (senior vs pleno) e não aprende com interacções anteriores.

A visão do projecto é apresentar caminhos ao utilizador e crescer com as suas respostas. O MCP é a ponte entre esse conhecimento e o LLM — precisa de ser adaptativo, não estático.

### Ficheiros afectados

| Ficheiro | Impacto |
|---|---|
| `src/mcp-server.ts` | Nova tool `getContext`, dispatch |
| `src/mcp-server-handlers.ts` | Novos handlers, refactor `handleGetBriefing` |
| `src/briefing.ts` | Campo `suggestedActions`, `contextVersion` |
| `src/context-collector.ts` | Integração com user profile |
| `src/backlog-mcp-tools.ts` | `getBacklog` com filtro de sessão |
| `src/session-feedback.ts` | Leitura de padrões de uso |
| `src/mcp-types.ts` | Novos tipos |
| `src/__tests__/mcp-server.test.ts` | Testes novos handlers |
| `src/__tests__/mcp-server-dispatch.test.ts` | Teste nova tool |

## Objetivo

Transformar o MCP de "dashboard de leitura" para "assistente adaptativo" que:
1. Devolve estado + accão recomendada numa só chamada
2. Adapta output ao perfil do utilizador
3. Aprende com interacções anteriores
4. Detecta mudanças de contexto entre chamadas

### Critérios de aceitação

1. Nova tool `getContext` devolve briefing + skills mandatory + regras obrigatórias + próximo P0 numa única chamada
2. `getBriefing` inclui campo `suggestedActions` com tool calls sugeridos e respectivo `reason`
3. `getBriefing` inclui campo `contextVersion` que muda quando o estado do projecto muda
4. `getBacklog` com `sessionFocus: true` devolve apenas items relevantes (P0 + em progresso + impedimentos)
5. Padrões de uso são registados e consultados para refinar sugestões
6. Todos os testes existentes continuam a passar (`pnpm run test`)
7. Lint limpo (`pnpm run lint`)

---

## Fase 1: suggestedActions no Briefing (3h)

### Passo 1: Estender tipo Briefing com suggestedActions

**Ficheiro:** `src/briefing.ts`
**Acção:** Adicionar campo `suggestedActions` ao tipo `Briefing`:
```typescript
suggestedActions?: Array<{
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  confidence: number; // 0-1
}>;
```
**Verificação:** `pnpm run typecheck` passa

### Passo 2: Gerar suggestedActions baseado no estado

**Ficheiro:** `src/briefing.ts`
**Acção:** Criar função `generateSuggestedActions(briefing)` que:
- Se `risks.criticalAreas.length > 0` → sugerir `getSkills(task=security)`
- Se `risks.highAreas.length > 0` → sugerir `getRules(type=context)`
- Se `quickBoard.nextP0` != "Definir" → sugerir `getBacklog(priority=P0)`
- Se `patterns.recurringErrors.length > 0` → sugerir `getRules(type=dynamic)`
- Se `tests.areasWithoutTests.length > 0` → sugerir `getSkills(task=implementation)`
- Confidence baseada na severidade (critical=0.95, high=0.8, medium=0.6)
**Verificação:** Teste unitário confirma que high risk gera suggestedAction correcto

### Passo 3: Integrar no generateBriefing

**Ficheiro:** `src/briefing.ts`
**Acção:** Chamar `generateSuggestedActions` no final de `generateBriefing` e incluir no resultado
**Verificação:** Briefing JSON tem campo `suggestedActions` com pelo menos 1 item quando há risks

### Passo 4: Testes

**Ficheiro:** `src/__tests__/mcp-server.test.ts`
**Acção:** Adicionar testes:
- `getBriefing` com high risk devolve `suggestedActions` com `getSkills`
- `getBriefing` sem risks devolve `suggestedActions` vazio ou só `getBacklog`
- `getBriefing` com `depth: "minimal"` exclui `suggestedActions`
**Verificação:** `pnpm run test` passa

---

## Fase 2: Nova tool `getContext` (3h)

### Passo 5: Definir tool no TOOLS array

**Ficheiro:** `src/mcp-server.ts`
**Acção:** Adicionar tool `getContext` ao array `TOOLS`:
```typescript
{
  name: "getContext",
  description: "Complete session context: briefing + mandatory skills + rules + next P0. Single call to start working.",
  inputSchema: {
    type: "object",
    properties: {
      task: { type: "string", description: "Task type for skill resolution" },
      depth: { type: "string", enum: ["minimal", "standard"], description: "Output detail level" },
    },
  },
}
```
**Verificação:** `TOOLS` tem 14 items

### Passo 6: Implementar handler

**Ficheiro:** `src/mcp-server-handlers.ts`
**Acção:** Criar `handleGetContext` que:
1. Chama `collectContext` (ou query daemon)
2. Resolve mandatory skills para o `task` fornecido
3. Carrega regras obrigatórias do manifest
4. Lê próximo P0 do backlog
5. Devolve tudo num JSON unificado:
```json
{
  "briefing": { ... },
  "mandatorySkills": [ ... ],
  "mandatoryRules": [ ... ],
  "nextP0": "string",
  "suggestedActions": [ ... ]
}
```
**Verificação:** Handler devolve ToolResponse com todos os campos

### Passo 7: Dispatch e testes

**Ficheiro:** `src/mcp-server.ts`
**Acção:** Adicionar case `"getContext"` ao dispatch switch
**Ficheiro:** `src/__tests__/mcp-server-dispatch.test.ts`
**Acção:** Teste de routing para `getContext`
**Verificação:** `pnpm run test` passa

---

## Fase 3: contextVersion + diff (2h)

### Passo 8: Gerar contextVersion

**Ficheiro:** `src/briefing.ts`
**Acção:** Adicionar campo `contextVersion` ao tipo `Briefing`:
```typescript
contextVersion: string; // hash do estado actual
```
Gerar hash a partir de: git HEAD + riskMap.generatedAt + contextRules.length + quickBoard.nextP0
**Verificação:** Dois briefings com mesmo estado têm mesmo `contextVersion`

### Passo 9: Parâmetro `since` no getBriefing

**Ficheiro:** `src/mcp-server-handlers.ts`
**Acção:** Em `handleGetBriefing`:
- Se `args.since` é fornecido e `briefing.contextVersion == args.since` → devolver `{ changed: false }`
- Se mudou → devolver briefing completo com `changed: true`
**Verificação:** Teste: mesma versão → `changed: false`, versão diferente → `changed: true`

---

## Fase 4: getBacklog adaptativo + padrões de uso (4h)

### Passo 10: getBacklog com sessionFocus

**Ficheiro:** `src/backlog-mcp-tools.ts`
**Acção:** Adicionar parâmetro `sessionFocus: boolean` ao `handleGetBacklog`:
- `sessionFocus: true` → filtrar: P0 items + items em progresso + impedimentos
- `sessionFocus: false` (default) → comportamento actual
**Verificação:** `getBacklog(sessionFocus: true)` devolve ≤10 items

### Passo 11: Registo de padrões de uso

**Ficheiro:** `src/session-feedback.ts`
**Acção:** Criar `recordToolUsage(shitennoDir, toolName, args)` que append a `telemetry/tool-usage-YYYY-MM-DD.jsonl`:
```json
{"tool":"getSkills","args":{"task":"security"},"timestamp":"...","session":"..."}
```
**Verificação:** Ficheiro JSONL é criado com o registo

### Passo 12: Consulta de padrões

**Ficheiro:** `src/session-feedback.ts`
**Acção:** Criar `getToolUsagePatterns(shitennoDir, days?: number)` que:
- Lê JSONL dos últimos N dias (default 7)
- Conta frequência de tools chamadas
- Identifica tools mais usadas e args mais comuns
- Devolve `Record<string, { count: number, topArgs: Record<string, string> }>`
**Verificação:** Função devolve dados correctos com fixture JSONL

### Passo 13: Integrar padrões no suggestedActions

**Ficheiro:** `src/briefing.ts`
**Acção:** Em `generateSuggestedActions`:
- Se o utilizador frequentemente pede `getSkills(task=security)` → aumentar confidence
- Se o utilizador nunca usa uma tool sugerida → diminuir confidence ou remover
- Adicionar campo `userPattern` ao `suggestedActions`:
```json
"userPattern": "You typically fix risks before adding features"
```
**Verificação:** Teste com fixture de usage history refina sugestões

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | `getContext` como tool separada em vez de modificar `getBriefing` | Fundir tudo no getBriefing | Manter backwards compatibility. getBriefing já tem many consumers |
| 2 | `suggestedActions` como campo opcional no Briefing | Tool nova `getSuggestedActions` | Evitar roundtrip extra. O briefing já tem a informação necessária |
| 3 | Padrões de uso em JSONL em vez de DB | SQLite | Manter simplicidade. JSONL é legível, append-only, sem dependências |
| 4 | `contextVersion` como hash composto | Counter incremental | Determinístico — mesmo estado = mesmo hash, sem statefulness |
| 5 | `sessionFocus` como filtro no getBacklog | Tool nova `getBacklogFocus` | Mesmo handler, menos tools para manter |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | suggestedActions podem ficar desactualizados se o briefing muda | Médio | suggestedActions são geradas em runtime, não cacheadas |
| 2 | getBacklog(sessionFocus) pode esconder items importantes | Médio | Incluir sempre P0 + em progresso. sessionFocus=false é o default |
| 3 | Padrões de uso podem ter dados sensíveis nos args | Baixo | Só registar tool name + args keys (não values) |
| 4 | contextVersion pode causar false negatives se hash é instável | Baixo | Usar campos determinísticos (git HEAD, timestamps) |
| 5 | getContext pode ser mais lento que chamadas individuais | Baixo | Usa o mesmo collectContext cache que tools individuais |
