/**
 * handbook/data/topic-registry.ts — Static topic definitions for the handbook
 */

import type { HandbookTopic } from "../types.js";

export const TOPIC_REGISTRY: HandbookTopic[] = [
  // Level 1 — Fundamentals
  { id: "what-is-shugo", level: 1, levelName: "Fundamentos", title: "O que e Shugo", description: "Definicao, problema que resolve, para quem serve", file: "01-fundamentals/what-is-shugo.md" },
  { id: "installation", level: 1, levelName: "Fundamentos", title: "Instalacao", description: "Pre-requisitos, metodos de instalacao, verificacao", file: "01-fundamentals/installation.md" },
  { id: "quick-start", level: 1, levelName: "Fundamentos", title: "Primeiros Passos", description: "Init, status, detect, briefing, feedback", file: "01-fundamentals/quick-start.md" },
  { id: "concepts", level: 1, levelName: "Fundamentos", title: "Conceitos", description: "Maturity, capabilities, governance, knowledge debt", file: "01-fundamentals/concepts.md" },

  // Level 2 — Commands
  { id: "setup", level: 2, levelName: "Comandos", title: "Setup & Config", description: "init, mcp, upgrade, clean", file: "02-commands/setup.md" },
  { id: "analysis", level: 2, levelName: "Comandos", title: "Status & Analise", description: "status, audit, doctor, assess, detect", file: "02-commands/analysis.md" },
  { id: "pipeline", level: 2, levelName: "Comandos", title: "Pipeline & Execucao", description: "run, evolve, act, plan", file: "02-commands/pipeline.md" },
  { id: "governance", level: 2, levelName: "Comandos", title: "Governanca", description: "goal, decide, policy", file: "02-commands/governance.md" },
  { id: "reports", level: 2, levelName: "Comandos", title: "Relatorios", description: "console, report, digest, bench", file: "02-commands/reports.md" },
  { id: "ai-integration", level: 2, levelName: "Comandos", title: "Integracao AI", description: "briefing, feedback, profile, dashboard, reminders", file: "02-commands/ai-integration.md" },
  { id: "system", level: 2, levelName: "Comandos", title: "Sistema", description: "validate, shell-init", file: "02-commands/system.md" },
  { id: "documentation", level: 2, levelName: "Comandos", title: "Documentacao", description: "docs-audit", file: "02-commands/documentation.md" },

  // Level 3 — Architecture
  { id: "event-system", level: 3, levelName: "Arquitetura", title: "Sistema de Eventos", description: "Event bus, tipos de eventos, subscribe/publish", file: "03-architecture/event-system.md" },
  { id: "rule-engine", level: 3, levelName: "Arquitetura", title: "Rule Engine", description: "Regras reativas, triggers, como criar regras", file: "03-architecture/rule-engine.md" },
  { id: "mcp-server", level: 3, levelName: "Arquitetura", title: "MCP Server", description: "Protocolo MCP, configuracao, uso com AI agents", file: "03-architecture/mcp-server.md" },
  { id: "custom-rules", level: 3, levelName: "Arquitetura", title: "Regras Customizadas", description: "Como criar regras proprias", file: "03-architecture/custom-rules.md" },
  { id: "contributing", level: 3, levelName: "Arquitetura", title: "Contribuindo", description: "Guia para contribuidores", file: "03-architecture/contributing.md" },
];
