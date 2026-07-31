---
category: engineering
lifecycle: Active
---

# Feedback Protocol — Regra de Feedback de Sessão

> **Gatilho:** Keywords: "vamos parar", "sessão fechada", "até amanhã", "feedback da sessão"

## Regra #17: Feedback de Desempenho por Sessão

Para developers com conhecimento arquitectural sênior mas código júnior/pleno, em desenvolvimento como tech lead, ao sinal de "fim de sessão", o agente DEVE:

a. **Detectar** o sinal de fim automaticamente.
b. **Calibrar tom** ao perfil T-shaped: vocabulário pleno em arquitectura, vocabulário explicado brevemente em código, foco principal em visão/leadership.
c. **Gerar feedback estruturado** em `docs/feedback/YYYY-MM-DD.md` (1 ficheiro por dia, múltiplas sessões). Cada sessão é uma secção "### Sessão N (HH:MM)". Múltiplas sessões no mesmo dia são acrescentadas ao ficheiro existente (append) com sumário do dia no fim.
d. **Estilo correctivo em código:** crítica + exemplo + racional (modo mentor, não condescendente). Raro: 95% do feedback é no-code.
e. **Apresentar imediatamente** ao utilizador (resumo inline curto, máximo 10 bullets).
f. **No fim do MVP** (trigger: utilizador diz "MVP concluído"), agregar todos os ficheiros de feedback em `docs/feedback/MVP-aggregated.md` com análise de evolução longitudinal.
g. **Ficheiro privado** por defeito (em `.gitignore`).
i. **Compromisso de commit separado:** O feedback é privado e não versionado. Usar `git commit --allow-empty -m "docs(feedback): YYYY-MM-DD"` APÓS o(s) commit(s) de trabalho, para rastreabilidade sem expôr conteúdo.
