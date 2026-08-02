---
status: andamento
date: 2026-07-15
priority: P1
owner: executor
updated_at: 2026-07-21T15:11:11.060Z
---

# Plano: migrar o formato de status dos planos para frontmatter YAML

> Correção sobre o que eu disse antes: falei em "11 arquivos" com base num grep amplo por
> `**Field:**`. Fui ler cada um. A maioria usa essa *sintaxe* pra outro tipo de documento
> (regras, relatórios de auditoria, saída do MCP) — não pra status de plano. O escopo real
> deste plano é **4 arquivos**. Prefiro corrigir isso agora a deixar você acreditar que a
> migração é maior do que é.

---


## Checklist

- [x] Passo 1 — `markdown-plan-engine.ts` (leitura/escrita YAML)
- [x] Passo 2 — `plan-format-validator.ts` (reconhecer bloco YAML como válido)
- [x] Passo 3 — `plan-backlog-sync.ts` (delegar escrita ao engine)
- [x] Passo 4 — `commands/plan.ts` format_header (não duplicar campos YAML)
- [x] Passo 5 — `generateTemplate()` (template default → YAML)

## 1. Escopo real (verificado, não estimado)

| Arquivo | Papel no problema | Precisa mudar? |
|---|---|---|
| `src/markdown-plan-engine.ts` | Já lê/escreve YAML de forma aditiva (feito na sessão anterior). Falta só o template de planos novos. | Sim — `generateTemplate()` |
| `src/plan-format-validator.ts` | Valida se `**Status:**`/`**Date:**`/`**Updated_at:** 2026-07-16T03:33:17.329Z
| `src/plan-backlog-sync.ts` | `syncBacklogToPlan()` escreve status via regex própria, **sem passar pelo engine** — hoje é cega a YAML | Sim — reescrever pra delegar ao engine |
| `src/commands/plan.ts` | `runPrepare()` (`format_header`) insere campos bold quando "faltam" — hoje duplicaria campos num plano YAML | Sim — checar YAML antes de inserir |
| `src/context-rules.ts`, `governance-enforcement-detectors.ts`, `audit/doc-lifecycle/auditor.ts`, `mcp-server-handlers.ts` | Usam `**Campo:**` pra **regras**, **relatórios de auditoria** e **saída do MCP** — documentos diferentes, não planos | **Não** — fora de escopo, não tocar |

---

## 2. `markdown-plan-engine.ts` — template passa a gerar YAML

```typescript
// generateTemplate() — trocar o header bold-field pelo bloco YAML

private generateTemplate(input: CreatePlanInput & { id: string; createdAt: string }): string {
  const { title, description, priority, estimatedTime, owner, content, createdAt } = input;

  const frontmatter = stringifyYaml({
    status: "andamento",
    date: createdAt.split("T")[0],
    priority: priority || "P1",
    owner: owner || "AI Agent",
    estimated_time: estimatedTime || "TBD",
    updated_at: createdAt,
  }).trimEnd();

  return `---
${frontmatter}
---

# ${title}

## Context

${description || "TBD"}

---

## Steps

### Step 1: TBD

| # | Action | Verification |
|---|--------|--------------|
| 1.1 | TBD | TBD |

---

## Notes

${content || ""}
`;
}
```

`stringifyYaml` já foi importado no arquivo na correção anterior (`import { parse as parseYaml, stringify as stringifyYaml } from "yaml"`) — nenhuma dependência nova.

---

## 3. `plan-format-validator.ts` — reconhecer bloco YAML como válido

Hoje as 3 primeiras regras (`HEADER_STATUS`, `HEADER_DATE`, `HEADER_UPDATED`) procuram literalmente `^\*\*Status:\*\*` etc. Um plano YAML válido reprovaria nessas 3 regras. Fix: checar o bloco YAML primeiro; só aplicar as regras de texto se não houver bloco.

```typescript
import { parse as parseYaml } from "yaml";

// dentro de validatePlanFormat(), antes da Rule 1:

const yamlBlockMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
let yamlFields: Record<string, unknown> | null = null;
if (yamlBlockMatch && yamlBlockMatch[1]) {
  try {
    const parsed = parseYaml(yamlBlockMatch[1]);
    if (parsed && typeof parsed === "object") yamlFields = parsed as Record<string, unknown>;
  } catch {
    // bloco malformado — trata como se não existisse, cai nas regras de texto abaixo
  }
}

// Rule 1: **Status:** present
const hasStatus = yamlFields ? "status" in yamlFields : lines.some((l) => l.match(/^\*\*Status:\*\*/));
if (!hasStatus) {
  // ...(mensagem de erro permanece igual)
}

// Rule 2: **Date:** present
const hasDate = yamlFields ? "date" in yamlFields : lines.some((l) => l.match(/^\*\*Date:\*\*/));
if (!hasDate) {
  // ...
}

// Rule 3: **Updated_at:** present
const hasUpdated = yamlFields ? "updated_at" in yamlFields : lines.some((l) => l.match(/^\*\*Updated_at:\*\*/));
if (!hasUpdated) {
  // ...
}
```

As mensagens de erro/fix (`"Adicionar '**Status:** Pending'..."`) ficam tecnicamente erradas pra um plano YAML — mas só aparecem quando o campo falta mesmo, incluindo dentro do bloco YAML, então o "fix" sugerido deveria mencionar as duas formas. Ajuste de texto, não de lógica:

```typescript
fix: yamlFields !== null
  ? "Adicionar 'status: Pending' ao bloco YAML no topo do arquivo"
  : "Adicionar '**Status:** Pending' após o título",
```

---

## 4. `plan-backlog-sync.ts` — parar de duplicar a lógica de escrita

Esta é a mudança mais importante das quatro. `syncBacklogToPlan()` escreve `**Status:**`/`**Updated_at:**` direto no arquivo, com sua própria regex, sem passar pelo `MarkdownPlanEngine`. Isso é o mesmo problema que já resolvemos no engine, só que duplicado num segundo lugar — se eu só mexesse no engine, esse arquivo continuaria cego a YAML e o BACKLOG.md pararia de sincronizar silenciosamente com planos no novo formato.

Fix correto: não duplicar a lógica de novo (nem em versão YAML-aware) — delegar pro engine, que já sabe fazer isso direito:

```typescript
// plan-backlog-sync.ts

import { MarkdownPlanEngine, type MarkdownPlanStatus } from "./markdown-plan-engine.js";

export function syncBacklogToPlan(
  shitenDir: string,
  planId: string,
  backlogStatus: string
): void {
  const statusMap: Record<string, MarkdownPlanStatus> = {
    "concluído": "done",
    "em implementação": "andamento",
    "pausado": "parado",
    "planeado": "andamento",
  };

  const planStatus = statusMap[backlogStatus] || "andamento";

  const engine = new MarkdownPlanEngine(shitenDir);
  try {
    withSyncWriteGuard(() => {
      markPlanWritten(planId);
      engine.updateStatus(planId, planStatus);
    });
    logger.info("plan-backlog-sync", `Updated plan ${planId} status to ${planStatus}`);
  } catch (error) {
    logger.warn("plan-backlog-sync", `Failed to sync plan ${planId}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

Ganho colateral: `updateStatus()` já publica o evento `plan.archived` e já move o arquivo pra `done/` quando o status vira `done` — coisa que a versão antiga de `syncBacklogToPlan` **não fazia** (só escrevia `**Status:** Done` no texto, sem mover o arquivo). Ou seja, isso não é só compatibilizar com YAML, é corrigir um segundo bug de sincronização que existia independente disso.

---

## 5. `commands/plan.ts` — `format_header` não deve duplicar campos já presentes em YAML

```typescript
// runPrepare() — Step 1: Format header

try {
  let content = readFileSync(plan.filePath, "utf-8");
  let updated = false;

  const hasYamlBlock = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.test(content);

  if (!hasYamlBlock) {
    // formato legado — mesma lógica de antes, inalterada
    if (!content.match(/\*\*Status:\*\*/)) {
      const titleLine = content.split("\n").findIndex((l) => l.startsWith("# "));
      if (titleLine !== -1) { const lines = content.split("\n"); lines.splice(titleLine + 2, 0, "", "**Status:** Pending"); content = lines.join("\n"); updated = true; }
    }
    if (!content.match(/\*\*Date:\*\*/)) {
      const statusLine = content.split("\n").findIndex((l) => l.match(/\*\*Status:\*\*/));
      if (statusLine !== -1) { const lines = content.split("\n"); lines.splice(statusLine + 1, 0, `**Date:** ${new Date().toISOString().slice(0, 10)}`); content = lines.join("\n"); updated = true; }
    }
    if (!content.match(/\*\*Updated_at:\*\*/)) {
      const lastField = content.split("\n").findIndex((l) => l.match(/^\*\*[A-Z]/));
      if (lastField !== -1) { const lines = content.split("\n"); lines.splice(lastField + 1, 0, `**Updated_at:** ${new Date().toISOString()}`); content = lines.join("\n"); updated = true; }
    }
  }
  // se hasYamlBlock === true, os campos já vivem lá — nada a inserir.

  if (updated) { writeFileSync(plan.filePath, content, "utf-8"); results.push({ step: "format_header", status: "done", detail: "Header formatted to shiten standard" }); }
  else { results.push({ step: "format_header", status: "skip", detail: hasYamlBlock ? "YAML frontmatter present" : "Header already conformant" }); }
} catch (error) { results.push({ step: "format_header", status: "error", detail: String(error) }); }
```

---

## 6. Planos já existentes — migração é opcional, não obrigatória

Como o parser é aditivo (lê os dois formatos), **nenhum plano existente precisa ser migrado pra continuar funcionando.** Se você quiser mesmo assim converter o histórico pra YAML por consistência, dá pra fazer com um comando pontual, não com mudança de comportamento automática silenciosa (auto-reescrever arquivo do usuário sem ele pedir é o tipo de coisa que gera susto/diff estranho no git):

```typescript
// novo: src/commands/plan/md-migrate.ts (esboço)
// shiten plan md migrate <id> — converte um plano do formato bold-field pro YAML

export function registerMdMigrate(cmd: Command) {
  cmd
    .command("migrate")
    .description("Convert a plan's header from **Field:** text to YAML frontmatter")
    .argument("<id>", "Plan ID")
    .action((id: string) => {
      // 1. Ler o plano via engine.getById(id)
      // 2. Extrair os campos já reconhecidos em `plan.metadata`
      // 3. Gerar bloco YAML com stringifyYaml(plan.metadata)
      // 4. Remover as linhas **Field:** do corpo, inserir o bloco YAML no topo
      // 5. writeFileSync
    });
}
```

Detalho essa parte só como esboço porque, dado que você mesmo disse que ainda está em fase de validação e não de uso pesado, migrar plano por plano manualmente conforme for mexendo neles é suficiente — não precisa de ferramenta de migração em massa agora.

---

## 7. Ordem sugerida e risco

| Passo | Arquivo | Risco | Depende de |
|---|---|---|---|
| 1 | `markdown-plan-engine.ts` (leitura/escrita YAML) | Já feito | — |
| 2 | `plan-format-validator.ts` | Baixo — só amplia o que já é aceito | 1 |
| 3 | `plan-backlog-sync.ts` | Médio — muda o caminho de escrita, mas corrige bug real de não mover pra `done/` | 1 |
| 4 | `commands/plan.ts` (`format_header`) | Baixo — só evita duplicar campo | 1 |
| 5 | `generateTemplate()` (template default → YAML) | Baixo, mas é o que faz todo plano **novo** nascer no formato certo | 1-4 prontos |

Fazer o passo 5 (mudar o template) só depois dos passos 2-4 é proposital: se o template mudar primeiro e a validação/sync ainda não entenderem YAML, todo plano novo criado nesse intervalo falharia validação ou pararia de sincronizar com o BACKLOG — exatamente o tipo de regressão que essa migração deveria evitar, não causar.
