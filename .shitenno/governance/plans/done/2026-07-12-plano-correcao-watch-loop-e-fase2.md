# Plano de Correção — Loop do `shiten watch` + Finalizar Fase 2 (LIVING-002)

**Status:** In Progress
**Updated_at:** 2026-07-21T15:11:11.025Z
**Date:** 2026-07-12

> Gerado a partir de validação real (build/lint/test + E2E) da branch `feat/shiten-living`.
> Todas as afirmações abaixo foram reproduzidas rodando o código, não inferidas por leitura isolada.
> Executar as correções na ordem dada — BUG-002 é bloqueante e deve ser resolvido primeiro.

---


## Checklist

- [x] Os 2 testes novos acima passam.
- [x] `pnpm test` completo continua em verde (sem regressão nos testes existentes de
- [ ] Teste manual: `shiten watch` rodando, editar um plano real com conteúdo que dispara sync — confirmar
- [x] `installReactiveHooks()` implementado, testado (5 testes acima passando).
- [x] `shiten init` chama o instalador automaticamente — testar em projeto novo: `.git/hooks/post-commit`
- [x] `scheduledCheck()` implementado e testado (simular drift alto, confirmar evento publicado; simular
- [x] `pnpm run lint && npx tsc --noEmit && pnpm run build && npx vitest run` — tudo verde.
- [x] Atualizar `shitenno-go/docs/BACKLOG.md` — mudar `LIVING-002` de `Status: Backlog` para

## BUG-002 (CRÍTICO, bloqueante) — `shiten watch` entra em loop de eventos

### Sintoma
Ao editar um arquivo real de governança com `shiten watch` rodando, o terminal entra em rajadas repetidas
de eventos (`engineering_state.consolidated`, `challenge.generated`, `knowledge_debt.detected`,
`entropy.calculated`) que parecem nunca parar — visualmente parece o terminal "piscando"/"rolando sozinho".

### Causa raiz confirmada
`src/doc-sync-significance.ts`, tabela `DIRECTORY_SCORES`, tem uma entrada genérica `"docs/": 0.7` mas
**não tem entrada específica para `docs/generated/`** — a pasta onde o próprio `sync-docs.ts` escreve
(`ARCHITECTURE.md` e outros arquivos gerados). `reports/` já tem a proteção certa (`"reports/": 0.0`), mas
o mesmo padrão não foi replicado para `docs/generated/`.

Cadeia do loop:
1. Edição real dispara `docs.sync.triggered` → `doc-sync-hook` roda `sync-docs.ts`.
2. `sync-docs.ts` escreve `shitenno-go/docs/generated/ARCHITECTURE.md`.
3. Esse arquivo está dentro de `docs/`, que `file-watcher.ts` observa (`watchPaths` inclui a pasta `docs/`
   inteira).
4. `calculateSignificance()` roda sobre o arquivo recém-escrito, casa com `"docs/": 0.7` (não existe
   entrada mais específica), passa do `minSignificance` (0.3 por padrão) → dispara `docs.sync.triggered`
   de novo.
5. Volta ao passo 2. Cada rodada reescreve o arquivo (muda mtime mesmo com conteúdo igual), retrigando o
   chokidar de novo — loop fechado.

### Correção

**Arquivo:** `src/doc-sync-significance.ts`

```ts
const DIRECTORY_SCORES: Record<string, number> = {
  "docs/skills/": 1.0,
  "docs/adrs/": 0.9,
  "docs/generated/": 0.0,   // NOVO — saída do próprio sync-docs.ts, nunca deve re-disparar sync
  "governance/agents/": 0.9,
  "governance/WORKFLOW": 1.0,
  "governance/context/": 0.6,
  "governance/rules/": 0.7,
  "governance/contracts/": 0.8,
  "governance/handoffs/": 0.6,
  "governance/policies/": 0.7,
  "governance/premortem/": 0.6,
  "governance/reviews/": 0.6,
  "docs/": 0.7,
  "core/": 0.4,
  "scripts/": 0.3,
  "cognition/": 0.5,
  "reports/": 0.0,
  // ... resto da tabela inalterado
};
```

Não é preciso mexer em nenhuma outra lógica — `sortedPrefixes` (linha ~126) já ordena por tamanho de
prefixo decrescente, então `docs/generated/` (mais específico) vence `docs/` (mais genérico)
automaticamente assim que a entrada existir.

**Auditar se existe o mesmo problema em outras pastas de saída.** Rodar:
```bash
grep -n "writeFileSync\|mkdirSync" src/*.ts shitenno-go/scripts/*.ts | grep -i "sync-docs\|generated"
```
Qualquer outro diretório que `sync-docs.ts` (ou processos parecidos) escrevam **dentro** de `shitenno-go/docs/`
ou `shitenno-go/governance/` precisa da mesma entrada `0.0` na tabela, pelo mesmo motivo.

### Teste de regressão obrigatório

**Arquivo:** `src/__tests__/doc-sync-significance.test.ts`

```ts
describe("docs/generated/ exclusion (BUG-002 regression)", () => {
  it("scores files inside docs/generated/ as zero significance", () => {
    const score = detectDirectoryScore(`${SHITEN}/docs/generated/ARCHITECTURE.md`, SHITEN);
    expect(score).toBe(0.0);
  });

  it("docs/generated/ takes priority over the generic docs/ prefix", () => {
    const generatedScore = detectDirectoryScore(`${SHITEN}/docs/generated/ANYTHING.md`, SHITEN);
    const genericDocsScore = detectDirectoryScore(`${SHITEN}/docs/some-other-file.md`, SHITEN);
    expect(generatedScore).toBeLessThan(genericDocsScore);
  });
});
```

**Teste de integração (mais importante — é o que teria pego esse bug antes de chegar em produção):**

**Arquivo:** `src/__tests__/file-watcher.test.ts` (ou novo `src/__tests__/doc-sync-loop.test.ts`)

```ts
it("does not re-trigger docs.sync.triggered when syncing writes to docs/generated/", async () => {
  const bus = getEventBus();
  let triggerCount = 0;
  bus.subscribe("docs.sync.triggered", () => { triggerCount++; });

  // Simula o file-watcher processando a escrita do PRÓPRIO sync-docs.ts
  const generatedPath = join(shitenDir, "docs", "generated", "ARCHITECTURE.md");
  mkdirSync(dirname(generatedPath), { recursive: true });
  writeFileSync(generatedPath, "# Architecture\n\nConteúdo gerado.", "utf-8");

  // Aguardar o debounce (500ms) + margem
  await new Promise((r) => setTimeout(r, 700));

  // Só o disparo ORIGINAL deveria ter acontecido — a escrita em docs/generated/ não deveria contar
  expect(triggerCount).toBe(0); // zero, porque essa escrita específica não deveria nem chegar a disparar
});
```

### Critério de aceite
- [ ] Os 2 testes novos acima passam.
- [ ] `pnpm test` completo continua em verde (sem regressão nos testes existentes de
  `doc-sync-significance.test.ts`).
- [ ] Teste manual: `shiten watch` rodando, editar um plano real com conteúdo que dispara sync — confirmar
  no log que `docs.sync.triggered` aparece **uma vez**, não em rajada repetida. Deixar rodando por 2
  minutos sem tocar em mais nada — nenhum evento novo deve aparecer além da linha de status a cada 30s.

---

## LIVING-002 (Fase 2) — o que falta pra fechar de verdade

O `BACKLOG.md` deste projeto marca `LIVING-002` como `Status: Backlog`. Validação em código confirma:

| Item do LIVING-002 | Status real |
|---|---|
| `checkAndArchiveDonePlans()` | ✅ Implementado e testado — plano com `Status: Done` é movido pra `plans/done/` corretamente |
| `--auto` no `detect` (BUG-001) | ✅ Corrigido — flag existe, funciona, arquiva planos |
| Instalador de hook (append-safe, husky-aware) | ❌ Não existe — `src/commands/hooks.ts` não foi criado |
| `.husky/post-merge` | ❌ Não existe |
| `shiten init` instala hooks automaticamente | ❌ Testado em projeto novo — nenhum hook é criado |
| Gatilho por tempo (Caso 3 — acúmulo sem commit) | ❌ Zero vestígio no código |

### Item 1 — Instalador de hooks (append-safe, husky-aware)

**Arquivo novo:** `src/git-hooks-installer.ts`

```ts
import { writeFileSync, existsSync, mkdirSync, chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const HOOK_MARKER = "# shiten-managed-hook";

function findGitHooksDir(projectRoot: string): string | null {
  try {
    const dir = execSync("git rev-parse --git-path hooks", { cwd: projectRoot, encoding: "utf-8" }).trim();
    return join(projectRoot, dir);
  } catch {
    return null; // não é repo git — degradar graciosamente, não é erro
  }
}

function usesHusky(projectRoot: string): boolean {
  return existsSync(join(projectRoot, ".husky"));
}

export function installReactiveHooks(
  projectRoot: string,
  shitenBinPath: string
): { installed: string[]; skipped: string[] } {
  const installed: string[] = [];
  const skipped: string[] = [];

  const targetDir = usesHusky(projectRoot)
    ? join(projectRoot, ".husky")
    : findGitHooksDir(projectRoot);

  if (!targetDir) return { installed: [], skipped: ["not-a-git-repo"] };
  if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true });

  for (const hookName of ["post-commit", "post-merge"] as const) {
    const hookPath = join(targetDir, hookName);
    const shitenLine = `${shitenBinPath} detect --auto 2>/dev/null &`;

    if (existsSync(hookPath)) {
      const existing = readFileSync(hookPath, "utf-8");
      if (existing.includes(HOOK_MARKER)) {
        skipped.push(`${hookName} (já instalado)`);
        continue;
      }
      // Hook já existe (de outra ferramenta) — SEMPRE anexar, nunca sobrescrever
      writeFileSync(hookPath, `${existing}\n${HOOK_MARKER}\n${shitenLine}\n`);
    } else {
      writeFileSync(hookPath, `#!/bin/sh\n${HOOK_MARKER}\n${shitenLine}\n`);
    }
    chmodSync(hookPath, 0o755);
    installed.push(hookName);
  }
  return { installed, skipped };
}
```

**Ligar em `src/commands/init.ts`** — chamar `installReactiveHooks(projectRoot, shitenBinPath)` no passo
final do `init`, depois do scaffold estar completo. Reportar no output do `init` quais hooks foram
instalados.

### Item 2 — Testes obrigatórios do instalador (idempotência + nunca sobrescrever)

**Arquivo novo:** `src/__tests__/git-hooks-installer.test.ts`

```ts
describe("installReactiveHooks", () => {
  it("creates post-commit and post-merge when none exist", () => { /* ... */ });
  it("is idempotent — running twice does not duplicate the hook content", () => { /* ... */ });
  it("appends to an existing third-party hook instead of overwriting it", () => {
    // Escrever um post-commit "de terceiros" antes, rodar o instalador,
    // confirmar que o conteúdo original ainda está lá E o novo foi anexado
  });
  it("writes to .husky/ instead of .git/hooks/ when .husky/ exists", () => { /* ... */ });
  it("does not throw and returns skipped=['not-a-git-repo'] outside a git repo", () => { /* ... */ });
});
```

### Item 3 — Gatilho por tempo (Caso 3: acúmulo grande sem commit)

**Arquivo novo:** `src/scheduled-check.ts`

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";

const UNCOMMITTED_FILES_THRESHOLD = 20;
const UNCOMMITTED_MINUTES_THRESHOLD = 120;

function getUncommittedDrift(projectRoot: string): { filesChanged: number; minutesSinceLastCommit: number } {
  const diffStat = execSync("git diff --stat HEAD 2>/dev/null || true", { cwd: projectRoot, encoding: "utf-8" });
  const filesChanged = diffStat.trim() ? diffStat.trim().split("\n").length - 1 : 0;

  let minutesSinceLastCommit = 0;
  try {
    const lastCommitEpoch = execSync("git log -1 --format=%ct", { cwd: projectRoot, encoding: "utf-8" }).trim();
    minutesSinceLastCommit = (Date.now() / 1000 - Number(lastCommitEpoch)) / 60;
  } catch { /* sem commits ainda — não alarmar */ }

  return { filesChanged, minutesSinceLastCommit };
}

export function scheduledCheck(projectRoot: string, shitenDir: string): void {
  const drift = getUncommittedDrift(projectRoot);
  const driftIsSignificant =
    drift.filesChanged > UNCOMMITTED_FILES_THRESHOLD ||
    drift.minutesSinceLastCommit > UNCOMMITTED_MINUTES_THRESHOLD;

  if (driftIsSignificant) {
    getEventBus().publish("workdir.large_uncommitted_drift", {
      filesChanged: drift.filesChanged,
      minutesSinceLastCommit: Math.round(drift.minutesSinceLastCommit),
    });
  }
}
```

Adicionar novo comando interno `shiten internal-scheduled-check` (não documentado no `--help` principal,
só pra uso via cron) que chama `scheduledCheck()`. Instalar entrada de cron opcional no `init` (perguntar,
não forçar):
```bash
*/15 * * * * cd <projectRoot> && node <shitenBinPath> internal-scheduled-check >> shitenno-go/daemon/scheduled.log 2>&1
```

**Nota:** adicionar `"workdir.large_uncommitted_drift"` ao union type `ShitenEventType` em `event-bus.ts`
antes de publicar esse evento, ou o typecheck vai falhar.

### Critério de aceite pra fechar LIVING-002

- [x] `installReactiveHooks()` implementado, testado (5 testes acima passando).
- [x] `shiten init` chama o instalador automaticamente — testar em projeto novo: `.git/hooks/post-commit`
  (ou `.husky/post-commit` se aplicável) contém o marcador `shiten-managed-hook` depois do `init`.
- [x] `scheduledCheck()` implementado e testado (simular drift alto, confirmar evento publicado; simular
  drift baixo, confirmar que nada é publicado).
- [x] `pnpm run lint && npx tsc --noEmit && pnpm run build && npx vitest run` — tudo verde.
- [x] Atualizar `shitenno-go/docs/BACKLOG.md` — mudar `LIVING-002` de `Status: Backlog` para
  `Status: Done`, só depois que os itens acima estiverem de fato completos (não antes).

---

## Ordem de execução

```
1. BUG-002 primeiro (bloqueante — o loop pode mascarar/atrapalhar teste manual de qualquer outra coisa)
2. Item 1 + 2 do LIVING-002 (instalador de hooks)
3. Item 3 do LIVING-002 (gatilho por tempo)
4. Suite completa: pnpm run lint && npx tsc --noEmit && pnpm run build && npx vitest run
5. Atualizar BACKLOG.md refletindo o estado real
```
