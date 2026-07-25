# PLAN-2026-07-25-auto-fix-done-gate — Auto-fix controlado no gate de "done"

**Status:** Done
**Date:** 2026-07-25
**Updated_at:** 2026-07-25T04:18:12.481Z
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 2h

---

## Contexto

Quando um plano é marcado como "checked", o daemon executa `runAutoVerification()` que corre 5 checks: build, tests, lint, gate_self_test, e documentation (sync-docs.ts --quiet). Se o check de DOCS falha, o plano é imediatamente marcado como "refused" — forçando o utilizador a:

1. Correr manualmente `npm run sync:docs:fix`
2. Re-marcar o status como "checked"

Este fluxo é correcto (o gate protege a integridade da documentação), mas ~95% das falhas de DOCS são auto-fixáveis (SYSTEM_MAP outdated, README stats, etc.). O utilizador repete sempre os mesmos passos manuais.

**Exemplo real (Bloco Q):**
```
[WARN] Auto-verification for bloco-q-fix-backlog-writer: REFUSED — DOCS: Documentation sync failed
# Utilizador teve que correr manualmente:
npm run sync:docs:fix
# Depois re-marcar como checked
```

## Objetivo

Adicionar um mecanismo de auto-fix controlado ao `checkDocumentation()` em `plan-lifecycle.ts` que:

1. Quando `sync-docs.ts --quiet` falha, executa automaticamente `sync-docs.ts --fix --quiet`
2. Re-executa `sync-docs.ts --quiet` para verificar se o fix funcionou
3. Se passou → continua o fluxo normal (plano → done)
4. Se ainda falhou → recusa com mensagem clara ("auto-fix failed, manual intervention needed")

**Critérios de aceitação:**
- [ ] `checkDocumentation()` tenta auto-fix uma única vez antes de recusar
- [ ] O fix é registado no log do daemon para auditoria
- [ ] Se o fix falhar, a mensagem de erro inclui o motivo original
- [ ] Não há risco de loop infinito (max 1 tentativa)
- [ ] Testes unitários cobrem ambos os caminhos (fix sucesso / fix falha)

## Passos de Implementação

### Passo 1: Modificar `checkDocumentation()` em `plan-lifecycle.ts`
**Ficheiro:** `src/plan-lifecycle.ts`
**Acção:** Envolver o catch do `execSync` com lógica de auto-fix:
```ts
export function checkDocumentation(projectRoot: string): CompletionCheck {
  const pkg = readPackageJsonSafe(projectRoot);
  if (!pkg?.scripts?.["sync:docs"]) {
    return { name: "DOCS", passed: true, message: "No sync:docs script — skipped" };
  }
  const { run } = resolveRunner(projectRoot);
  
  // 1ª tentativa: validate only
  try {
    execSync(`${run("sync:docs")} --quiet`, {
      encoding: "utf-8",
      cwd: projectRoot,
      timeout: 60000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "DOCS", passed: true, message: "Documentation in sync" };
  } catch (err) {
    const detail = extractExecError(err);
    
    // Auto-fix: tenta uma vez
    logger.info("plan-lifecycle", "DOCS check failed — attempting auto-fix (sync:docs --fix)");
    try {
      execSync(`${run("sync:docs")} --fix --quiet`, {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Re-verifica após fix
      execSync(`${run("sync:docs")} --quiet`, {
        encoding: "utf-8",
        cwd: projectRoot,
        timeout: 60000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return { name: "DOCS", passed: true, message: "Documentation auto-fixed" };
    } catch {
      // Fix não resolveu — retorna falha com o motivo original
      return { name: "DOCS", passed: false, message: `Documentation sync failed (auto-fix attempted): ${String(detail).slice(0, 300)}` };
    }
  }
}
```
**Verificação:** `npx vitest run src/__tests__/plan-lifecycle-gate-e2e.test.ts` — todos os testes passam

### Passo 2: Adicionar teste para auto-fix bem-sucedido
**Ficheiro:** `src/__tests__/plan-lifecycle-gate-e2e.test.ts`
**Acção:** Adicionar teste que verifica que `checkDocumentation()` tenta auto-fix quando sync-docs falha:
```ts
it("attempts auto-fix when sync:docs fails", async () => {
  // Cria projectRoot com sync:docs script que falha na 1ª vez, passa na 2ª
  // Verifica que o resultado é { passed: true, message: "Documentation auto-fixed" }
});
```
**Verificação:** `npx vitest run src/__tests__/plan-lifecycle-gate-e2e.test.ts` — novo teste passa

### Passo 3: Adicionar teste para auto-fix que falha
**Ficheiro:** `src/__tests__/plan-lifecycle-gate-e2e.test.ts`
**Acção:** Adicionar teste que verifica que quando auto-fix também falha, a mensagem inclui "auto-fix attempted":
```ts
it("returns failed with auto-fix attempted message when fix also fails", async () => {
  // Cria projectRoot com sync:docs script que falha sempre
  // Verifica que o resultado é { passed: false, message: contains "auto-fix attempted" }
});
```
**Verificação:** `npx vitest run src/__tests__/plan-lifecycle-gate-e2e.test.ts` — novo teste passa

### Passo 4: Validar typecheck e lint
**Ficheiro:** N/A
**Acção:** Correr typecheck e lint para garantir que não há erros
**Verificação:**
- `npx tsc --noEmit` — 0 erros
- `npx eslint src/plan-lifecycle.ts --max-warnings 0` — 0 warnings

### Passo 5: Code review e commit
**Ficheiro:** N/A
**Acção:** Spawnar code-reviewer-mimo e fazer commit com mensagem convencional
**Verificação:** Commit com mensagem `feat(plan-lifecycle): add auto-fix for DOCS check in done gate`

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Max 1 tentativa de auto-fix | Loop controlado (max 3) | Se 1 fix não resolve, provavelmente é problema manual. Loop adiciona complexidade sem benefício real. |
| 2 | Fix apenas no checkDocumentation | Generalizar para todos os checks | Build/tests/lint não têm "fix" seguro. DOCS é o único check com fix automatizado confiável. |
| 3 | Log no daemon quando fix é executado | Fix silencioso | Transparência — o utilizador deve saber que o sistema tentou corrigir automaticamente. |
| 4 | Mensagem "auto-fix attempted" na falha | Mesma mensagem original | Diferencia falha "pura" de falha "após fix" — ajuda no debug. |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | `sync:docs --fix` demora demasiado (>60s) | Baixo | Timeout de 60s já existe no execSync |
| 2 | Fix cria efeitos colaterais indesejados | Baixo | sync:docs --fix é designado para ser seguro (read-only para erros não fixáveis) |
| 3 | Verificação de concorrência com outro processo | Baixo | acquireVerificationLock() já previne execução paralela |
