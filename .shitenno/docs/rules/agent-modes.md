---
category: engineering
lifecycle: Active
---

# Agent Modes — Regras de Modo Plan/Build/Review

> **Gatilho:** agent=plan, agent=build, agent=review

## Regra #14: Validação de Plano em Modo Review

Quando o agente opera em modo `review` (definido em `opencode.json` no agent `review`), DEVE SEMPRE validar que o trabalho executado corresponde ao plano aprovado pelo usuário.

**Protocolo obrigatório:**
a. **Tabela de conformidade:** Listar cada step do plano (1, 2, 3, ...) com estado (✅/⚠️/❌) e evidência objetiva (diff, linha, contagem, output de comando).
b. **Métricas vs. plano:** Comparar números declarados (linhas removidas, testes adicionados, ficheiros tocados) com números reais via `git diff --stat`, `wc -l`, `pnpm test`.
c. **Desvios explícitos:** Sinalizar qualquer step não executado, item perdido na poda, decisão tomada sem autorização (especialmente G-01).
d. **Planos arquivados:** Se o plano está em `governance/plans/YYYY-MM-DD-<task>.md`, comparar os checkboxes preenchidos pelo build contra o `git diff` real e a sequência de commits.
e. **Acções de follow-up:** Listar itens pendentes, reversões possíveis, próximos passos. **Output é vinculante** — bloqueia avanço se não for entregue.

## Regra #15: Plano Fragmentado em Modo Plan

Quando o agente opera em modo `plan` (definido em `opencode.json` no agent `plan`), DEVE SEMPRE produzir planos atómicos e fragmentados, optimizados para o modelo executor atribuído.

**Protocolo obrigatório:**
a. **Steps atómicos:** Cada step = 1 acção primária (1 Edit, 1 sed, 1 write) + 1 verificação explícita (grep, wc, cat). Nunca batchar múltiplas acções num único step.
b. **Texto exacto:** Usar `oldString`/`newString` literais (não paráfrases) com hashes, paths, e valores numéricos. Incluir `grep` de verificação após cada step.
c. **Salvaguardas S1..S6:** Listar apólices anti-esquecimento (não fundir, não tocar código não-planeado, não avançar com falha, G-01 explícito, não duplicar, não tocar docs não-planeado).
d. **Pontos de pausa G-01:** Marcar `**PARAR e pedir autorização**` antes de qualquer `git commit` ou operação irreversível. Comandos seguintes ficam em standby.
e. **Path canónico:** Planos com ≥ 5 steps ou ≥ 2 ficheiros afectados são arquivados em `governance/plans/YYYY-MM-DD-<slug>.md` usando o template em `governance/plans/TEMPLATE.md`. O ficheiro contém checkboxes que o build vai preenchendo.
f. **Métricas-alvo:** Declarar ranges (ex: "target 38-48 linhas, tolerância ±5"). Output pós-execução tem de bater o range; se bater, OK; se não, **reportar desvio**.

## Regra #16: Execução Literal em Modo Build

Quando o agente opera em modo `build` (definido em `opencode.json` no agent `build`), DEVE executar o plano aprovado de forma **literal e atómica**, sem decisões autónomas.

**Protocolo obrigatório:**
a. **Sem improviso:** NÃO refactorar, NÃO adicionar JSDoc, NÃO renomear, NÃO corrigir bugs adjacentes, NÃO adicionar testes extra. Executa APENAS o que o `oldString`/`newString` do step diz.
b. **Detecção de desvio:** Antes de cada Edit/sed, confirma: "este step está dentro do que planeei?" Se o step exigir uma mudança não-planeada, **PARA** e reporta ao utilizador. Nunca inventar conteúdo.
c. **Excepções mínimas permitidas:** (1) Ajustes triviais para o build passar (import em falta, tipo errado, formato de path) — desde que sejam < 5 linhas e não alterem semântica. (2) Registar achados fora-do-plano no `governance/context/context_buffer.yaml` secção `technical_debt` para revisão posterior.
d. **Comunicação com Plan/Review:** Se o plano está em `governance/plans/YYYY-MM-DD-<task>.md`, o build actualiza checkboxes conforme avança. O review compara diff real vs. template (ver regra #12).
e. **Em caso de dúvida:** PARAR. O executor pode ser rápido mas esquecer passos. Melhor interromper e perguntar do que improvisar e criar drift técnico.
f. **Respeitar modelo do step:** O executor DEVE usar exactamente o modelo indicado no campo `[Modelo]` de cada step do plano. Violações configuram G-05 em FORBIDDEN_OPERATIONS.md.
