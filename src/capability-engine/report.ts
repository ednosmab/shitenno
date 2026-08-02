import type { CapabilityEngineResult } from "./types.js";

export function capabilityEngineToText(result: CapabilityEngineResult): string {
  const lines: string[] = [];

  lines.push("# Capability Engine Report");
  lines.push(`Evaluated: ${result.evaluatedAt}`);
  lines.push(`Overall Score: ${result.overallScore}/100`);
  lines.push("");

  lines.push("## By Maturity Level");
  for (const [level, caps] of Object.entries(result.byMaturity)) {
    if (caps.length > 0) {
      lines.push(`  ${level}: ${caps.map((c) => c.name).join(", ")}`);
    }
  }
  lines.push("");

  lines.push("## Capabilities");
  for (const cap of result.capabilities) {
    const statusIcon = cap.isInstalled ? "✓" : "○";
    lines.push(`  ${statusIcon} ${cap.name} (${cap.maturity}: ${cap.maturityScore}/100)`);
    if (cap.activePolicies.length > 0) {
      lines.push(`    Policies: ${cap.activePolicies.join(", ")}`);
    }
    if (cap.activeSkills.length > 0) {
      lines.push(`    Skills: ${cap.activeSkills.join(", ")}`);
    }
  }
  lines.push("");

  if (result.recommendations.length > 0) {
    lines.push("## Recommendations");
    for (const rec of result.recommendations) {
      lines.push(`  [${rec.priority.toUpperCase()}] ${rec.action} ${rec.capability}`);
      lines.push(`    Reason: ${rec.reason}`);
      lines.push(`    Impact: ${rec.expectedImpact}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
