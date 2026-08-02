/**
 * semantic-dual-path-presenter.ts — Semantic Dual Path Presentation
 *
 * Formats detected semantic patterns into dual path presentations
 * (comfortable vs challenging) with growth-aware adaptation.
 *
 * PRINCIPLE: The system shows Path A (comfortable) and Path B (challenging)
 * for each detected pattern, adapting based on the user's growth profile.
 */

import chalk from "chalk";
import type { DetectedPattern, PatternType } from "./pattern-rules.js";
import type { SemanticGrowthProfile } from "./growth-profile.js";
import { getDomainChallengeLevel } from "./growth-profile.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SemanticPathOption {
  label: string;
  description: string;
  action: string;
  effort: "none" | "low" | "medium" | "high";
  growthBenefit?: string;
}

export interface SemanticDualPath {
  pattern: DetectedPattern;
  pathA: SemanticPathOption;
  pathB: SemanticPathOption;
  challengeLevel: number;
  domainLevel: number;
}

// ── Path Templates ──────────────────────────────────────────────────────────

const PATH_TEMPLATES: Record<PatternType, { comfortable: Omit<SemanticPathOption, "growthBenefit">; challenging: Omit<SemanticPathOption, "effort"> }> = {
  architectural_shift: {
    comfortable: {
      label: "Registrar para revisão futura",
      description: "Anotar a mudança para revisão numa sessão futura",
      action: "Criar nota no CHANGELOG ou journal interno",
      effort: "none",
    },
    challenging: {
      label: "Criar ADR agora",
      description: "Documentar a decisão arquitetural como Architecture Decision Record",
      action: "Criar ADR com contexto, decisões e consequências",
      growthBenefit: "Melhora rastreabilidade de decisões arquiteturais",
    },
  },
  scope_drift: {
    comfortable: {
      label: "Rever escopo no próximo planeamento",
      description: "Adicionar revisão de escopo ao próximo ciclo",
      action: "Adicionar tarefa de revisão ao backlog",
      effort: "low",
    },
    challenging: {
      label: "Re-definir limites de domínio agora",
      description: "Revisar e documentar limites de domínio imediatamente",
      action: "Criar ou actualizar boundary map do projecto",
      growthBenefit: "Prevene complexidade crescente e mantém arquitetura coesa",
    },
  },
  security_degradation: {
    comfortable: {
      label: "Agendar revisão de segurança",
      description: "Marcar revisão de segurança para sessão futura",
      action: "Adicionar item de revisão de segurança ao backlog",
      effort: "low",
    },
    challenging: {
      label: "Executar audit de segurança agora",
      description: "Rever vulnerabilidades e adicionar testes de segurança",
      action: "Executar audit completo e corrigir issues críticos",
      growthBenefit: "Previne vulnerabilidades e melhora posture de segurança",
    },
  },
  tech_debt_accumulation: {
    comfortable: {
      label: "Registar dívida para sprint futuro",
      description: "Documentar dívida técnica acumulada para tratamento futuro",
      action: "Criar item de dívida técnica no backlog",
      effort: "low",
    },
    challenging: {
      label: "Dedicar sprint de qualidade",
      description: "Reservar tempo para testes, docs e refactoring",
      action: "Planejar e executar sprint de qualidade com testes e docs",
      growthBenefit: "Melhora manutenibilidade e reduz custos futuros",
    },
  },
  capability_gap: {
    comfortable: {
      label: "Avaliar necessidade no próximo ciclo",
      description: "Avaliar se a capacidade é necessária no próximo ciclo",
      action: "Adicionar avaliação ao próximo ciclo de planeamento",
      effort: "low",
    },
    challenging: {
      label: "Instalar capacidade agora",
      description: "Instalar e configurar a capacidade governance necessária",
      action: "Executar shugo install para a capacidade necessária",
      growthBenefit: "Melhora maturidade do domínio e governance",
    },
  },
  maturity_regression: {
    comfortable: {
      label: "Rever maturidade no próximo audit",
      description: "Incluir revisão de maturidade no próximo audit periódico",
      action: "Agendar revisão de maturidade para próximo audit",
      effort: "none",
    },
    challenging: {
      label: "Executar audit de maturidade agora",
      description: "Avaliar maturidade actual e corrigir regressões",
      action: "Executar shugo audit e tratar findings imediatamente",
      growthBenefit: "Mantém ou eleva nível de maturidade do projecto",
    },
  },
};

// ── Presentation ────────────────────────────────────────────────────────────

export function createSemanticDualPath(
  pattern: DetectedPattern,
  profile: SemanticGrowthProfile
): SemanticDualPath {
  const templates = PATH_TEMPLATES[pattern.type];
  const domainLevel = getDomainChallengeLevel(profile, pattern.domain);

  const pathA: SemanticPathOption = {
    ...templates.comfortable,
    description: `${templates.comfortable.description} (${pattern.domain})`,
  };

  const pathB: SemanticPathOption = {
    ...templates.challenging,
    description: `${templates.challenging.description} (${pattern.domain})`,
    growthBenefit: templates.challenging.growthBenefit,
    effort: "medium",
  };

  return {
    pattern,
    pathA,
    pathB,
    challengeLevel: profile.challengeLevel,
    domainLevel,
  };
}

export function formatSemanticDualPath(dualPath: SemanticDualPath): string {
  const { pattern, pathA, pathB, domainLevel } = dualPath;
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan("  ╔══════════════════════════════════════════════════════╗"));
  lines.push(chalk.bold.cyan("  ║         SEMANTIC PATTERN — Choose Your Way          ║"));
  lines.push(chalk.bold.cyan("  ╚══════════════════════════════════════════════════════╝"));
  lines.push("");
  lines.push(chalk.bold(`  Pattern: ${pattern.description}`));
  lines.push(chalk.gray(`  Domain: ${pattern.domain} | Confidence: ${Math.round(pattern.confidence * 100)}% | Domain Level: ${Math.round(domainLevel * 100)}%`));
  lines.push("");

  // Path A
  lines.push(chalk.green("  ┌─ PATH A: COMFORTABLE ───────────────────────────────┐"));
  lines.push(chalk.green("  │") + ` ${chalk.gray(pathA.label)}`);
  lines.push(chalk.green("  │") + ` ${pathA.description}`);
  lines.push(chalk.green("  │") + ` Effort: ${formatEffort(pathA.effort)}`);
  lines.push(chalk.green("  │") + ` Action: ${chalk.gray(pathA.action)}`);
  lines.push(chalk.green("  └────────────────────────────────────────────────────┘"));
  lines.push("");

  // Path B
  lines.push(chalk.yellow("  ┌─ PATH B: CHALLENGING ──────────────────────────────┐"));
  lines.push(chalk.yellow("  │") + ` ${chalk.bold(pathB.label)}`);
  lines.push(chalk.yellow("  │") + ` ${pathB.description}`);
  lines.push(chalk.yellow("  │") + ` Effort: ${formatEffort(pathB.effort)}`);
  if (pathB.growthBenefit) {
    lines.push(chalk.yellow("  │") + ` Growth: ${chalk.magenta(pathB.growthBenefit)}`);
  }
  lines.push(chalk.yellow("  │") + ` Action: ${chalk.gray(pathB.action)}`);
  lines.push(chalk.yellow("  └────────────────────────────────────────────────────┘"));
  lines.push("");

  if (pattern.suggestedActions.length > 0) {
    lines.push(chalk.gray("  Suggested:"));
    for (const action of pattern.suggestedActions.slice(0, 3)) {
      lines.push(chalk.gray(`    • ${action}`));
    }
    lines.push("");
  }

  lines.push(chalk.gray("  Choose: --comfortable or --challenging"));
  lines.push("");

  return lines.join("\n");
}

export function formatSemanticDualPathJson(dualPath: SemanticDualPath) {
  return {
    pattern: {
      id: dualPath.pattern.id,
      type: dualPath.pattern.type,
      domain: dualPath.pattern.domain,
      confidence: dualPath.pattern.confidence,
      description: dualPath.pattern.description,
    },
    pathA: {
      ...dualPath.pathA,
      pathType: "comfortable" as const,
    },
    pathB: {
      ...dualPath.pathB,
      pathType: "challenging" as const,
    },
    adaptation: {
      challengeLevel: dualPath.challengeLevel,
      domainLevel: dualPath.domainLevel,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatEffort(effort: string): string {
  switch (effort) {
    case "none": return chalk.green("None");
    case "low": return chalk.cyan("Low");
    case "medium": return chalk.yellow("Medium");
    case "high": return chalk.red("High");
    default: return effort;
  }
}
