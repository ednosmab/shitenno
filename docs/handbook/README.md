# 📚 Shugo Handbook

> Manual de referência do Shitenno — do básico à arquitetura interna.

---

## Como usar este handbook

O handbook é organizado em **3 níveis de abstração**, do mais simples ao mais técnico:

| Nível | Para quem | Conteúdo |
|---|---|---|
| **[1. Fundamentos](01-fundamentals/)** | Developers iniciantes, PMs, qualquer pessoa | O que é Shugo, instalação, primeiros passos, conceitos |
| **[2. Comandos](02-commands/)** | Developers, tech leads | Referência completa dos 35+ comandos CLI |
| **[3. Arquitetura](03-architecture/)** | Tech leads, architects, contribuidores | Event system, rule engine, MCP, custom rules |

---

## Nível 1 — Fundamentos

Comece aqui se você é novo no Shugo.

| Arquivo | Conteúdo |
|---|---|
| [What Is Shugo](01-fundamentals/what-is-shugo.md) | Definition, problem it solves, who it's for |
| [Instalação](01-fundamentals/installation.md) | Pré-requisitos, métodos de instalação, verificação |
| [Primeiros Passos](01-fundamentals/quick-start.md) | Init, status, detect, briefing, feedback |
| [Conceitos](01-fundamentals/concepts.md) | Maturity, capabilities, governance, knowledge debt |

---

## Nível 2 — Comandos

Referência completa de todos os comandos, organizados por categoria.

| Arquivo | Categoria |
|---|---|
| [Setup & Config](02-commands/setup.md) | init, mcp, upgrade, clean |
| [Status & Análise](02-commands/analysis.md) | status, audit, doctor, assess, detect |
| [Pipeline & Execução](02-commands/pipeline.md) | run, evolve, act, plan |
| [Governança](02-commands/governance.md) | goal, decide, policy |
| [Relatórios](02-commands/reports.md) | console, report, digest, bench |
| [Integração AI](02-commands/ai-integration.md) | briefing, feedback, profile, dashboard, reminders |
| [Sistema](02-commands/system.md) | validate, shell-init |
| [Documentação](02-commands/documentation.md) | docs-audit |

---

## Nível 3 — Arquitetura

Para quem quer entender como Shugo funciona por dentro ou contribuir.

| Arquivo | Conteúdo |
|---|---|
| [Sistema de Eventos](03-architecture/event-system.md) | Event bus, tipos de eventos, subscribe/publish |
| [Rule Engine](03-architecture/rule-engine.md) | Regras reativas, triggers, como criar regras |
| [MCP Server](03-architecture/mcp-server.md) | Protocolo MCP, configuração, uso com AI agents |
| [Regras Customizadas](03-architecture/custom-rules.md) | Como criar regras próprias |
| [Contribuindo](03-architecture/contributing.md) | Guia para contribuidores |

---

## Acesso rápido via CLI

```bash
shugo handbook              # Abre este handbook no terminal
shugo handbook --level 1    # Apenas fundamentos
shugo handbook --level 2    # Apenas comandos
shugo handbook --level 3    # Apenas arquitetura
shugo handbook --topic init # Busca por tópico específico
```

---

## Estatísticas

- **35+ comandos** documentados
- **9 categorias** de comandos
- **9 capabilities** modulares
- **7 dimensões** de maturidade
- **6 princípios** imutáveis

---

*Última atualização: Julho 2026*
