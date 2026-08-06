import type { EngineeringState, EngineeringAsset, AssetType } from "../application/engineering-state.js";

export function generateSystemMap(state: EngineeringState): string {
  const lines: string[] = [
    "# System Map",
    "",
    `> Generated: ${new Date().toISOString()}`,
    `> Session Score: ${state.healthScores.overall}/100`,
    "",
    "## Overview",
    "",
    `- **Project:** ${state.project.name}`,
    `- **Root:** ${state.project.root}`,
    `- **Stack:** ${state.project.stack.join(", ") || "Unknown"}`,
    `- **Lifecycle:** ${state.lifecycle}`,
    "",
    "## Assets",
    "",
  ];

  const byType = new Map<AssetType, EngineeringAsset[]>();
  for (const asset of state.assets) {
    const existing = byType.get(asset.type) ?? [];
    existing.push(asset);
    byType.set(asset.type, existing);
  }

  for (const [type, assets] of byType) {
    lines.push(`### ${type.charAt(0).toUpperCase() + type.slice(1)}s (${assets.length})`);
    lines.push("");
    for (const asset of assets.slice(0, 10)) {
      lines.push(`- ${asset.name} — ${asset.path}`);
    }
    if (assets.length > 10) {
      lines.push(`- ... and ${assets.length - 10} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function generateAssetIndex(state: EngineeringState): string {
  const lines: string[] = [
    "# Asset Index",
    "",
    `> Generated: ${new Date().toISOString()}`,
    `> Total Assets: ${state.assets.length}`,
    "",
    "| Type | Name | Path | Status |",
    "|------|------|------|--------|",
  ];

  for (const asset of state.assets) {
    lines.push(`| ${asset.type} | ${asset.name} | ${asset.path} | ${asset.status} |`);
  }

  return lines.join("\n");
}

export function generateCapabilityReport(state: EngineeringState): string {
  const lines: string[] = [
    "# Capability Report",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## Installed Capabilities",
    "",
  ];

  if (state.capabilities.length === 0) {
    lines.push("_No capabilities installed._");
  } else {
    for (const cap of state.capabilities) {
      lines.push(`- ${cap}`);
    }
  }

  return lines.join("\n");
}

export function generateHealthReport(state: EngineeringState): string {
  const lines: string[] = [
    "# Health Report",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## Scores",
    "",
    `- **Overall:** ${state.healthScores.overall}/100`,
    `- **Knowledge Debt:** ${state.healthScores.knowledgeDebt}/100`,
    `- **Knowledge Graph:** ${state.healthScores.knowledgeGraph}/100`,
    "",
    "## Entropy",
    "",
    `- **Orphaned Assets:** ${state.entropy.orphanedAssets}`,
    `- **Stale Assets:** ${state.entropy.staleAssets}`,
    `- **Missing Dependencies:** ${state.entropy.missingDependencies}`,
    `- **Entropy Score:** ${state.entropy.score}`,
    "",
    "## Summary",
    "",
    state.summary,
  ];

  return lines.join("\n");
}

export function generateArchitectureOverview(state: EngineeringState): string {
  const lines: string[] = [
    "# Architecture Overview",
    "",
    `> Generated: ${new Date().toISOString()}`,
    "",
    "## System Architecture",
    "",
    "The Shitenno follows a cognitive cycle architecture:",
    "",
    "```",
    "Observe → Understand → Reason → Decide → Validate → Act → Learn",
    "   ↓          ↓          ↓        ↓         ↓        ↓      ↓",
    "Context   Pattern    Goal    Decision   Policy   Action  Feedback",
    "Pipeline  Detection  Engine  Engine     Engine   Engine  Loop",
    "```",
    "",
    "## Components",
    "",
    `- **Context Pipeline:** Collects and processes project context`,
    `- **Pattern Detection:** Identifies patterns from history and codebase`,
    `- **Goal Engine:** Manages governance goals and targets`,
    `- **Decision Engine:** Evaluates actions using specialized evaluators`,
    `- **Policy Engine:** Enforces declarative governance policies`,
    `- **Action Engine:** Executes actions with idempotency guarantees`,
    `- **Plan Engine:** Coordinates sequences of actions`,
    "- **Feedback Loop:** Learns from session outcomes",
    "",
    "## Metrics",
    "",
    `- **Active Rules:** ${state.activeRules}`,
    `- **Active Policies:** ${state.activePolicies}`,
    `- **Total Assets:** ${state.assets.length}`,
  ];

  return lines.join("\n");
}
