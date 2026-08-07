import type { Capability } from "./engineering-state.js";

export interface CapabilityInfo {
  id: Capability;
  name: string;
  description: string;
  dimensions: Partial<Record<string, number>>;
  alwaysInstalled: boolean;
  requires: Capability[];
}

export const CAPABILITIES: CapabilityInfo[] = [
  {
    id: "core",
    name: "Core",
    description: "Núcleo essencial — configuração base, opencode.json, workspace",
    dimensions: {},
    alwaysInstalled: true,
    requires: [],
  },
  {
    id: "knowledge",
    name: "Knowledge",
    description: "Skills de engenharia, AGENTS.md, guias de referência",
    dimensions: { documentation: 0.4, quality: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "architecture",
    name: "Architecture",
    description: "ADRs, SDRs, planos de tarefa, documentação arquitetural",
    dimensions: { architecture: 0.4, documentation: 0.2 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "governance",
    name: "Governance",
    description: "Workflows, SYSTEM_MAP, context buffer, handoffs",
    dimensions: { governance: 0.5, documentation: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "ai",
    name: "AI",
    description: "Contratos de agentes IA, prompts, orquestração, cognição",
    dimensions: { ai: 0.5, governance: 0.2 },
    alwaysInstalled: false,
    requires: ["governance"],
  },
  {
    id: "quality",
    name: "Quality",
    description: "Validação de sessão, health checks, sessões estruturadas",
    dimensions: { quality: 0.4, automation: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "metrics",
    name: "Metrics",
    description: "Relatórios de complexidade, scoring, telemetria de maturidade",
    dimensions: { observability: 0.4, quality: 0.1 },
    alwaysInstalled: false,
    requires: ["quality"],
  },
  {
    id: "operations",
    name: "Operations",
    description: "Scripts de sessão, runbooks, close-session, premortem",
    dimensions: { automation: 0.4, governance: 0.1 },
    alwaysInstalled: false,
    requires: ["core"],
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "FORBIDDEN_OPERATIONS, DESDO, reviews obrigatórias, premortem",
    dimensions: { governance: 0.3, quality: 0.2 },
    alwaysInstalled: false,
    requires: ["governance"],
  },
];
