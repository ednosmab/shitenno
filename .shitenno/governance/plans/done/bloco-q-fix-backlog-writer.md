# Bloco Q — `appendBacklogSection` sem tratamento de erro de filesystem

**Status:** checked

## Contexto

Rodando `npm run test:unit` (a suíte usada pelo gate de "done" em `plan-lifecycle.ts`), o seguinte teste falha:

```
FAIL src/__tests__/backlog-writer.test.ts > appendBacklogSection > returns empty result when file not found
AssertionError: expected 1 to be +0
```

## Causa raiz

`appendBacklogSection` (em `src/backlog-writer.ts`) não tem `try/catch` ao redor de `mkdirSync`/`writeFileSync`. O teste que falha só passa "por acidente":

- Em ambiente **sem** permissão de escrita na raiz do filesystem (CI comum, usuário não-root): `mkdirSync("/nonexistent", ...)` lança `EACCES`, e como não há captura, o teste falha por **exceção não tratada** — não pela asserção.
- Em ambiente **com** permissão (ex.: container rodando como root): a escrita simplesmente funciona, cria diretórios fora do projeto e retorna `itemsAdded: 1` em vez de `0`.

Ou seja: o bug real independe de root/non-root — é a **ausência de tratamento de falha de I/O** numa função que é um efeito colateral "nice-to-have" do comando `audit` (não deveria derrubar o audit inteiro se o backlog não puder ser escrito, nem criar diretórios arbitrários fora do projeto).

## Correção

### 1. `src/backlog-writer.ts` — envolver I/O em try/catch

Localizar a função `appendBacklogSection` (por volta da linha 368) e substituir por:

```ts
export function appendBacklogSection(
  backlogPath: string,
  items: BacklogItem[],
  date: string
): BacklogWriteResult {
  const dir = dirname(backlogPath);

  let existingContent = "";
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    existingContent = existsSync(backlogPath) ? readFileSync(backlogPath, "utf-8") : "";
  } catch (err) {
    logger.warn("backlog-writer", `Could not access ${backlogPath}: ${(err as Error).message}`);
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, message: "Backlog path not accessible" };
  }

  const newItems = items.filter((item) => !isDuplicate(existingContent, item));
  if (newItems.length === 0) {
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, message: "All items are duplicates" };
  }

  const section = formatBacklogSection(newItems, date);
  let content = existingContent;
  if (content.length === 0) {
    content = `# BACKLOG\n\n${section}`;
  } else {
    const insertionIdx = findInsertionPoint(content);
    content = insertionIdx >= 0
      ? content.slice(0, insertionIdx) + section + "\n\n" + content.slice(insertionIdx)
      : content + `\n${section}`;
  }

  try {
    writeFileSync(backlogPath, content, "utf-8");
  } catch (err) {
    logger.warn("backlog-writer", `Failed to write ${backlogPath}: ${(err as Error).message}`);
    return { itemsAdded: 0, itemsSkipped: items.length, sectionInserted: false, message: "Failed to write backlog file" };
  }

  logger.info("backlog-writer", `Appended ${newItems.length} items to ${backlogPath}`);
  return {
    itemsAdded: newItems.length,
    itemsSkipped: items.length - newItems.length,
    sectionInserted: true,
    message: `Added ${newItems.length} items (${items.length - newItems.length} duplicates skipped)`,
  };
}
```

### 2. `src/__tests__/backlog-writer.test.ts` — teste independente de ambiente

O teste atual depende do processo **não** ser root para passar, o que é frágil (falha em containers/CI rodando como root). Substituir por um mock explícito de falha de filesystem.

No topo do arquivo, garantir os imports necessários:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
```

Substituir o teste `"returns empty result when file not found"` por:

```ts
it("returns empty result when directory creation fails", () => {
  const mkdirSpy = vi
    .spyOn(fs, "mkdirSync")
    .mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

  const result = appendBacklogSection(
    join(tempDir, "no-perms", "file.md"),
    [sampleItem],
    "2026-06-30"
  );

  expect(result.itemsAdded).toBe(0);
  expect(result.sectionInserted).toBe(false);

  mkdirSpy.mockRestore();
});
```

## Passos de validação

1. Aplicar o patch em `src/backlog-writer.ts`.
2. Substituir o teste em `src/__tests__/backlog-writer.test.ts` conforme acima.
3. Rodar `npm run test:unit` — deve fechar 154/154 arquivos, sem falhas.
4. Rodar `npm run typecheck` para garantir que os tipos de `err` (`unknown` em catch) não quebram build.

## Nota opcional (dureza extra, não bloqueante)

O projeto já tem `src/path-safety.ts` com `resolveWithinRoot()` para prevenir path traversal. Hoje `backlogPath` sempre vem de `resolveBacklogPaths(ctx.shitennoDir)` (path controlado, dentro do projeto), então não é estritamente necessário usá-lo aqui. Vale reconsiderar apenas se `appendBacklogSection` passar a aceitar um path vindo de input externo (MCP, flag de CLI, etc.).
