import type { PersonalizedFeedback } from "./profile.js";
import type { FeedbackItem, LeadershipMetrics } from "./profile.js";

function appendProfileHeader(lines: string[], feedback: PersonalizedFeedback): void {
  lines.push(`# Feedback Personalizado — ${feedback.date}`);
  lines.push("");
  lines.push(`## Perfil: ${feedback.profile.role}`);
  lines.push(`- Arquitectura: ${feedback.profile.architecture}`);
  lines.push(`- Código: ${feedback.profile.coding}`);
  lines.push(`- Tom: ${feedback.profile.codeFreePercent}% no-code, foco em ${feedback.profile.focusAreas.join(", ") || "visão/leadership"}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`## Sessão ${feedback.sessionNumber} (${feedback.sessionTimestamp})`);
  lines.push("");
}

function appendStrengths(lines: string[], strengths: FeedbackItem[]): void {
  lines.push("### O que fizeste bem");
  lines.push("");
  for (let i = 0; i < strengths.length; i++) {
    const item = strengths[i];
    if (item) {
      lines.push(`${i + 1}. **${item.title}** — ${item.description}`);
      lines.push("");
    }
  }
}

function appendImprovementItem(lines: string[], item: FeedbackItem, index: number): void {
  lines.push(`${index + 1}. **${item.title}**`);
  lines.push(`   - ${item.description}`);
  if (item.whatHappened) {
    lines.push(`   - **O que aconteceu:** ${item.whatHappened}`);
  }
  if (item.techLeadPerspective) {
    lines.push(`   - **Como tech lead:** ${item.techLeadPerspective}`);
  }
  if (item.practicalRule) {
    lines.push(`   - **Regra prática:** ${item.practicalRule}`);
  }
  lines.push("");
}

function appendImprovements(lines: string[], improvements: FeedbackItem[]): void {
  if (improvements.length === 0) return;
  lines.push("### O que podes melhorar");
  lines.push("");
  for (let i = 0; i < improvements.length; i++) {
    const item = improvements[i];
    if (item) {
      appendImprovementItem(lines, item, i);
    }
  }
}

function appendMetrics(lines: string[], metrics: LeadershipMetrics[]): void {
  if (metrics.length === 0) return;
  lines.push("### Métricas de leadership");
  lines.push("");
  lines.push("| Indicador | Nota |");
  lines.push("|-----------|------|");
  for (const metric of metrics) {
    lines.push(`| ${metric.name} | ${metric.rating}${metric.note ? ` (${metric.note})` : ""} |`);
  }
  lines.push("");
}

function appendAgentPerformance(lines: string[], agentPerformance: PersonalizedFeedback["agentPerformance"]): void {
  if (agentPerformance.strengths.length === 0 && agentPerformance.improvements.length === 0) return;
  lines.push("### Performance do Agente");
  lines.push("");
  if (agentPerformance.strengths.length > 0) {
    lines.push("**O que o agente fez bem:**");
    for (const s of agentPerformance.strengths) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }
  if (agentPerformance.improvements.length > 0) {
    lines.push("**O que o agente pode melhorar:**");
    for (const m of agentPerformance.improvements) {
      lines.push(`- ${m}`);
    }
    lines.push("");
  }
}

export function formatFeedbackAsMarkdown(feedback: PersonalizedFeedback): string {
  const lines: string[] = [];

  appendProfileHeader(lines, feedback);
  appendStrengths(lines, feedback.strengths);
  appendImprovements(lines, feedback.improvements);

  lines.push("### Próximo nível");
  lines.push("");
  lines.push(feedback.nextLevel);
  lines.push("");

  appendMetrics(lines, feedback.metrics);
  appendAgentPerformance(lines, feedback.agentPerformance);

  lines.push("---");
  lines.push(`*Feedback gerado automaticamente por shitenno-cli para o perfil: ${feedback.profile.role}*`);

  return lines.join("\n");
}
