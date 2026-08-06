/**
 * briefing-formatter.ts — Briefing output formatters
 *
 * Pure functions for converting Briefing to JSON, Markdown, and Summary.
 */

import type { Briefing, ReminderPriority, ReminderCategory } from "../../application/briefing.js";

function getPriorityIcon(priority: ReminderPriority): string {
  switch (priority) {
    case "high": return "🔴 **HIGH**";
    case "medium": return "🟡 **MEDIUM**";
    case "low": return "🟢 **LOW**";
  }
}

function getCategoryLabel(category: ReminderCategory): string {
  return `[${category}]`;
}

export function briefingToJson(briefing: Briefing): Record<string, unknown> {
  const result: Record<string, unknown> = {
    generatedAt: briefing.generatedAt,
    project: briefing.project,
    risks: briefing.risks,
    tests: briefing.tests,
    patterns: briefing.patterns,
    contextRules: briefing.contextRules.map((r) => ({
      id: r.id, rule: r.rule, priority: r.priority, area: r.area,
    })),
    dynamicRules: briefing.dynamicRules.map((r) => ({
      id: r.id, rule: r.rule, severity: r.severity,
    })),
    recommendations: briefing.recommendations,
  };
  if (briefing.semantic) {
    result.semantic = {
      patterns: briefing.semantic.patterns.map((p) => ({
        id: p.id, type: p.type, domain: p.domain,
        confidence: p.confidence, description: p.description,
      })),
      insights: briefing.semantic.insights.map((i) => ({
        id: i.id, type: i.type, priority: i.priority,
        description: i.description, domains: i.domains,
      })),
      correlations: briefing.semantic.correlations.map((c) => ({
        id: c.id, type: c.type, strength: c.strength,
        description: c.description, confidence: c.confidence,
      })),
      growthProfile: briefing.semantic.growthProfile,
    };
  }
  return result;
}

export function briefingToSummary(briefing: Briefing): string {
  const parts: string[] = [];
  parts.push(`Domain: ${briefing.project.domain}`);
  parts.push(`Scale: ${briefing.project.scale}`);
  parts.push(`Risk: ${briefing.risks.overall}`);
  if (briefing.risks.criticalAreas.length > 0) {
    parts.push(`Critical: ${briefing.risks.criticalAreas.join(", ")}`);
  }
  if (briefing.tests.areasWithoutTests.length > 0) {
    parts.push(`No-tests: ${briefing.tests.areasWithoutTests.length} area(s)`);
  }
  parts.push(`Recommendations: ${briefing.recommendations.length}`);
  if (briefing.tokenEconomy.estimatedTokensSaved > 0) {
    parts.push(`Tokens saved: ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()}`);
  }
  return parts.join(" | ");
}

function markdownQuickBoard(briefing: Briefing): string[] {
  if (!briefing.quickBoard) return [];
  const qb = briefing.quickBoard;
  return [
    "---", "",
    "## QUICK BOARD — Estado do Projecto", "",
    "> **Apresentar este quadro ao utilizador antes da primeira resposta operacional.**",
    "> Veja regra #13 em `docs/AGENTS.md` (QUICK BOARD DE AVISO).", "",
    "| Campo | Estado |", "|---|---|",
    `| **Tarefa em curso** | ${qb.currentTask} |`,
    `| **Próximo P0** | ${qb.nextP0} |`,
    `| **Dívidas P1** | ${qb.p1Debts} |`,
    `| **Impedimentos** | ${qb.impediments} |`,
    `| **Estado última sessão** | ${qb.lastSessionStatus} |`,
    "", "---", "",
  ];
}

function markdownRecentActivity(briefing: Briefing): string[] {
  if (!briefing.recentActivity || briefing.recentActivity.events.length === 0) return [];
  const lines = ["## Actividade Recente (24h)", "", "| Evento | Detalhe | Hora |", "|--------|---------|------|"];
  for (const event of briefing.recentActivity.events) {
    lines.push(`| ${event.type} | ${event.summary} | ${event.timestamp.slice(11, 16)} |`);
  }
  lines.push("", `**Resumo:** ${briefing.recentActivity.syncCount} sincronizações, ${briefing.recentActivity.errorCount} erros`, "");
  return lines;
}

function markdownReminders(briefing: Briefing): string[] {
  if (!briefing.reminders || briefing.reminders.length === 0) return [];
  const priorityOrder: Record<ReminderPriority, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...briefing.reminders].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const lines = ["## Active Reminders", ""];
  for (const r of sorted) lines.push(`- ${getPriorityIcon(r.priority)} — ${r.message} ${getCategoryLabel(r.category)}`);
  lines.push("");
  return lines;
}

function markdownRules(briefing: Briefing): string[] {
  const lines: string[] = [];
  if (briefing.contextRules.length > 0) {
    lines.push("## Context Rules (Top)");
    for (const rule of briefing.contextRules) lines.push(`- ${rule.rule}`);
    lines.push("");
  }
  if (briefing.dynamicRules.length > 0) {
    lines.push("## Dynamic Rules (From History)");
    for (const rule of briefing.dynamicRules) lines.push(`- [${rule.severity}] ${rule.rule}`);
    lines.push("");
  }
  return lines;
}

function markdownSemanticSection(briefing: Briefing): string[] {
  const s = briefing.semantic;
  if (!s || (s.patterns.length === 0 && s.insights.length === 0 && s.correlations.length === 0)) return [];
  const lines = ["", "## Semantic Analysis"];
  if (s.patterns.length > 0) {
    lines.push(`### Patterns (${s.patterns.length})`);
    for (const p of s.patterns.slice(0, 5)) {
      lines.push(`- **${p.description}**`);
      lines.push(`  - Domain: ${p.domain} | Type: ${p.type} | Confidence: ${Math.round(p.confidence * 100)}%`);
      for (const action of p.suggestedActions.slice(0, 2)) lines.push(`  - → ${action}`);
    }
  }
  if (s.insights.length > 0) {
    lines.push(`### Insights (${s.insights.length})`);
    for (const i of s.insights.slice(0, 5)) {
      lines.push(`- **${i.description}** (${i.priority})`);
      lines.push(`  - Domains: ${i.domains.join(", ")}`);
      for (const action of i.suggestedActions.slice(0, 2)) lines.push(`  - → ${action}`);
    }
  }
  if (s.correlations.length > 0) {
    lines.push(`### Cross-System Correlations (${s.correlations.length})`);
    for (const c of s.correlations.slice(0, 3)) {
      lines.push(`- **${c.description}** (${c.strength})`);
      lines.push(`  - Type: ${c.type} | Confidence: ${Math.round(c.confidence * 100)}%`);
    }
  }
  lines.push("");
  return lines;
}

function markdownDaemonSections(briefing: Briefing): string[] {
  const lines: string[] = [];
  if (briefing.proactiveAlerts) {
    const pa = briefing.proactiveAlerts;
    if (pa.pendingChallenges.length > 0 || pa.unresolvedHealthDips.length > 0 || pa.pendingDebts.length > 0) {
      lines.push("", "## Proactive Alerts", "*");
      for (const c of pa.pendingChallenges) lines.push(`- **Challenge:** ${c}`);
      for (const h of pa.unresolvedHealthDips) lines.push(`- **Health Dip:** ${h}`);
      for (const d of pa.pendingDebts) lines.push(`- **Pending Debt:** ${d}`);
    }
  }
  if (briefing.daemonHeartbeat) {
    const dh = briefing.daemonHeartbeat;
    lines.push("", "## Daemon Status");
    lines.push(`- **Running:** ${dh.running ? "Yes" : "No"}`);
    if (dh.running) {
      lines.push(`- **Uptime:** ${dh.uptime}`);
      lines.push(`- **Last Audit:** ${dh.lastAudit}`);
      lines.push(`- **Audit Count:** ${dh.auditCount}`);
      lines.push(`- **Notifications Sent:** ${dh.notificationsSent}`);
    }
  }
  return lines;
}

export function briefingToMarkdown(briefing: Briefing): string {
  const lines: string[] = ["# Pre-Session Briefing", `*Generated: ${briefing.generatedAt}*`, ""];
  lines.push(...markdownQuickBoard(briefing));
  lines.push(...markdownRecentActivity(briefing));
  lines.push(...markdownReminders(briefing));
  lines.push("## Project Identity");
  lines.push(`- **Domain:** ${briefing.project.domain}`);
  lines.push(`- **Scale:** ${briefing.project.scale}`);
  lines.push(`- **Stack:** ${briefing.project.stack.join(", ")}`);
  lines.push(`- **Maturity:** ${briefing.project.maturityScore}/100`, "");
  lines.push("## Risk Status");
  lines.push(`- **Overall:** ${briefing.risks.overall}`);
  if (briefing.risks.criticalAreas.length > 0) lines.push(`- **Critical:** ${briefing.risks.criticalAreas.join(", ")}`);
  if (briefing.risks.highAreas.length > 0) lines.push(`- **High:** ${briefing.risks.highAreas.join(", ")}`);
  lines.push("");
  lines.push("## Test Coverage");
  lines.push(`- **Has Tests:** ${briefing.tests.hasTests ? "Yes" : "No"}`);
  if (briefing.tests.areasWithoutTests.length > 0) lines.push(`- **Areas Without Tests:** ${briefing.tests.areasWithoutTests.length}`);
  lines.push("");
  lines.push(...markdownRules(briefing));
  lines.push(...markdownDaemonSections(briefing));
  lines.push("", "## Recommended Next Steps");
  for (const rec of briefing.recommendations) lines.push(`1. ${rec}`);
  lines.push("", "## Token Economy");
  lines.push(`- **Estimated tokens saved:** ~${briefing.tokenEconomy.estimatedTokensSaved.toLocaleString()}`);
  lines.push(`- **Context rules:** ${briefing.tokenEconomy.contextRuleCount}`);
  lines.push(`- **Dynamic rules:** ${briefing.tokenEconomy.dynamicRuleCount}`);
  lines.push(`- **Cache hit:** ${briefing.tokenEconomy.cacheHit ? "Yes" : "No"}`);
  lines.push(...markdownSemanticSection(briefing));
  if (briefing.proactiveAlerts?.pendingChallenges.length) {
    lines.push("", "## ⚠️ Pending Challenges");
    for (const c of briefing.proactiveAlerts.pendingChallenges) lines.push(`- ${c}`);
    lines.push("", "Respond: `shugo briefing` (interactive)");
  }
  return lines.join("\n");
}
