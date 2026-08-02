---
category: product
lifecycle: Active
---

# Conceitos

> Entenda os conceitos fundamentais do Shugo.

---

## Maturity Profile

O **Perfil de Maturidade** mede o nível de maturidade do seu projeto em 7 dimensões:

| Dimensão | O que mede | Exemplo de melhoria |
|---|---|---|
| **Architecture** | Estrutura e organização do código | Adotar ADRs, modularizar |
| **Governance** | Regras e processos documentados | Criar workflows, contratos |
| **Quality** | Testes, linting, validação | Adicionar testes E2E, CI |
| **Automation** | Scripts, CI/CD, hooks | Criar scripts de deploy |
| **AI** | Integração com agentes AI | Configurar MCP, prompts |
| **Documentation** | Documentação viva e atualizada | Criar runbooks, skills |
| **Observabilidade** | Métricas, relatórios, dashboards | Implementar logging |

Cada dimensão recebe um score de 0-100:

```
Architecture:    ████████░░ 80%
Governance:      ██████░░░░ 60%
Quality:         ███████░░░ 70%
Automation:      ████░░░░░░ 40%
AI:              ██░░░░░░░░ 20%
Documentation:   █████░░░░░ 50%
Observability:   ███░░░░░░░ 30%

Overall: 50/100
```

O **Overall** é a média ponderada de todas as dimensões.

---

## Capabilities

**Capabilities** são módulos funcionais que o Shugo instala progressivamente:

| Capability | O que inclui | Quando instala |
|---|---|---|
| **core** | Config base, opencode.json, workspace | Sempre (init) |
| **knowledge** | Skills, AGENTS.md expandido | Maturidade >= 30 |
| **architecture** | ADRs, SDRs, planos de tarefa | Maturidade >= 40 |
| **governance** | Contratos de agent, workflows | Maturidade >= 50 |
| **ai** | Agentes AI, prompts, orquestração | Maturidade >= 60 |
| **quality** | Validação, health checks, testes | Maturidade >= 40 |
| **metrics** | Relatórios, scoring, complexidade | Maturidade >= 50 |
| **operations** | Scripts, sessões, runbooks | Maturidade >= 45 |
| **compliance** | FORBIDDEN_OPERATIONS, DESDO | Maturidade >= 70 |

Cada capability depende do **core**. Instale mais capabilities com:

```bash
shugo upgrade --capability architecture
shugo upgrade --accept-recommended  # Instala todas as recomendadas
```

---

## Engineering State

O **Estado de Engenharia** é a consolidação de todos os dados do projeto:

```json
{
  "consolidatedAt": "2026-07-11T10:00:00Z",
  "lifecycle": "evolved",
  "project": {
    "name": "meu-projeto",
    "root": "/caminho/absoluto",
    "stack": ["typescript", "react"],
    "hasGit": true,
    "hasTests": true,
    "packageCount": 3,
    "sourceFileCount": 47
  },
  "maturity": {
    "overall": 50,
    "architecture": 80,
    "governance": 60
  },
  "healthScores": {
    "overall": 85,
    "knowledgeDebt": 90
  },
  "entropy": {
    "orphanedAssets": 2,
    "staleAssets": 1,
    "score": 15
  }
}
```

O estado é consolidado periodicamente e servido via cache.

---

## Context Pipeline

O **Context Pipeline** é o ciclo de vida do contexto de IA:

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│ COLLECT │───▶│  CACHE  │───▶│GENERATE │
└─────────┘    └─────────┘    └─────────┘
                                  │
                                  ▼
┌─────────┐    ┌─────────┐    ┌─────────┐
│ FEEDBACK│◀───│  OUTPUT │◀───│  DIFF   │
└─────────┘    └─────────┘    └─────────┘
```

1. **Collect** — Coleta fingerprint, risk map, regras, maturidade
2. **Cache** — Compara hash de inputs; se igual, usa cache
3. **Generate** — Gera briefing baseado no profile (minimal/standard/full)
4. **Diff** — Mostra diferenças entre briefings anteriores
5. **Output** — Exibe, escreve em arquivo, ou retorna JSON
6. **Feedback** — Registra outcome da sessão para melhorar próximos briefings

### Profundidade do Briefing

| Profile | Tokens | Quando usar |
|---|---|---|
| `minimal` | ~200 | Resumo rápido, sessões curtas |
| `standard` | ~500 | Uso diário (padrão) |
| `full` | ~1000 | Sessões complexas, arquitetura |

---

## Knowledge Debt

**Knowledge Debt** é o custo invisível de conhecimento:

- **Documentado mas não verificado** — Documento que ninguém atualiza há meses
- **Conhecido mas não documentado** — Alguém sabe, mas não está escrito
- **Documentado mas desconectado** — Existe, mas ninguém sabe onde procurar
- **Desatualizado** — Documento que não reflete o estado atual

O Shugo mede Knowledge Debt via:

- **healthScores.knowledgeDebt** — Score de 0-100 (100 = sem dívida)
- **entropy.orphanedAssets** — Ativos órfãos (sem referência)
- **entropy.staleAssets** — Ativos desatualizados

Reduza Knowledge Debt:

```bash
shugo audit              # Identifica problemas
shugo doctor             # Sugere melhorias
shugo docs-audit --apply # Organiza documentação
```

---

## Event System

O **Sistema de Eventos** é o coração reativo do Shugo:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  File Watch │────▶│  Event Bus  │────▶│ Rule Engine │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   History   │
                    └─────────────┘
```

- **File Watcher** — Detecta mudanças em arquivos
- **Event Bus** — Publica e distribui eventos
- **Rule Engine** — Reage a eventos com ações
- **History** — Registra eventos para análise

Exemplo:

```
Evento: plan.created
  → File Watcher detecta novo .md em governance/plans/
  → Publica "plan.created" no Event Bus
  → Rule Engine recebe evento
  → RULE-020 reage: cria reminder + registra em history
```

---

## Lifecycle States

O Shugo rastreia o estado de vida do projeto:

```
uninitialized → discovered → assessed → governed → evolved
```

| Estado | Significado |
|---|---|
| `uninitialized` | Shugo não inicializado |
| `discovered` | Projeto analisado, estrutura criada |
| `assessed` | Maturidade avaliada |
| `governed` | Governança ativa (regras, workflows) |
| `evolved` | Sistema maduro, auto-governado |

---

## Próximo passo

→ [Nível 2: Comandos](../02-commands/) — Referência completa de todos os comandos
