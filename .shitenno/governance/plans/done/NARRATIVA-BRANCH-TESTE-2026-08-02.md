# Narrativa — Branch de teste: limpeza da raiz + correção do `shugo update`/manifest

**Status:** Done
**Updated_at:** 2026-08-02T20:34:27.598Z
**Date:** 2026-08-02

**Contexto:** os Achados A/B/C e os itens 5/6/12 do Plano Mestre já estão implementados e validados com testes reais passando (audit: 329/329, MCP: 69/69). Esta branch cobre o que ainda falta: os itens 3-4 (mecanismo do `shugo update`) e a limpeza de arquivos duplicados na raiz do projeto.

**Nada aqui envolve o scaffold.** O scaffold é só `src/templates/base/` — não é tocado. O que muda é a raiz deste repositório, que tem cópias soltas e desatualizadas de arquivos que já existem (corretamente) dentro de `.shitenno/`, o artefato instalado que o sistema de fato usa.

---

## Parte 1 — Limpeza da raiz

### Por que
Confirmado por leitura de código (`src/scaffolder.ts:79`, `const baseDir = join(TEMPLATES_DIR, "base")`): nada no sistema lê a raiz do projeto para `docs/AGENTS.md`, `docs/backlog/`, `governance/context/context_buffer.yaml` ou os scripts de sessão. Esses arquivos na raiz não alimentam `init`, `upgrade`, `update`, MCP, nem audit — são resíduos de antes deste repo se auto-instalar. Confirmado também que nenhum deles está no `.gitignore` — são rastreados normalmente, então a remoção precisa ser via `git rm`.

### ⚠️ Exceção — fazer isto ANTES de qualquer remoção
`scripts/validate-session.ts` é o único caso em que a cópia da **raiz** está certa e a de `.shitenno/` tem o bug (path sem o ponto: `resolve(ROOT, 'shitenno', 'governance')` em vez de `'.shitenno'`). Confirmado rodando `pnpm run validate:session` — falha agora com `context_buffer.yaml not found` mesmo o buffer existindo.

```bash
cp scripts/validate-session.ts .shitenno/scripts/validate-session.ts
```

### Remoção (depois do passo acima)
```bash
git rm scripts/validate-session.ts scripts/close-session.ts
git rm docs/AGENTS.md docs/FORBIDDEN_OPERATIONS.md docs/Shitenno_GUIDE.md docs/opencode-context.md
git rm -r docs/backlog
git rm governance/context/context_buffer.yaml
rmdir governance/context governance 2>/dev/null || true
```

### Validação obrigatória depois
```bash
pnpm run build
pnpm run validate:session   # deve passar limpo agora
pnpm run close:session      # deve continuar passando (já corrigido antes)
```
Se `validate:session` ainda falhar, o `cp` do passo anterior não foi aplicado antes do `git rm` — não prosseguir até isso passar limpo.

---

## Parte 2 — Itens 3-4 do Plano Mestre: `shugo update`/manifest

Código completo já especificado em `PLANO-UPDATE-MANIFEST-BACKLOG-2026-08-01.md`, seção "Achado 1", passos 1-6. Resumo do que falta (confirmado ainda ausente: `manifest.test.ts` só testa o `diffManifests` antigo, sem `installedHashes`/`conflict`; `getTemplatesDir()` continua duplicada em `commands/update/display.ts` e `commands/upgrade/helpers.ts`):

1. Consolidar `getTemplatesDir()` num módulo neutro (`src/paths.ts`), removendo as duas duplicatas.
2. Estender `Manifest` com `installedHashes` (retrocompatível — campo opcional).
3. `createManifest()`/`updateManifest()` passam a calcular `templateHashes` a partir de `getTemplatesDir()` (o template real), não de `shitennoDir` (o que fazem hoje).
4. Nova função `diffManifestsV2` com estado `conflict` (template mudou + local customizado) — nunca aplicado automaticamente. `diffManifests` original fica intocada, sem risco pros testes que já passam nela.
5. `applyUpdates()` só pode copiar de `diff.added`/`diff.changed`, nunca de `diff.conflict`.

**TDD obrigatório:** escrever os testes de `diffManifestsV2` primeiro (4 casos: `added`, `changed` seguro, `conflict`, `removed` — exemplos completos no documento original), confirmar vermelho contra o código atual, só então aplicar o fix.

### Validação obrigatória depois
```bash
pnpm run build
npx vitest run src/__tests__/manifest.test.ts src/__tests__/manifest-diff-v2.test.ts
node dist/bin/shugo.js update --dry-run   # rodar de verdade, conferir a saída manualmente
```
Rodar `update --dry-run` de verdade neste repo (não só os testes unitários) é o único jeito de confirmar que o mecanismo passou a comparar contra o template real, e não contra si mesmo — foi assim que descobri o bug original.

---

## Guardrails gerais desta branch

- `pnpm run build && npx vitest run --maxWorkers=2` depois de cada uma das duas partes, não só no final.
- Nenhuma customização manual sancionada (ex.: `.shitenno/docs/AGENTS.md` editado à mão) pode ser sobrescrita — é exatamente pra isso que existe o estado `conflict` na Parte 2. Se algum teste mostrar um arquivo customizado sendo copiado por cima, é regressão, não item concluído.
- Ao terminar as duas partes, gerar um novo zip da branch para eu validar do mesmo jeito que fiz até aqui (build real, execução real dos comandos, não só leitura de código).
