/**
 * insight-rules.ts — Insight Rules for Semantic Reasoning
 *
 * Each rule defines a condition that, when met, produces a SemanticInsight.
 * Rules are evaluated in order; multiple insights can fire simultaneously.
 *
 * PRINCIPLE: Rules are deterministic — same input always yields same output.
 */

import type { SemanticDomain } from "./taxonomy.js";
import type { SemanticInsight, ReasonerContext } from "./reasoner.js";
import type { Evidence } from "./evidence-collector.js";

export interface InsightRule {
  type: SemanticInsight["type"];
  name: string;
  condition: (ctx: ReasonerContext, evidence: Evidence[]) => SemanticInsight | null;
}

export const INSIGHT_RULES: InsightRule[] = [
  // ── Architecture Evolution ────────────────────────────────────────────
  {
    type: "architecture_evolution",
    name: "Evolução Arquitetural",
    condition: (ctx, evidence) => {
      const archPatterns = ctx.patterns.filter((p) => p.type === "architectural_shift");
      if (archPatterns.length === 0) return null;

      const domains = [...new Set(archPatterns.map((p) => p.domain))];
      const avgConfidence = archPatterns.reduce((sum, p) => sum + p.confidence, 0) / archPatterns.length;

      return {
        id: `ae-${Date.now()}`,
        type: "architecture_evolution",
        domains: domains as SemanticDomain[],
        description: `${archPatterns.length} mudança(s) arquitetural(is) detectada(s) em: ${domains.join(", ")}`,
        confidence: avgConfidence,
        evidence,
        suggestedActions: [
          "Documentar decisões arquiteturais como ADRs",
          "Rever coerência entre domínios afectados",
          "Avaliar impacto em testes e documentação",
        ],
        priority: archPatterns.length >= 2 ? "high" : "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: archPatterns.map((p) => p.id),
      };
    },
  },

  // ── Security Posture Change ───────────────────────────────────────────
  {
    type: "security_posture_change",
    name: "Mudança de Postura de Segurança",
    condition: (ctx, evidence) => {
      const secPatterns = ctx.patterns.filter(
        (p) => p.type === "security_degradation" || p.domain === "security"
      );
      if (secPatterns.length === 0) return null;

      const hasHighRisk = evidence.some(
        (e) => e.source === "risk" && (e.data.level === "high" || e.data.level === "critical")
      );

      return {
        id: `spc-${Date.now()}`,
        type: "security_posture_change",
        domains: ["security", "authentication"],
        description: `Postura de segurança alterada — ${secPatterns.length} padrão(ões) com ${hasHighRisk ? "risco elevado" : "sinais de degradação"}`,
        confidence: Math.min(secPatterns.reduce((sum, p) => sum + p.confidence, 0) / secPatterns.length + (hasHighRisk ? 0.1 : 0), 1),
        evidence,
        suggestedActions: [
          "Executar audit de segurança",
          "Rever dependências vulneráveis",
          "Verificar testes de segurança",
        ],
        priority: hasHighRisk ? "urgent" : "high",
        detectedAt: new Date().toISOString(),
        sourcePatterns: secPatterns.map((p) => p.id),
      };
    },
  },

  // ── Scope Expansion ──────────────────────────────────────────────────
  {
    type: "scope_expansion",
    name: "Expansão de Escopo",
    condition: (ctx, evidence) => {
      const driftPatterns = ctx.patterns.filter((p) => p.type === "scope_drift");
      if (driftPatterns.length === 0) return null;

      const domains = driftPatterns.flatMap((p) => p.domains);

      return {
        id: `se-${Date.now()}`,
        type: "scope_expansion",
        domains: domains as SemanticDomain[],
        description: `Escopo do projecto a expandir — ${driftPatterns.length} domínio(s) novo(s) detectado(s)`,
        confidence: driftPatterns[0]?.confidence ?? 0.5,
        evidence,
        suggestedActions: [
          "Rever limites de domínio do projecto",
          "Avaliar se novos módulos são necessários",
          "Documentar mudanças de escopo",
        ],
        priority: "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: driftPatterns.map((p) => p.id),
      };
    },
  },

  // ── Maturity Mismatch ────────────────────────────────────────────────
  {
    type: "maturity_mismatch",
    name: "Incompatibilidade de Maturidade",
    condition: (_ctx, evidence) => {
      const maturityEvidence = evidence.filter((e) => e.source === "maturity");
      if (maturityEvidence.length === 0) return null;

      const lowMaturity = maturityEvidence.filter((e) => {
        const score = e.data.score as number;
        return score !== undefined && score < 40;
      });

      if (lowMaturity.length === 0) return null;

      const domains = lowMaturity.map((e) => e.data.domain as string).filter(Boolean);

      return {
        id: `mm-${Date.now()}`,
        type: "maturity_mismatch",
        domains: domains as SemanticDomain[],
        description: `Maturidade baixa em ${lowMaturity.length} dimensão(ões): ${domains.join(", ")}`,
        confidence: 0.7,
        evidence,
        suggestedActions: [
          "Melhorar capabilities nas dimensões baixas",
          "Adicionar testes e documentação",
          "Considerar upgrade de maturidade",
        ],
        priority: "high",
        detectedAt: new Date().toISOString(),
        sourcePatterns: [],
      };
    },
  },

  // ── Debt Accumulation ────────────────────────────────────────────────
  {
    type: "debt_accumulation",
    name: "Acumulação de Dívida",
    condition: (ctx, evidence) => {
      const debtPatterns = ctx.patterns.filter((p) => p.type === "tech_debt_accumulation");
      if (debtPatterns.length === 0) return null;

      const healthEvidence = evidence.filter((e) => e.source === "health");
      const lowHealth = healthEvidence.some((e) => {
        const score = e.data.score as number;
        return score !== undefined && score < 50;
      });

      return {
        id: `da-${Date.now()}`,
        type: "debt_accumulation",
        domains: debtPatterns[0]?.domains as SemanticDomain[] ?? ["governance"],
        description: `Dívida técnica a acumular — ${lowHealth ? "saúde do conhecimento baixa" : "padrões de degradação detectados"}`,
        confidence: debtPatterns[0]?.confidence ?? 0.5,
        evidence,
        suggestedActions: [
          "Dedicar sprint de qualidade",
          "Rever e actualizar documentação",
          "Adicionar testes para código não testado",
        ],
        priority: lowHealth ? "high" : "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: debtPatterns.map((p) => p.id),
      };
    },
  },

  // ── Governance Gap ───────────────────────────────────────────────────
  {
    type: "governance_gap",
    name: "Gap de Governance",
    condition: (ctx, evidence) => {
      const capGaps = ctx.patterns.filter((p) => p.type === "capability_gap");
      if (capGaps.length === 0) return null;

      const domains = capGaps.map((p) => p.domain);

      return {
        id: `gg-${Date.now()}`,
        type: "governance_gap",
        domains: domains as SemanticDomain[],
        description: `Gaps de governance em: ${domains.join(", ")}`,
        confidence: capGaps.reduce((sum, p) => sum + p.confidence, 0) / capGaps.length,
        evidence,
        suggestedActions: [
          "Instalar capabilities necessárias",
          "Rever maturidade do projecto",
          "Executar shugo audit",
        ],
        priority: "medium",
        detectedAt: new Date().toISOString(),
        sourcePatterns: capGaps.map((p) => p.id),
      };
    },
  },
];
