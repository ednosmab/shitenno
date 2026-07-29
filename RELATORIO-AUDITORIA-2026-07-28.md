# Relatório de Auditoria — Projeto Shitenno

**Data:** 28 de Julho de 2026  
**Auditor:** Buffy (Freebuff)  
**Versão:** 1.2.0  
**Branch:** feat/refactor  

---

## Resumo Executivo

Auditoria ponta a ponta do projeto Shitenno, incluindo análise de código, testes, build, MCP, engines e arquitetura. Este relatório foca em honestidade: o que funciona, o que está quebrado, e o que precisa mudar.

**Veredicto:** O projeto tem uma base técnica sólida (testes, build, lint), mas sofre de sobre-engenharia significativa. A complexidade atual não é proporcional ao valor entregue ao usuário final.

---

## 1. Estado do Projeto — Números

| Métrica | Valor |
|---------|-------|
| Arquivos TypeScript | 694 |
| Linhas de código | ~97.500 |
| Testes | 2.291 passando, 0 falhando |
| Erros de TypeScript | 12 (em 5 arquivos de teste não rastreados) |
| Warnings de Lint | 0 |
| Build | ✅ Sucesso |
| Servidor MCP | ✅ 17 ferramentas listadas |
| Arquivos > 300 linhas | 23 (após 6 fases de refatoração) |
| Ocorrências `as unknown as` | 57 |

---

## 2. O Que Funciona Bem

### 2.1 Testes — ✅ Sólido
- 2.291 testes passando sem falhas
- Cobertura abrangente: engines, handlers MCP, backlog, pipelines reativos, detectores de segurança, edge cases
- Testes de concorrência cross-process para verification-lock
- Essa é a parte mais forte do projeto

### 2.2 Servidor MCP — ✅ Funcional
- 17 ferramentas listadas e chamáveis
- Despacho de ferramentas limpo via `dispatchTool()`
- Separação em subdiretórios `mcp-handlers/` (briefing, context, audit, knowledge)
- Comunicação com daemon via socket funciona

### 2.3 Build e Lint — ✅ Limpos
- `pnpm build` executa com sucesso (ESM + DTS)
- `pnpm lint` produz zero warnings
- Husky hooks configurados (pre-commit, commit-msg)

### 2.4 Arquitetura de Handlers MCP — ✅ Boa Decisão
- Handlers separados em `src/mcp-handlers/{briefing,context,audit,knowledge}.ts`
- Barrel file `mcp-server-handlers.ts` para re-exportação
- Tipos compartilhados em `mcp-types.ts`

---

## 3. Bugs Reais Encontrados

### 3.1 🔴 Cache com Métricas Falsas
**Arquivo:** `src/mcp-cache.ts` (linhas 72-78)  
**Problema:** `getCacheStats()` retorna zeros hardcoded para `hitRate`, `totalHits` e `totalMisses`. O cache nunca rastreia hits ou misses.

```typescript
// RETORNA SEMPRE ZEROS:
export function getCacheStats() {
  return { size: cacheStore.size, hitRate: 0, totalHits: 0, totalMisses: 0 };
}
```

**Impacto:** Métricas de performance são enganosas. Qualquer dashboard ou relatório que use esses dados vai mostrar zeros.  
**Mesmo problema:** `src/inference-cache.ts`

**Correção necessária:** Implementar contadores reais de hits/misses, ou remover `getCacheStats` completamente.

---

### 3.2 🔴 Glob Pattern Não Implementado
**Arquivo:** `src/session-bootstrapper.ts` (linhas 84-88)  
**Problema:** O padrão glob para `agent-contracts` (`governance/agents/*.yaml`) é ignorado silenciosamente.

```typescript
if (relativePath.includes("*")) {
  // For now, skip glob patterns - would need proper implementation
  continue;
}
```

**Impacto:** A entrada `agent-contracts` em `OPTIONAL_FILES` nunca carrega nada. Se alguém configurar contratos de agentes, eles serão ignorados.

---

### 3.3 🔴 5 Arquivos de Teste com Erros de TypeScript
**Problema:** 5 arquivos não rastreados têm erros que quebrariam o CI se commitados.

| Arquivo | Erro |
|---------|------|
| `cache-metrics.test.ts` | Imports não usados (`vi`, `afterEach`) |
| `inference-cache.test.ts` | Tipo errado para `computeFn` (passa `PlanInference` onde `InferenceSummary` é esperado) |
| `mcp-cache.test.ts` | Imports não usados (`vi`, `afterEach`) |
| `notify.test.ts` | Imports não usados + acesso possivelmente undefined |
| `session-bootstrapper.test.ts` | Imports não usados (`vi`, `existsSync`) |

**Impacto:** O script `pretest` roda `tsc --noEmit`. Se esses arquivos forem adicionados ao git, o CI vai falhar.

---

### 3.4 🟡 Handlers MCP Lançam Exceções Inconsistently
**Arquivo:** `src/mcp-handlers/context.ts`  
**Problema:** Três handlers fazem `throw new Error(...)` diretamente, enquanto outros retornam `ToolResponse` com erro.

- `handleGetEngineeringState` — throws (linha 70)
- `handleGetPlans` — throws (linha 88)
- `handleSubmitFeedback` — throws (linhas 107, 112)

Enquanto isso:
- `handleGetAuditReport` — retorna `ToolResponse` com erro
- `handleGetRiskMap` — retorna `ToolResponse` com erro

**Impacto:** As mensagens de erro passam por uma camada extra de captura em `mcp-server.ts` e perdem estrutura. A experiência do usuário é inconsistente.

---

### 3.5 🟡 `handleGetRules` Busca Contexto Duas Vezes
**Arquivo:** `src/mcp-handlers/briefing.ts` (linhas 130-141)  
**Problema:** `fetchContextRules()` verifica `isDaemonRunning()`, mas mesmo quando o daemon retorna dados, re-executa `collectContext()` para obter `contextRules`. O resultado da consulta ao daemon é parcialmente ignorado.

**Impacto:** Processamento desnecessário quando o daemon está rodando.

---

### 3.6 🟡 Engolimento Silencioso de Erros em Camadas Críticas

| Local | Código | Impacto |
|-------|--------|---------|
| `cli-middleware.ts:116` | `startDaemon(shitennoDir).catch(() => {})` | Daemon falha sem feedback ao usuário |
| `capability-engine.ts:53-55` | `.catch(() => { // skip })` | Falha na consolidação de estado silenciada |
| `mcp-handlers/context.ts:210` | `catch { /* ignore parse errors */ }` | Erros de parse de manifest ignorados |
| `session-bootstrapper.ts:56` | `catch (err) { logger.debug(...) }` | Falha de carregamento de arquivo apenas em debug |

**Impacto:** Quando algo falha silenciosamente, o usuário não recebe feedback sobre por que funcionalidades não estão funcionando.

---

## 4. Preocupações Arquiteturais

### 4.1 Sobre-Engenharia
O projeto inclui:
- CLI com 38 comandos
- Servidor MCP com 17 ferramentas
- Daemon em background com comunicação via socket
- TUI usando React/Ink
- 7+ engines (regra, ação, capacidade, inferência, feedback, proativo, performance)
- Detecção de padrões, rastreamento de dívida de conhecimento, perfil de maturidade
- Sistema de plugins, event bus, pipeline reativo
- Múltiplas camadas de cache (4 sistemas separados)
- Auditor de saúde com 30+ detectores

**A proposta de valor central** — pontuar um projeto, detectar padrões, gerar briefings para agentes de IA — poderia ser entregue com muito menos código.

### 4.2 Tipos Fracos — 57 Ocorrências de `as unknown as`
Cada ocorrência é um local onde as garantias do TypeScript são ignoradas. O próprio sistema de auditoria do projeto sinaliza esse padrão (`audit/quality/correctness.ts` linha 14), mas o codebase contém dezenas de ocorrências.

**Principais localizações:**
- `src/commands/*.ts` — operações JSON output
- `src/daemon/*.ts` — recursos e socket
- `src/mcp-server.ts` — casts no return do handler
- `src/engineering-state/evolved/consolidator.ts` — cast de dimensões

### 4.3 Sobreposição de Cache
4 sistemas de cache separados sem invalidação unificada ou métricas compartilhadas:
- `mcp-cache.ts` — respostas MCP
- `inference-cache.ts` — resultados de inferência
- `briefing-cache.ts` — briefings
- `console-data-cache.ts` — dados do console

### 4.4 Barrel Files com Acoplamento Excessivo
`performance-reporter.ts` re-exporta 20+ símbolos de submódulos. Se qualquer submódilo mudar, todo consumidor precisa de recompilação.

### 4.5 Arquivos Grandes Persistem
Após 6 fases de refatoração, 23 arquivos ainda ultrapassam 300 linhas. Os piores são arquivos de teste (1409, 983, 927 linhas), mas há código de produção significativo.

---

## 5. Análise do MCP

### Pontos Fortes
- 17 ferramentas bem definidas com schemas de entrada claros
- Formatos de saída flexíveis (json, markdown, summary)
- Integração com daemon para queries rápidas
- Cache de briefings com hash de invalidação

### Problemas
- **Handlers inconsistentes** — uns lançam exceções, outros retornam erro estruturado
- **Métricas de cache falsas** — `getCacheStats()` retorna zeros
- **Busca redundante** — `handleGetRules` busca contexto duas vezes
- **Sem rate limiting** — nenhum controle de throughput nas ferramentas
- **Sem validação de argumentos** — a maioria dos handlers faz `args.foo as string` sem validação

### Recomendações MCP
1. Padronizar todos os handlers para retornar `ToolResponse`, nunca throw
2. Implementar métricas reais de cache ou remover a API
3. Adicionar validação de entrada usando um schema (Zod ou similar)
4. Implementar rate limiting básico

---

## 6. Análise das Engines

| Engine | Status | Observação |
|--------|--------|------------|
| `inference-engine.ts` | ✅ Funcional | Análise de planos bem estruturada |
| `rule-engine.ts` | ✅ Funcional | Boa separação em submódulos |
| `action-engine.ts` | ✅ Funcional | Idempotência bem implementada |
| `capability-engine.ts` | ⚠️ Parcial | `initializeCapabilityEngine` engole erros |
| `feedback-engine.ts` | ✅ Funcional | Perfis de usuário bem modelados |
| `performance-reporter.ts` | ⚠️ Barrel | Muita re-exportação, pouca lógica própria |
| `doc-engine.ts` | ✅ Funcional | Geração de documentação |
| `policy-engine.ts` | ❌ Deprecado | Marcado como deprecated, deve ser removido |

---

## 7. Prioridades de Correção

### P0 — Quebra CI (corrigir imediatamente)
1. Corrigir os 5 arquivos de teste com erros de TypeScript
2. Implementar métricas reais de cache ou remover `getCacheStats`

### P1 — Bugs Funcionais (corrigir esta semana)
3. Implementar glob pattern no `session-bootstrapper` ou remover a entrada
4. Padronizar tratamento de erros nos handlers MCP
5. Corrigir busca redundante em `handleGetRules`

### P2 — Qualidade (próximas semanas)
6. Reduzir ocorrências de `as unknown as` (meta: < 20)
7. Unificar sistemas de cache
8. Remover `policy-engine.ts` deprecado
9. Reduzir arquivos > 300 linhas (meta: < 10)

### P3 — Arquitetura (próximos meses)
10. Avaliar escopo: o que realmente precisa de daemon, TUI, plugin system?
11. Considerar remoção de engines que não agregam valor ao usuário
12. Simplificar a cadeia de dependências (97K linhas é muito para o valor entregue)

---

## 8. Conclusão

O Shitenno tem uma base técnica impressionante: testes sólidos, build limpo, MCP funcional. Mas a complexidade atual é desproporcional ao valor entregue. O projeto acumulou camadas de abstração (daemon, TUI, plugins, 7 engines, 4 caches, event bus) que adicionam superfície sem proporcional benefício ao usuário.

**O caminho para um produto público sustentável é cortar escopo, não adicionar engines.**

A prioridade imediata é corrigir os bugs que quebram CI e padronizar o tratamento de erros. A prioridade estratégica é questionar: de tudo que existe, o que o usuário realmente usa?

---

*Relatório gerado automaticamente em 28/07/2026*
