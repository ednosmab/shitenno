---
category: product
lifecycle: Active
---

# Publish-Readiness Checklist

> **Data:** 2026-07-05
> **Propósito:** Guardar o checklist para quando a decisão de publicar for tomada.
> **Status:** ⏸ Aguarda conclusão das Fases 0-14 e decisão comercial.

---

## Pré-requisitos (bloqueadores)

- [ ] **Fases 0-14 concluídas** — não publicar com `digest`, `update`, ou `goal update --title` quebrados
- [ ] **`package.json` → `"private": false`** — só aplicar quando decidir publicar
- [ ] **`"files"` no `package.json`** lista só o necessário:
  - `dist/` (output do build)
  - `bin/shugo.ts` → apontar para `dist/shugo.js` (usuário final não tem `tsx`)
  - NÃO incluir: `plans/`, `shitenno/` de teste, `src/`, `docs/` internos
- [ ] **`"bin"` aponta para `dist/shugo.js`** já buildado
- [ ] **`"main"` e `"exports"` apontam para `dist/shugo.js`**

## Validação antes do primeiro publish

- [ ] `npm run build` completa sem erros
- [ ] `npm pack --dry-run` mostra um tarball limpo:
  - Sem arquivos de desenvolvimento/teste
  - Sem `plans/`, `src/`, `docs/` internos
  - Com `dist/templates/` (necessário para `shugo init`)
- [ ] `node dist/shugo.js --help` funciona (sem `tsx`)
- [ ] `node dist/shugo.js --version` mostra a versão correcta
- [ ] `npx shitenno --help` funciona (teste de instalação global)

## Pós-publish

- [ ] Verificar em `npmjs.com/package/shitenno`
- [ ] Testar `npm install -g shitenno` numa máquina limpa
- [ ] Testar `shugo init` numa pasta limpa
- [ ] Verificar que `dist/templates/` está incluído no tarball
- [ ] Actualizar README.md com instruções de instalação

## Notas

- O build script já copia templates: `tsup && rm -rf dist/templates && cp -r src/templates dist/templates`
- O `prepublishOnly` já corre o build automático
- Workspaces (`"workspaces": ["apps/*"]`) pode causar problemas com `npm publish` — considerar remover ou ajustar
