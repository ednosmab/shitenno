# Auditoria Ponta a Ponta — Shitenno

**Data:** 29 de Julho de 2026
**Auditor:** Buffy (Freebuff)
**Branch:** feat/refactor
**Escopo:** Execução completa do sistema (build, typecheck, lint, testes, análise de código)

---

## Estado Geral

| Métrica | Status |
|---------|--------|
| **Build** | ✅ Sucesso (9.3MB + 8.5MB — bundles muito grandes) |
| **Typecheck** | ✅ 0 erros |
| **Lint** | ✅ 0 warnings |
| **Testes** | ✅ 2352 passando, 0 falhando |
| **Circular deps** | ✅ Nenhuma (madge) |
| **Arquivos TS** | 696 |
| **Linhas** | ~76.380 |

---

## 🐛 Bugs Encontrados

### Bug 1: `mcp-cache.ts` — Métricas de cache falsas (GRAVE)

**Arquivo:** `src/mcp-cache.ts` (linhas ~112)
**Problema:** `getCacheStats()` retorna zeros hardcoded, ignorando os contadores reais de `cache-metrics.ts`.

```typescript
// RETORNA SEMPRE ZEROS:
export function getCacheStats() {
  return {
    size: cacheStore.size,
    hitRate: 0,    // ← hardcoded
    totalHits: 0,  // ← hardcoded
    totalMisses: 0 // ← hardcoded
  };
}
```

Os contadores `recordHit`/`recordMiss` de `cache-metrics.ts` existem e são chamados em `withCache()`, mas `getCacheStats()` em `mcp-cache.ts` **não os utiliza**. Qualquer dashboard de performance mostrará dados incorretos.

**Impacto:** Métricas de performance são enganosas. Dados de cache parecem sempre zerados.

**Correção:** Utilizar `getCacheStats("mcp-cache")` de `cache-metrics.ts` dentro de `getCacheStats()` de `mcp-cache.ts`.

---

### Bug 2: `session-bootstrapper.ts` — Glob pattern ignorado silenciosamente

**Arquivo:** `src/session-bootstrapper.ts` (linhas ~84-88)
**Problema:** O padrão glob para `agent-contracts` (`governance/agents/*.yaml`) é ignorado silenciosamente.

```typescript
if (relativePath.includes("*")) {
  // For now, skip glob patterns - would need proper implementation
  continue;
}
```

A entrada `agent-contracts` em `OPTIONAL_FILES` usa `governance/agents/*.yaml`, mas o glob é ignorado. Se alguém configurar contratos de agentes, eles nunca serão carregados.

**Impacto:** Funcionalidade de carregamento de contratos de agentes está quebrada silenciosamente.

---

### Bug 3: `cli-middleware.ts` — Daemon falha silenciosamente

**Arquivo:** `src/cli-middleware.ts` (linha 116)
**Problema:** Catch vazio mascara erros reais do daemon.

```typescript
startDaemon(shitennoDir).catch(() => {});
```

Se o daemon falhar ao iniciar, o usuário nunca recebe feedback. O catch vazio mascara erros reais.

**Impacto:** Falhas de inicialização do daemon são invisíveis ao usuário.

---

### Bug 4: `mcp-handlers/context.ts` — Handlers inconsistentes de erro

**Arquivo:** `src/mcp-handlers/context.ts`
**Problema:** Três handlers fazem `throw new Error(...)` diretamente, enquanto outros retornam `ToolResponse` com erro.

- `handleGetEngineeringState` — throw (dentro de `withCache`)
- `handleGetPlans` — throw diretamente (linha ~88)
- `handleSubmitFeedback` — throw (linhas ~107, ~112)

Enquanto isso:
- `handleGetRiskMap` — retorna `ToolResponse` com erro
- `handleGetAuditReport` — retorna `ToolResponse` com erro

**Impacto:** Duas cadeias de tratamento de erro diferentes no `dispatchTool()`. As mensagens de erro passam por uma camada extra de captura e perdem estrutura. A experiência do usuário é inconsistente.

---

### Bug 5: `mcp-handlers/briefing.ts` — Busca redundante em `handleGetRules`

**Arquivo:** `src/mcp-handlers/briefing.ts` (linhas ~130-141)
**Problema:** `fetchContextRules()` verifica `isDaemonRunning()`, mas mesmo quando o daemon retorna dados, re-executa `collectContext()` para obter `contextRules`.

```typescript
if (isDaemonRunning(shitennoDir)) {
  const briefingResult = await queryDaemon(shitennoDir, { type: "query_briefing" });
  if (briefingResult?.data) {
    snapshot = briefingResult.data;  // ← dados do daemon
  } else {
    snapshot = collectContext(projectRoot, shitennoDir);
  }
} else {
  snapshot = collectContext(projectRoot, shitennoDir);
}
return (snapshot.contextRules ?? []).map(...)  // ← sempre usa snapshot
```

O resultado da consulta ao daemon é parcialmente ignorado — o briefing é usado, mas `contextRules` pode não estar presente no objeto retornado pelo daemon, forçando recomputação.

**Impacto:** Processamento desnecessário quando o daemon está rodando.

---

## ⚡ Melhorias de Performance

### Melhoria 1: Bundles gigantes (9.3MB + 8.5MB)

O `tsup` gera dois bundles enormes. Não há code-splitting. Toda a CLI e o daemon são embalados em arquivos únicos.

**Impacto:** Downloads lentos, inicialização demorada, uso de memória desnecessário.

**Sugestão:** Implementar code-splitting ou lazy loading dos módulos menos usados.

---

### Melhoria 2: `analyser.ts` — Cache global sem invalidação por TTL

`readPackageJson()` usa variáveis globais `cachedPkgRoot`/`cachedPkg`. Se `analyseProject()` for chamado com roots diferentes (ex: daemon + CLI no mesmo processo), o cache pode servir dados errados. Não há invalidação por TTL.

```typescript
let cachedPkgRoot: string | null = null;
let cachedPkg: { ... } | null = null;
```

**Sugestão:** Adicionar TTL ao cache ou usar um Map com timestamps.

---

### Melhoria 3: `knowledge-loader.ts` — Leitura completa para listagens

`listAdrs()` e `listSkills()` lêm o conteúdo completo de cada ficheiro para extrair apenas título e status. Para listagens, bastaria ler as primeiras linhas (frontmatter).

**Impacto:** Leitura desnecessária de ~50+ ficheiros quando apenas metadados são necessários.

---

### Melhoria 4: `cache.ts` — `dirChecksum` sem cache de estrutura

`dirChecksum()` percorre todo o directório `.shitenno/` recursivamente a cada chamada. O `mtimeCache` ajuda para ficheiros individuais, mas não para a estrutura de directórios (ficheiros adicionados/removidos).

**Sugestão:** Cache de entrada de directório com mtime do directório.

---

### Melhoria 5: `risk-map.ts` — `execSync` do git sem cache entre invocações

`getChurnData()` executa um comando git complexo. Embora seja chamada uma vez por `generateRiskMap()`, não há cache entre chamadas separadas (ex: daemon + CLI).

**Sugestão:** Cache de resultado do git com TTL de 5 minutos.

---

## 🏗️ Arquitetura

### 57 ocorrências de `as unknown as`

O próprio sistema de auditoria (`audit/quality/correctness.ts`) sinaliza esse padrão como problema, mas o codebase contém 57 ocorrências.

**Principais localizações:**
- `src/commands/*.ts` — operações JSON output (~30 ocorrências)
- `src/daemon/*.ts` — recursos e socket
- `src/mcp-server.ts` — casts no return do handler
- `src/engineering-state/evolved/consolidator.ts` — cast de dimensões

**Sugestão:** Usar type guards ou generics adequados. Meta: < 20 ocorrências.

---

### `policy-engine.ts` deprecated mas ainda exportado

```typescript
/** @deprecated Use ./rule-engine/policy.js */
export * from "./rule-engine/policy.js";
```

Deveria ser removido para reduzir a superfície de API e evitar confusão.

---

### `isConsolidating` flag global sem lock

`engineering-state.ts` usa uma flag boolean `isConsolidating` para evitar re-entrância. Em cenários multi-processo (daemon + CLI), isso não protege — apenas evita re-entrância no mesmo processo.

**Sugestão:** Usar lock de arquivo ou mutex para proteção cross-processo.

---

### 4 sistemas de cache sem invalidação unificada

| Cache | TTL | Invalidação | Métricas |
|-------|-----|-------------|----------|
| `mcp-cache.ts` | 60s | TTL + hash | ❌ Falsas |
| `inference-cache.ts` | 30s | TTL + mtime | ❌ Não integrado |
| `briefing-cache.ts` | env var | Hash de input | ❌ Não integrado |
| `cache.ts` | N/A | Checksums | ❌ Não integrado |

**Sugestão:** Unificar em um único módulo de cache com métricas compartilhadas via `cache-metrics.ts`.

---

## ✅ O Que Funciona Bem

| Área | Status | Detalhes |
|------|--------|----------|
| **Testes** | ✅ Sólido | 2352 testes, cobertura abrangente, incluindo concorrência cross-process |
| **Build** | ✅ Limpo | `pnpm build` sem erros, `pnpm lint` sem warnings |
| **MCP Server** | ✅ Funcional | 17 ferramentas, dispatch limpo, handlers organizados em subdiretórios |
| **Circular deps** | ✅ Nenhuma | madge reportou zero |
| **Deduplicação** | ✅ Implementada | Notificações com cooldown de 5s |
| **Lazy loading** | ✅ Implementado | `session-bootstrapper.ts` com carregamento sob demanda |
| **Cache de briefings** | ✅ Bem implementado | Hash de invalidação + TTL configurável |
| **TypeScript** | ✅ Zero erros | `tsc --noEmit` passa sem problemas |
| **ESLint** | ✅ Zero warnings | `pnpm lint` limpo |

---

## 📋 Resumo de Prioridades

| Prioridade | Item | Impacto | Esforço |
|-----------|------|---------|---------|
| **P0** | Corrigir `getCacheStats()` em `mcp-cache.ts` | Métricas falsas afetam decisões | Baixo |
| **P0** | Padronizar handlers MCP (throw vs ToolResponse) | Consistência de erro | Médio |
| **P1** | Implementar glob em `session-bootstrapper.ts` | Funcionalidade quebrada | Médio |
| **P1** | Adicionar feedback ao `startDaemon().catch()` | Visibilidade de erros | Baixo |
| **P2** | Reduzir `as unknown as` (meta: <20) | Type safety | Alto |
| **P2** | Unificar métricas de cache | Observabilidade | Médio |
| **P3** | Code-splitting nos bundles | Reduzir tamanho | Alto |
| **P3** | Remover `policy-engine.ts` deprecated | Limpeza de API | Baixo |

---

*Relatório gerado em 29/07/2026 por Buffy (Freebuff)*
