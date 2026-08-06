import chalk from "chalk";
import { detectComplexity } from "../../infrastructure/complexity-detector.js";
import { getActiveRules } from "../../infrastructure/rule-loader.js";
import { readMaturityHistory, type MaturityProfile } from "../../application/maturity-profile.js";
import { outputJson, healthBar } from "../../shared/formatting.js";
import { output, outputBlank } from "../../shared/output.js";

export function displayDimensionBar(label: string, value: number, prev?: number): void {
  const barWidth = 20;
  const filled = Math.round((value / 100) * barWidth);
  const empty = barWidth - filled;
  const color = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
  const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));

  let delta = "";
  if (prev !== undefined) {
    const diff = value - prev;
    if (diff > 0) delta = chalk.green(` +${diff}`);
    else if (diff < 0) delta = chalk.red(` ${diff}`);
    else delta = chalk.gray(" =");
  }

  output(`    ${label.padEnd(16)} ${bar} ${chalk.bold(String(value).padStart(3))}%${delta}`);
}

export function displayEvolution(history: Array<{ timestamp: string; overallScore: number }>): void {
  if (history.length < 2) {
    output(chalk.gray("    (need more assessments to show evolution)"));
    return;
  }

  output(chalk.bold("  Evolution:"));
  outputBlank();

  const scores = history.map((h) => h.overallScore);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;

  const chars = " ▁▂▃▄▅▆▇█";
  const sparkline = scores.map((s) => {
    const idx = Math.round(((s - minScore) / range) * (chars.length - 1));
    return chars[idx];
  }).join("");

  output(`    ${chalk.cyan(sparkline)} ${chalk.gray(`(${history.length} assessments)`)}`);
  outputBlank();
}

export function displayComplexity(projectRoot: string, shitennoDir: string, isJson: boolean): void {
  const result = detectComplexity(projectRoot);
  const active = getActiveRules(projectRoot, shitennoDir);

  if (isJson) {
    outputJson({
      complexity: result.level,
      score: result.score,
      factors: result.factors,
      capabilities: result.recommendedCapabilities,
      rules: {
        loaded: active.loadedCount,
        total: active.totalCount,
      },
    });
    return;
  }

  outputBlank();
  output(chalk.bold.cyan("  ╔══════════════════════════════════════════╗"));
  output(chalk.bold.cyan("  ║  shugo assess complexity                 ║"));
  output(chalk.bold.cyan("  ╚══════════════════════════════════════════╝"));
  outputBlank();

  const levelColor = result.level === "simple" ? chalk.green : result.level === "medium" ? chalk.yellow : chalk.red;
  output(chalk.bold("  Project Complexity Analysis"));
  output("  " + "─".repeat(40));
  output(`  Level:     ${levelColor.bold(result.level)}`);
  output(`  Score:     ${result.score}`);
  outputBlank();

  output(chalk.bold("  Factors:"));
  for (const f of result.factors) {
    const icon = f.score >= 3 ? "🔴" : f.score >= 2 ? "🟡" : "🟢";
    output(`    ${icon} ${f.description}`);
  }
  outputBlank();

  output(chalk.bold("  Recommended Capabilities:"));
  for (const cap of result.recommendedCapabilities) {
    output(chalk.green(`    ✅ ${cap}`));
  }
  outputBlank();

  output(chalk.bold("  Rules loaded:"));
  output(`    Complexity: ${result.level}`);
  output(`    Active: ${active.loadedCount}/${active.totalCount} rules`);
  if (result.level === "simple") {
    output(chalk.gray("    ℹ️  Simple project — only core rules active"));
  } else if (result.level === "medium") {
    output(chalk.gray("    ℹ️  Medium project — core + knowledge + governance + quality rules active"));
  } else {
    output(chalk.gray("    ℹ️  Complex project — all rules active"));
  }
  outputBlank();
}

export function displayCapabilities(newProfile: MaturityProfile): void {
  output(chalk.bold("  Installed Capabilities:"));
  for (const cap of newProfile.installedCapabilities) output(chalk.green(`    ✓ ${cap}`));
  outputBlank();
  if (newProfile.recommendedCapabilities.length > 0) {
    output(chalk.bold("  🎯 Recommended Capabilities:"));
    for (const cap of newProfile.recommendedCapabilities) output(chalk.cyan(`    → ${cap} — install with: shugo upgrade --capability ${cap}`));
    outputBlank();
  }
  if (newProfile.futureCapabilities.length > 0) {
    output(chalk.bold("  Future Capabilities:"));
    for (const cap of newProfile.futureCapabilities) output(chalk.gray(`    □ ${cap}`));
    outputBlank();
  }
}

export function displayAssessmentSummary(newProfile: MaturityProfile): void {
  if (newProfile.recommendedCapabilities.length > 0) {
    output(chalk.bold("  📝 Summary:"));
    output(chalk.gray(`    ${newProfile.recommendedCapabilities.length} capability(ies) recommended.`));
    outputBlank();
    output(chalk.bold.cyan("  🎯 Next step:"));
    output(chalk.cyan("    shugo upgrade --accept-recommended"));
    output(chalk.gray("    This will install all recommended capabilities for your maturity level."));
    outputBlank();
    output(chalk.gray("    Or install individually:"));
    for (const cap of newProfile.recommendedCapabilities) output(chalk.gray(`      shugo upgrade --capability ${cap}`));
  } else {
    output(chalk.green("  ✔ Your project is well-equipped! No new capabilities recommended."));
  }
  outputBlank();
}

export function displayAssessmentResults(shitennoDir: string, previousProfile: MaturityProfile | null, newProfile: MaturityProfile, scoreDelta: number | undefined): void {
  outputBlank();
  output(chalk.bold.green("  ═══ Maturity Assessment Results ═══"));
  outputBlank();
  if (previousProfile) {
    const color = scoreDelta !== undefined ? (scoreDelta > 0 ? chalk.green : scoreDelta < 0 ? chalk.red : chalk.gray) : chalk.gray;
    output(chalk.bold("  Previous Score:"));
    output(`    ${previousProfile.overallScore}/100 ${healthBar(previousProfile.overallScore, 100)}`);
    outputBlank();
    output(chalk.bold("  New Score:"));
    const deltaStr = scoreDelta !== undefined ? ` (${scoreDelta > 0 ? "+" : ""}${scoreDelta})` : "";
    output(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}${color(deltaStr)}`);
  } else {
    output(chalk.bold("  Overall Score:"));
    output(`    ${newProfile.overallScore}/100 ${healthBar(newProfile.overallScore, 100)}`);
  }
  outputBlank();
  output(chalk.bold("  Dimensions:"));
  outputBlank();
  const dimLabels: Record<string, string> = { architecture: "Arquitetura", governance: "Governança", quality: "Qualidade",
    automation: "Automação", ai: "IA", documentation: "Documentação", observability: "Observabilidade" };
  for (const [key, label] of Object.entries(dimLabels)) {
    const prevDim = previousProfile?.dimensions[key as keyof typeof previousProfile.dimensions];
    displayDimensionBar(label, newProfile.dimensions[key as keyof typeof newProfile.dimensions], prevDim);
  }
  outputBlank();
  displayCapabilities(newProfile);
  const history = readMaturityHistory(shitennoDir);
  displayEvolution(history);
  displayAssessmentSummary(newProfile);
}
