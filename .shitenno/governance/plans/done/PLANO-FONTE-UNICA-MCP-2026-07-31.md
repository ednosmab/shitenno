# Plano — Fonte Única de Verdade via MCP + Correção de Achados

**Status:** Done
**Updated_at:** 2026-08-01T13:54:22.781Z
**Date:** 2026-07-31
**Data:** 2026-07-31 | **Base:** zip `shitenno-feat-refactor` (validado linha a linha contra o código real)
**Prioridade:** Máxima — este é o mecanismo de continuidade entre sessões. Zero regressão tolerada.

---

## Resposta direta à pergunta: dá para abandonar `opencode.json` e usar só MCP?

**Não totalmente — e a resposta importa mais do que parece.** Segundo a documentação oficial do opencode, o array `instructions[]` é o único canal pelo qual conteúdo extra (fora do AGENTS.md de raiz auto-descoberto) chega ao system prompt. Não existe um "gatilho automático" no opencode que faça o agente chamar uma tool MCP sozinho no boot — alguém precisa *dizer* ao agente para fazer essa chamada, e essa instrução também precisa vir de algum lugar. Esse "algum lugar" só pode ser o `instructions[]` (ou o AGENTS.md).

Ou seja: a arquitetura correta não é "zero opencode.json", é **opencode.json injeta o mínimo de texto estático possível + uma instrução curta que ensina o agente a buscar tudo o que é dinâmico via MCP**. O MCP vira a fonte única de *estado* (o que muda a cada sessão); o `instructions[]` continua sendo a fonte de *regras* (o que não muda).

### ⚠️ Item 0 — Bloqueador: confirmar comportamento real do opencode instalado
A documentação do opencode diverge entre versões:
- **V1:** `instructions[]` resolve paths/globs/URLs e concatena o conteúdo bruto no prompt (é o comportamento que o relatório original assumiu, e que bate com o `opencode.json` atual do projeto).
- **V2:** *"V2 currently parses and retains this field but does not resolve its entries into instruction sources... Use AGENTS.md for active V2 instructions."* — ou seja, o array pode estar sendo **silenciosamente ignorado**, e o que realmente chega ao modelo seria só o auto-discovery nativo de arquivos chamados `AGENTS.md` na árvore de diretórios.

**Ação antes de tocar em qualquer coisa do Item D deste plano:**
1. Rodar `opencode --version` (ou checar o changelog da instalação usada pelo agente).
2. Teste empírico, barato e decisivo: numa sessão nova, perguntar diretamente ao agente "liste literalmente o que você tem no seu contexto inicial de sistema, sem resumir". Se o conteúdo de `context_buffer.yaml` aparecer verbatim, `instructions[]` está sendo resolvido (V1-like). Se não aparecer, o problema é outro (auto-discovery) e o Item D precisa ser redesenhado.

Isso não bloqueia os Achados A, B e C abaixo — só bloqueia o Item D (mudança em `opencode.json`).

---

## Achados novos (confirmados no código, não estavam no relatório original)

### Achado A — `close-session.ts`: os checks de BUFFER e BACKLOG nunca passam (P0)

**O que está quebrado:**
`scripts/close-session.ts` e sua cópia idêntica `.shitenno/scripts/close-session.ts` (usadas para a auto-governança deste próprio projeto via `pnpm run close:session`) apontam para caminhos que nunca existiram:

```ts
// scripts/close-session.ts e .shitenno/scripts/close-session.ts (idênticos)
const GOV = resolve(ROOT, 'shitenno', 'governance');           // ❌ falta o ponto → '.shitenno'
...
const backlogPath = resolve(ROOT, 'shitenno', 'docs', 'BACKLOG.md'); // ❌ pasta e ficheiro errados
```

Real: `.shitenno/governance/context/context_buffer.yaml` (com ponto) e `docs/backlog/ACTIVE.md` (não existe `BACKLOG.md`). Resultado: `checkBuffer()` **sempre falha** com `context_buffer.yaml not found` (exitCode=1) e `checkBacklog()` **sempre avisa** `BACKLOG.md not found`, **independente do estado real do projeto**. É exatamente o ritual de fim de sessão exigido pela Regra 12 do `AGENTS.md` ("INVARIANTE DE FIM DE SESSÃO"), e ele está cego desde sempre — não é regressão que eu introduzi, é achado.

Isso responde diretamente sua pergunta "acredito que isso já esteja acontecendo": **o mecanismo que grava o buffer (`context-buffer-writer` via `shugo feedback`) parece funcionar normalmente** (usa resolução de diretório correta, não esse path hardcoded) — mas o **validador de fim de sessão que deveria confirmar isso está quebrado e mentindo**.

**Descoberta que muda a correção:** existe uma **terceira cópia**, `src/templates/base/scripts/close-session.ts` — é o template que o `shitenno` instala em projetos de terceiros. Essa versão **já tem o bug corrigido** (`'.shitenno'` com ponto, fallback `ACTIVE.md`/`BACKLOG.md`) e está **mais evoluída**: tem lock de verificação contra o daemon, geração automática de reminders para planos travados em `check`, e uma suíte E2E best-effort não-bloqueante. Ou seja: **o template que vocês distribuem para terceiros está à frente da cópia usada para a auto-governança deste próprio repositório.** As duas cópias de dogfooding (`scripts/` e `.shitenno/scripts/`) ficaram para trás.

**Correção recomendada — não é hand-patch, é ressincronização:**
1. Substituir o conteúdo de `scripts/close-session.ts` pelo conteúdo (já correto) de `src/templates/base/scripts/close-session.ts`, ajustando só o que for específico de projeto-alvo vs. projeto-fonte (ex.: `npm run` → `pnpm run`, já que este repo usa pnpm).
2. Eliminar a duplicata: `.shitenno/scripts/close-session.ts` deveria deixar de existir como arquivo independente — se o scaffold é quem copia `scripts/` para dentro de `.shitenno/` em projetos-alvo, então para o dogfooding deste repo o caminho mais seguro é `.shitenno/scripts/close-session.ts` virar um **link simbólico** ou um `import`/`re-export` de `scripts/close-session.ts`, nunca um segundo arquivo com conteúdo próprio. Se descobrirem que build/scaffold já faz essa cópia automaticamente a partir do template, então o fix correto é só no template (`src/templates/base/scripts/close-session.ts`) e propagar via `shugo upgrade`, e as cópias locais somem.
3. **Antes de aplicar (TDD estrito, regra 5 do AGENTS.md):** criar `scripts/__tests__/close-session.test.ts` que roda o script atual (o quebrado) contra um fixture com `.shitenno/governance/context/context_buffer.yaml` e `docs/backlog/ACTIVE.md` reais, e afirma que os checks deveriam passar. Rodar esse teste primeiro — ele deve **falhar** (vermelho, prova o bug). Só então aplicar a correção e confirmar verde. Adicionar este teste ao pipeline (`pnpm run test`) para virar guarda permanente.

```ts
// scripts/__tests__/close-session.test.ts (esqueleto)
import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("close-session script — path resolution", () => {
  it("finds context_buffer.yaml at .shitenno/governance/context/", () => {
    const fixture = mkdtempSync(join(tmpdir(), "close-session-"));
    mkdirSync(join(fixture, ".shitenno/governance/context"), { recursive: true });
    writeFileSync(
      join(fixture, ".shitenno/governance/context/context_buffer.yaml"),
      'session:\n  status: "completed"\n'
    );
    mkdirSync(join(fixture, "docs/backlog"), { recursive: true });
    writeFileSync(join(fixture, "docs/backlog/ACTIVE.md"), "### Item\n| **Status** | Done |\n");

    const output = execSync(`tsx ${join(__dirname, "../close-session.ts")}`, {
      cwd: fixture,
      encoding: "utf-8",
    });

    expect(output).toContain("✅ [BUFFER]");
    expect(output).not.toContain("BUFFER.*not found");
    expect(output).toContain("✅ [BACKLOG]");
  });
});
```

---

### Achado B — `AGENTS.md` descreve um recurso que não existe em runtime (P0)

`.shitenno/docs/AGENTS.md`, linha 38:
> "Lazy Loading (Novo): O `session-bootstrapper.ts` implementa carregamento lazy... Apenas ficheiros essenciais (`AGENTS.md`, `context_buffer.yaml`) são carregados no início."

`src/session-bootstrapper.ts` (254 linhas) **não é importado por nenhum outro módulo do projeto**, só pelo seu próprio teste (`session-bootstrapper.test.ts`). É código morto. A frase é lida em **toda sessão** (via `opencode.json → instructions[0]`) e descreve um comportamento que simplesmente não acontece.

**Correção (alinhada ao objetivo de fonte única via MCP — não faz sentido reviver leitura direta de ficheiro):**
1. Confirmar zero consumidores: `grep -rln "session-bootstrapper\|SessionBootstrapper" --include="*.ts" --include="*.md" .` (já rodei — só o próprio arquivo e teste aparecem; refazer após qualquer mudança no repo).
2. Apagar `src/session-bootstrapper.ts` e `src/__tests__/session-bootstrapper.test.ts`.
3. Rodar `pnpm run build && pnpm run test` completo — confirmar zero quebra (é o teste de regressão real aqui: se algo depender indiretamente via barrel export, o build acusa).
4. Remover as linhas 38 ("Lazy Loading (Novo)...") do `AGENTS.md`, substituindo por uma frase que aponte para o mecanismo real (ver Achado C/Item D): *"Estado da sessão é obtido via `shitenno_getBriefing`/`shitenno_getMandatoryContext` (MCP) — nunca por leitura direta de `context_buffer.yaml`."*

---

### Achado C — `quick-board-enforcement.md` contradiz a regra mandatória do próprio projeto (P1, confirma achado do relatório original)

`docs/skills/mcp-interaction.md` — regra mandatória do próprio projeto:
> "**Nunca** ler ficheiros raw quando o MCP está disponível — o servidor aplica governance e transformações."

`quick-board-enforcement.md`, Passo 1, hoje:
> "Ler `governance/context/context_buffer.yaml`" (diretamente, sem MCP).

E o pior: a formatação em tabela que a skill pede para "copiar exactamente" **já existe pronta**, gerada por `markdownQuickBoard()` em `src/briefing-formatter.ts`, e já exposta via a tool MCP `getBriefing` (com cache — `resolveBriefing`/`computeRequestHash`, então chamadas repetidas na mesma sessão são baratas).

**Correção — reusar o que já existe, não inventar formatação nova (menor superfície de regressão):**

```diff
--- a/.shitenno/docs/skills/quick-board-enforcement.md
+++ b/.shitenno/docs/skills/quick-board-enforcement.md
@@ ### PASSO 1: Carregar Dados
-```
-1. Ler governance/context/context_buffer.yaml
-```
+```
+1. Chamar a tool MCP: shitenno_getBriefing({"format":"markdown","depth":"minimal"})
+2. A resposta já contém a secção "## QUICK BOARD — Estado do Projecto" pronta,
+   formatada em Markdown. NÃO reformatar. NÃO ler context_buffer.yaml directamente.
+```

@@ ### PASSO 2: Exibir Quick Board
-Formato OBRIGATÓRIO (copiar exactamente):
-```
-┌─────────────────────────────────────────────────────────────┐
-│ QUICK BOARD — <data actual>                                 │
-...
-└─────────────────────────────────────────────────────────────┘
-```
+Copiar a secção "## QUICK BOARD — Estado do Projecto" da resposta da tool
+`getBriefing` directamente na mensagem ao utilizador, sem alterações.
```

**Regra de leitura ao invés do path errado:** mantém `Nota sobre Handbook` (esse campo não vem de `getBriefing` hoje) — confirmar se `getBriefing` markdown já cobre isso; se não, é um pequeno gap a fechar em `formatBriefingMarkdown` (`src/mcp-handlers/briefing.ts`), não na skill.

**Teste obrigatório (contrato entre a skill e a tool — é o tipo de coisa que, se quebrar silenciosamente, vira exatamente o Achado A de novo):**
```ts
// src/__tests__/briefing-quick-board-contract.test.ts (novo)
import { describe, it, expect } from "vitest";
import { handleGetBriefing } from "../mcp-handlers/briefing";

describe("getBriefing markdown — contrato do Quick Board", () => {
  it("inclui a secção QUICK BOARD com os 5 campos esperados", async () => {
    const result = await handleGetBriefing(FIXTURE_ROOT, FIXTURE_SHITENNO_DIR, { format: "markdown" });
    const text = result.content[0].text as string;
    expect(text).toContain("## QUICK BOARD — Estado do Projecto");
    for (const campo of ["Tarefa em curso", "Próximo P0", "Dívidas P1", "Impedimentos", "Estado última sessão"]) {
      expect(text).toContain(campo);
    }
  });
});
```
Se esse teste existir e o formato de `markdownQuickBoard()` mudar no futuro sem atualizar a skill, o CI acusa — em vez de o agente silenciosamente formatar errado numa sessão real.

---

### Item D — `opencode.json`: reduzir texto estático, MCP como fonte de estado (depende do Item 0)

Estrutura alvo:

```jsonc
"instructions": [
  "./.shitenno/docs/AGENTS-CORE.md",
  "AO INICIAR QUALQUER SESSÃO, ANTES de qualquer resposta operacional: chame a tool shitenno_getBriefing({\"format\":\"markdown\",\"depth\":\"minimal\"}) e exiba a secção Quick Board da resposta. NÃO leia ficheiros .shitenno/ directamente — o estado da sessão (buffer, regras/skills mandatórias) vem sempre de tools shitenno_*, nunca de leitura de ficheiro."
]
```

- `AGENTS-CORE.md`: só as regras que **nunca mudam entre sessões** (arquitetura/stack, idioma único, git/commit, TDD estrito, skills obrigatórias via MCP) — é seguro extrair porque é conteúdo estático, sem risco de ficar desatualizado dentro de uma sessão.
- `context_buffer.yaml` sai do `instructions[]`. Ele nunca mais é injetado bruto — só é lido via `getBriefing`/`getMandatoryContext`, que leem o ficheiro atual do disco a cada chamada. Isso elimina o risco de "prompt injetado uma vez no boot ficar stale numa sessão longa" — problema que a leitura fixa em `instructions[]` tem estruturalmente e que MCP não tem.
- Isso também fecha o Achado 4 do relatório original (system-reminder gerando releituras) por outro ângulo: com uma única regra ("estado sempre vem de tool MCP, nunca de leitura de ficheiro"), não sobra ambiguidade sobre "já está no prompt ou preciso ler".

**Isso não é abandonar `opencode.json`** — é reduzir o que ele injeta como texto morto/estático ao mínimo, e usar MCP como única fonte do que muda a cada sessão.

**Se o Item 0 revelar que a instalação está em V2** (array não resolvido): a estratégia muda — mover `AGENTS-CORE.md` para um `AGENTS.md` na raiz do projeto (auto-discovery nativo do opencode), e a instrução de "chame getBriefing no boot" precisa ir dentro desse `AGENTS.md` de raiz, não em `instructions[]`. Não decidir isso sem confirmar o Item 0.

---

## Ordem de execução (para não fazer tudo de uma vez e isolar risco)

| Ordem | Item | Depende de | Por quê nessa posição |
|---|---|---|---|
| 1 | Item 0 — confirmar versão/comportamento opencode | — | Bloqueia só o Item D; fazer em paralelo com o resto |
| 2 | Achado A — `close-session.ts` | — | Maior risco silencioso, mais isolado, testável sozinho |
| 3 | Achado C — `quick-board-enforcement.md` → `getBriefing` | — | Testável isoladamente, não toca `opencode.json` |
| 4 | Achado B — apagar `session-bootstrapper.ts` + corrigir `AGENTS.md` | 3 | Só faz sentido depois de C existir (senão a doc some sem substituto) |
| 5 | Item D — `opencode.json` | 1, 4 | Maior impacto e maior risco; só depois dos outros três estáveis |

## Guardrails contra regressão (aplicar em todos os itens acima)

- **TDD estrito em cada item:** escrever o teste que prova o bug/lacuna ANTES do fix (vermelho), aplicar o fix, confirmar verde. Isso é a Regra 5 do próprio `AGENTS.md` — não é processo extra, é o que já está mandatado.
- Antes de apagar `session-bootstrapper.ts`: `pnpm run build && pnpm run test` completo + `grep -r "session-bootstrapper"` (código e docs) confirmando zero referências residuais.
- Antes de mudar `close-session.ts`: rodar o novo teste de fixture contra o script atual primeiro (deve falhar), só então aplicar a correção.
- Antes de mudar `opencode.json` (Item D): não aplicar direto — abrir uma sessão nova do opencode localmente e confirmar que (a) o Quick Board ainda aparece na primeira resposta, (b) as regras de git/TDD continuam sendo respeitadas nas primeiras interações, antes de considerar o item concluído.
- Adicionar o teste de contrato do Achado C ao pipeline padrão (`pnpm run test`), não como script avulso — é a única forma de pegar quebra de formato de `getBriefing` antes que vire um bug silencioso como o Achado A.
- Registrar no `context_buffer.yaml` (`technical_debt`) a triplicata `scripts/close-session.ts` / `.shitenno/scripts/close-session.ts` / `src/templates/base/scripts/close-session.ts` até a consolidação ser decidida — para não perder de vista mesmo que a Ordem de Execução acima priorize outros itens primeiro.
