import { Command } from "commander";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { calculateComplexityScore, writeComplexityReport, type ComplexityReport } from "../scorer.js";
import { analyseProject, type ProjectAnalysis } from "../analyser.js";
import { getCached, setCache, computeKeyChecksums } from "../cache.js";
import { healthBar, miniBar, outputJson, statusIcon, banner } from "../formatting.js";
import { loadMaturityProfile, CAPABILITIES, type MaturityProfile } from "../maturity-profile.js";
import { guardNotInitialized, checkLifecycleGate } from "../shared.js";
import { getEventBus } from "../event-bus.js";
import { loadGrowthProfile } from "../growth-profile.js";
import { formatGrowthProgress } from "../dual-path-presenter.js";
import { logger, muteLogs } from "../logger.js";
import { output, outputBlank } from "../output.js";
import { queryDaemon, isDaemonRunning } from "../daemon-client.js";

interface StatusCheck {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

interface StatusOutputData {
  ctx: { projectRoot: string; shitennoDir: string };
  checks: StatusCheck[];
  complexity: ComplexityReport;
  maturityProfile: MaturityProfile | null;
  installedCapabilities: string[];
  analysis: ProjectAnalysis;
  cacheHit: boolean;
  reportFile: string | undefined;
  growthProfile: ReturnType<typeof loadGrowthProfile>;
}

interface FooterData {
  cacheHit: boolean;
  reportFile: string | undefined;
  projectRoot: string;
  maturityProfile: MaturityProfile | null;
  complexity: ComplexityReport;
}

export const statusCommand = new Command("status")
  .description("Check governance health status")
  .option("-d, --dir <path>", "Project root directory (default: auto-detect)")
  .option("--no-cache", "Skip cache and recalculate")
  .option("--json", "Output results as JSON")
  .option("--fix", "Auto-fix governance issues (like doctor)")
  .action(async (options) => {
    const isJson = options.json === true;
    displayHeader(isJson);
    const ctx = guardNotInitialized(options, isJson);
    if (!ctx) return;
    if (!checkLifecycleGate("status", ctx.projectRoot, ctx.shitennoDir, isJson)) return;
    const checks = runHealthChecks(ctx.projectRoot, ctx.shitennoDir);
    const analysis = analyseProject(ctx.projectRoot);
    const { complexity, cacheHit } = await resolveComplexity(options, ctx.projectRoot, ctx.shitennoDir, analysis);
    const reportFile = writeComplexityReport(ctx.projectRoot, ctx.shitennoDir, complexity);
    const maturityProfile = loadMaturityProfile(ctx.shitennoDir);
    const installedCapabilities = maturityProfile?.installedCapabilities ?? ["core"];
    const growthProfile = loadGrowthProfile(ctx.shitennoDir);
    if (isJson) { displayJsonOutput({ ctx, checks, complexity, maturityProfile, installedCapabilities, analysis, cacheHit, reportFile: reportFile ?? undefined, growthProfile }); return; }
    displayProjectRootText(ctx.projectRoot);
    displayResults(checks);
    if (options.fix) displayFixMode(checks, isJson);
    displayMaturityProfile(maturityProfile, installedCapabilities);
    displayComplexityReport(complexity, analysis);
    await displayFingerprint(ctx.projectRoot, ctx.shitennoDir, analysis, maturityProfile?.overallScore);
    await displayBriefing(ctx.projectRoot, ctx.shitennoDir);
    if (isDaemonRunning(ctx.shitennoDir)) await displayDaemonHealth(ctx.shitennoDir);
    await displayCapabilityEngine(ctx.projectRoot, ctx.shitennoDir);
    output(formatGrowthProgress(growthProfile));
    outputBlank();
    displayFooter({ cacheHit, reportFile: reportFile ?? undefined, projectRoot: ctx.projectRoot, maturityProfile, complexity });
  });

function displayHeader(isJson: boolean): void {
  if (isJson) muteLogs();
  if (!isJson) { outputBlank(); banner("shugo status", "Health Check"); outputBlank(); }
}

function displayProjectRootText(projectRoot: string): void {
  output(chalk.bold("  Project root:"));
  output(chalk.gray(`    ${projectRoot}`));
  outputBlank();
}

async function resolveComplexity(
  options: { cache?: boolean },
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis
): Promise<{ complexity: ComplexityReport; cacheHit: boolean }> {
  let complexity: ComplexityReport;
  let cacheHit = false;
  if (options.cache !== false) {      const cached = getCached<ComplexityReport>({ projectRoot, key: "complexity",
      computeChecksumsFn: () => computeKeyChecksums(projectRoot, shitennoDir) });
    if (cached) {
      complexity = cached;
      cacheHit = true;
    } else {
      complexity = await calculateComplexityScore(projectRoot, shitennoDir, analysis);
      setCache({ projectRoot, shitennoDir, key: "complexity", data: complexity,
        checksums: computeKeyChecksums(projectRoot, shitennoDir) });
    }
  } else {
    complexity = await calculateComplexityScore(projectRoot, shitennoDir, analysis);
  }
  return { complexity, cacheHit };
}

function displayJsonOutput(data: StatusOutputData): void {
  outputJson({
    projectRoot: data.ctx.projectRoot,
    checks: data.checks.map((c) => ({ name: c.name, status: c.status, message: c.message })),
    complexity: {
      score: data.complexity.score,
      level: data.complexity.level,
      staticScore: data.complexity.staticScore,
      behaviorScore: data.complexity.behaviorScore,
      reasons: data.complexity.reasons,
      suggestions: data.complexity.suggestions,
      areaScores: data.complexity.areaScores,
    },
    maturity: data.maturityProfile ? {
      overallScore: data.maturityProfile.overallScore,
      dimensions: data.maturityProfile.dimensions,
      installedCapabilities: data.maturityProfile.installedCapabilities,
      recommendedCapabilities: data.maturityProfile.recommendedCapabilities,
    } : null,
    installedCapabilities: data.installedCapabilities,
    analysis: {
      packageCount: data.analysis.packageCount,
      appCount: data.analysis.appCount,
      sourceFileCount: data.analysis.sourceFileCount,
      dependencyCount: data.analysis.dependencyCount,
      monorepo: data.analysis.monorepo,
      hasTypeScript: data.analysis.hasTypeScript,
      hasTests: data.analysis.hasTests,
    },
    cacheHit: data.cacheHit,
    reportFile: data.reportFile || null,
    computedAt: data.complexity.computedAt,
    growthProfile: {
      growthCapacity: data.growthProfile.growthCapacity,
      challengeLevel: data.growthProfile.challengeLevel,
      pattern: data.growthProfile.patterns[0]?.type || "balanced",
      totalChoices: data.growthProfile.pathHistory.length,
    },
  });
}

function displayFixMode(checks: StatusCheck[], isJson: boolean): void {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  if (!isJson) {
    output(chalk.bold("  🔧 Auto-fix Mode:"));
    outputBlank();
    if (failCount > 0) {
      output(chalk.gray("  Attempting fixes for failed checks..."));
      output(chalk.gray("  → Run 'shugo init' to fix failed governance checks"));
      output(chalk.gray("  → Run 'shugo upgrade --accept-recommended' to add missing capabilities"));
    }
    if (warnCount > 0) {
      output(chalk.gray("  Attempting fixes for warnings..."));
      output(chalk.gray("  → Run 'shugo upgrade' to add optional components"));
      output(chalk.gray("  → Run 'shugo sync' to synchronize documentation"));
    }
    if (failCount === 0 && warnCount === 0) {
      output(chalk.green("  ✔ No fixes needed — governance is healthy!"));
    }
    outputBlank();
  }
}

async function displayFingerprint(
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis,
  overallScore: number | undefined
): Promise<void> {
  const { loadFingerprint, isFingerprintStale, generateProjectFingerprint, saveFingerprint } = await import("../project-fingerprint.js");
  const staleFingerprint = isFingerprintStale(shitennoDir);
  let fingerprint = loadFingerprint(shitennoDir);
  if (!fingerprint || staleFingerprint) {
    fingerprint = generateProjectFingerprint(projectRoot, analysis, overallScore);
    saveFingerprint(shitennoDir, fingerprint);
  }
  if (fingerprint) {
    output(chalk.bold("  🔍 Project Fingerprint:"));
    output(chalk.gray(`    Domain:    ${fingerprint.domain}`));
    output(chalk.gray(`    Scale:     ${fingerprint.scale}`));
    output(chalk.gray(`    Stack:     ${fingerprint.stack.slice(0, 5).join(", ")}${fingerprint.stack.length > 5 ? ` (+${fingerprint.stack.length - 5})` : ""}`));
    output(chalk.gray(`    Hash:      ${fingerprint.hash}`));
    outputBlank();
  }
}

async function displayBriefing(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { collectContext } = await import("../context-collector.js");
    const { computeInputHash, getCachedBriefing } = await import("../briefing-cache.js");
    let briefing;
    if (isDaemonRunning(shitennoDir)) {
      const result = await queryDaemon<{ type: string; data: typeof briefing }>(shitennoDir, {
        type: "query_briefing",
      });
      if (result?.data) {
        briefing = result.data;
      }
    }
    if (!briefing) {
      const snapshot = collectContext(projectRoot, shitennoDir);
      const inputHash = computeInputHash({
        fingerprintHash: snapshot.fingerprint.hash,
        riskMapHash: snapshot.riskMap.generatedAt,
        contextRuleCount: snapshot.contextRules.length,
        dynamicRuleCount: snapshot.dynamicRules.length,
        maturityScore: snapshot.maturityProfile?.overallScore ?? null,
      });
      const cached = getCachedBriefing(shitennoDir, inputHash);
      briefing = cached?.briefing ?? snapshot.briefing;
    }
    output(chalk.bold("  📋 Pre-Session Briefing:"));
    output(chalk.gray(`    Domain: ${briefing.project.domain} | Scale: ${briefing.project.scale} | Risk: ${briefing.risks.overall}`));
    if (briefing.risks.criticalAreas.length > 0) {
      output(chalk.red(`    ⚠ Critical areas: ${briefing.risks.criticalAreas.join(", ")}`));
    }
    if (briefing.tests.areasWithoutTests.length > 0) {
      output(chalk.yellow(`    🧪 Areas without tests: ${briefing.tests.areasWithoutTests.length}`));
    }
    for (const rec of briefing.recommendations.slice(0, 2)) {
      output(chalk.cyan(`    → ${rec}`));
    }
    outputBlank();
  } catch (error) {
    logger.debug("status", "Suppressed error", { error });
  }
}

async function displayDaemonHealth(shitennoDir: string): Promise<void> {
  try {
    const health = await queryDaemon<{
      type: string;
      score: number | null;
      trend: string;
      uptimeSeconds: number;
      pid: number;
      activeSessions: number;
      lastCommand: string | null;
    }>(shitennoDir, { type: "query_health" });
    if (health) {
      const icon = health.trend === "critical" ? "🔴" : health.trend === "degrading" ? "🟡" : "🟢";
      output(chalk.bold("  🔍 Daemon Health:"));
      output(`    ${icon} Score: ${health.score ?? "N/A"}/100  Trend: ${health.trend}`);
      output(chalk.gray(`    Uptime: ${Math.round((health.uptimeSeconds ?? 0) / 60)}min | PID: ${health.pid} | Sessions: ${health.activeSessions}`));
      if (health.lastCommand) {
        output(chalk.gray(`    Last command: ${health.lastCommand}`));
      }
      outputBlank();
    }
    const challenges = await queryDaemon<{
      type: string;
      challenges: Array<{ type: string; severity: string; message: string }>;
    }>(shitennoDir, { type: "query_challenges" });
    if (challenges?.challenges?.length) {
      output(chalk.bold("  🎯 Pending Challenges:"));
      for (const c of challenges.challenges.slice(0, 5)) {
        const sev = c.severity === "high" ? "🔴" : c.severity === "medium" ? "🟡" : "🔵";
        output(`    ${sev} ${c.message}`);
      }
      outputBlank();
    }
  } catch {
  }
}

async function displayCapabilityEngine(projectRoot: string, shitennoDir: string): Promise<void> {
  try {
    const { evaluateCapabilities } = await import("../capability-engine.js");
    const { subscribeToEngineeringState } = await import("../engineering-state/index.js");
    const { getState, unsubscribe } = subscribeToEngineeringState(projectRoot, shitennoDir);
    const state = getState();
    unsubscribe();
    const engineResult = evaluateCapabilities(state, shitennoDir);
    output(chalk.bold("  ⚙ Capability Engine:"));
    output(chalk.gray(`    Overall: ${engineResult.overallScore}% | Installed: ${engineResult.byMaturity.installed.length + engineResult.byMaturity.configured.length + engineResult.byMaturity.active.length + engineResult.byMaturity.optimized.length} | Dormant: ${engineResult.byMaturity.dormant.length}`));
    const activeCaps = [...engineResult.byMaturity.active, ...engineResult.byMaturity.optimized];
    if (activeCaps.length > 0) {
      output(chalk.green(`    Active: ${activeCaps.join(", ")}`));
    }
    outputBlank();
  } catch (error) {
    logger.debug("status", "Suppressed error", { error });
  }
}

function displayFooter(data: FooterData): void {
  if (data.cacheHit) {
    output(chalk.gray("  📦 Used cached results"));
    outputBlank();
  }
  if (data.reportFile) {
    output(chalk.gray(`  📄 Report saved: shitenno/reports/${data.reportFile}`));
    outputBlank();
  }
  getEventBus().publish("analysis.complete", {
    projectId: data.projectRoot,
    maturityScore: data.maturityProfile?.overallScore ?? data.complexity.score,
    dimensions: data.maturityProfile?.dimensions ?? {},
    recommendations: data.complexity.suggestions,
  });
}

function runHealthChecks(projectRoot: string, shitennoDir: string): StatusCheck[] {
  const checks: StatusCheck[] = [];

  // 1. Check opencode.json at project root
  checks.push(checkOpencodeConfig(projectRoot));

  // 2. Check AGENTS.md in shitenno/docs/
  checks.push(checkAgentsFile(shitennoDir));

  // 3. Check skills directory in shitenno/docs/skills/
  checks.push(checkSkillsDirectory(shitennoDir));

  // 4. Check governance directory in shitenno/governance/
  checks.push(checkGovernanceDirectory(shitennoDir));

  // 5. Check context buffer in shitenno/governance/context/
  checks.push(checkContextBuffer(shitennoDir));

  // 6. Check scripts in shitenno/scripts/
  checks.push(checkScripts(shitennoDir));

  // 7. Check agent contracts in shitenno/governance/agents/
  checks.push(checkAgentContracts(shitennoDir));

  return checks;
}

function checkOpencodeConfig(projectRoot: string): StatusCheck {
  const configPath = join(projectRoot, "opencode.json");

  if (!existsSync(configPath)) {
    return { name: "opencode.json", status: "fail", message: "File not found" };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    if (!config.model) {
      return { name: "opencode.json", status: "warn", message: "Missing 'model' field" };
    }

    if (!config.agent) {
      return { name: "opencode.json", status: "warn", message: "Missing 'agent' configuration" };
    }

    const agentCount = Object.keys(config.agent).length;
    return {
      name: "opencode.json",
      status: "pass",
      message: `Configured with ${agentCount} agents`,
    };
  } catch {
    return { name: "opencode.json", status: "fail", message: "Invalid JSON" };
  }
}

function checkAgentsFile(shitennoDir: string): StatusCheck {
  const agentsPath = join(shitennoDir, "docs", "AGENTS.md");

  if (!existsSync(agentsPath)) {
    return { name: "shitenno/docs/AGENTS.md", status: "fail", message: "File not found" };
  }

  const content = readFileSync(agentsPath, "utf-8");
  const ruleCount = (content.match(/^\d+\./gm) || []).length;

  if (ruleCount < 10) {
    return {
      name: "shitenno/docs/AGENTS.md",
      status: "warn",
      message: `Only ${ruleCount} rules found (expected 22+)`,
    };
  }

  return {
    name: "shitenno/docs/AGENTS.md",
    status: "pass",
    message: `${ruleCount} rules configured`,
  };
}

function checkSkillsDirectory(shitennoDir: string): StatusCheck {
  const skillsDir = join(shitennoDir, "docs", "skills");

  if (!existsSync(skillsDir)) {
    return { name: "shitenno/docs/skills/", status: "warn", message: "Directory not found" };
  }

  const skillFiles = readdirSync(skillsDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (skillFiles.length === 0) {
    return { name: "shitenno/docs/skills/", status: "warn", message: "No skills found" };
  }

  return {
    name: "shitenno/docs/skills/",
    status: "pass",
    message: `${skillFiles.length} skills installed`,
  };
}

function checkGovernanceDirectory(shitennoDir: string): StatusCheck {
  const govDir = join(shitennoDir, "governance");

  if (!existsSync(govDir)) {
    return { name: "shitenno/governance/", status: "warn", message: "Directory not found" };
  }

  const hasContext = existsSync(join(govDir, "context"));
  const hasAgents = existsSync(join(govDir, "agents"));

  const parts: string[] = [];
  if (hasContext) parts.push("context");
  if (hasAgents) parts.push("agents");

  return {
    name: "shitenno/governance/",
    status: "pass",
    message: `Contains: ${parts.join(", ") || "empty"}`,
  };
}

function checkContextBuffer(shitennoDir: string): StatusCheck {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return { name: "context_buffer.yaml", status: "warn", message: "Not found" };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (!content.includes("current_task:")) {
    return { name: "context_buffer.yaml", status: "warn", message: "Missing 'current_task' section" };
  }

  return { name: "context_buffer.yaml", status: "pass", message: "Valid" };
}

function checkScripts(shitennoDir: string): StatusCheck {
  const scriptsDir = join(shitennoDir, "scripts");

  if (!existsSync(scriptsDir)) {
    return { name: "shitenno/scripts/", status: "warn", message: "Directory not found" };
  }

  const scriptFiles = readdirSync(scriptsDir).filter((f: string) =>
    f.endsWith(".ts") || f.endsWith(".js")
  );

  if (scriptFiles.length === 0) {
    return { name: "shitenno/scripts/", status: "warn", message: "No scripts found" };
  }

  return {
    name: "shitenno/scripts/",
    status: "pass",
    message: `${scriptFiles.length} scripts installed`,
  };
}

function checkAgentContracts(shitennoDir: string): StatusCheck {
  const contractsDir = join(shitennoDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return { name: "agent contracts", status: "warn", message: "Not found" };
  }

  const yamlFiles = readdirSync(contractsDir).filter((f: string) =>
    f.endsWith(".yaml") || f.endsWith(".yml")
  );

  if (yamlFiles.length === 0) {
    return { name: "agent contracts", status: "warn", message: "No contracts found" };
  }

  return {
    name: "agent contracts",
    status: "pass",
    message: `${yamlFiles.length} contracts defined`,
  };
}

function displayResults(checks: StatusCheck[]): void {
  output(chalk.bold("  Governance Health:"));
  outputBlank();

  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const { icon, color } = statusIcon(check.status);
    if (check.status === "pass") passCount++;
    else if (check.status === "warn") warnCount++;
    else failCount++;

    output(`    ${color(icon)} ${chalk.bold(check.name)}: ${color(check.message)}`);
  }

  outputBlank();
  output(chalk.bold("  Summary:"));
  output(
    `    ${chalk.green(`✔ ${passCount} passed`)}  ${chalk.yellow(`⚠ ${warnCount} warnings`)}  ${chalk.red(`✘ ${failCount} failed`)}`
  );
  outputBlank();

  if (failCount > 0) {
    output(chalk.red("  Run 'shugo init' to fix failed checks."));
  } else if (warnCount > 0) {
    output(chalk.yellow("  Some optional components are missing. Run 'shugo upgrade' to add them."));
  } else {
    output(chalk.green("  Governance is healthy!"));
  }

  outputBlank();
}

function displayMaturityProfile(
  profile: MaturityProfile | null,
  installedCapabilities: string[]
): void {
  output(chalk.bold("  🎯 Maturity Profile:"));
  outputBlank();
  if (!profile) {
    output(chalk.gray("    No maturity profile found. Run 'shugo init' to create one."));
    outputBlank();
    return;
  }
  displayMaturityScore(profile);
  displayMaturityDimensions(profile);
  displayInstalledCapabilities(installedCapabilities);
  displayRecommendedCapabilities(profile);
}

function displayMaturityScore(profile: MaturityProfile): void {
  const color = profile.overallScore >= 65 ? chalk.green : profile.overallScore >= 35 ? chalk.yellow : chalk.red;
  output(`    Overall Score: ${color(String(profile.overallScore))}/100 ${healthBar(profile.overallScore, 100)}`);
  outputBlank();
}

function displayMaturityDimensions(profile: MaturityProfile): void {
  const dimLabels: Record<string, string> = {
    architecture: "Arquitetura",
    governance: "Governança",
    quality: "Qualidade",
    automation: "Automação",
    ai: "IA",
    documentation: "Documentação",
    observability: "Observabilidade",
  };
  const barWidth = 16;
  for (const [key, label] of Object.entries(dimLabels)) {
    const value = profile.dimensions[key as keyof typeof profile.dimensions];
    const filled = Math.round((value / 100) * barWidth);
    const empty = barWidth - filled;
    const dimColor = value >= 65 ? chalk.green : value >= 35 ? chalk.yellow : chalk.red;
    const bar = dimColor("█".repeat(filled)) + chalk.gray("░".repeat(empty));
    output(`    ${label.padEnd(16)} ${bar} ${String(value).padStart(3)}%`);
  }
  outputBlank();
}

function displayInstalledCapabilities(installedCapabilities: string[]): void {
  output(chalk.bold("    Installed Capabilities:"));
  for (const cap of installedCapabilities) {
    const info = CAPABILITIES.find((c) => c.id === cap);
    output(chalk.green(`      ✓ ${info?.name || cap}`));
  }
  outputBlank();
}

function displayRecommendedCapabilities(profile: MaturityProfile): void {
  if (profile.recommendedCapabilities.length > 0) {
    output(chalk.bold("    🎯 Recommended:"));
    for (const cap of profile.recommendedCapabilities) {
      const info = CAPABILITIES.find((c) => c.id === cap);
      output(chalk.cyan(`      → ${info?.name || cap}`));
    }
    outputBlank();
  }
}

function displayComplexityReport(
  complexity: ComplexityReport,
  analysis: ProjectAnalysis
): void {
  const levelColors: Record<string, typeof chalk.green> = {
    junior: chalk.green,
    pleno: chalk.yellow,
    senior: chalk.red,
  };
  const levelNames: Record<string, string> = {
    junior: "Basic",
    pleno: "Moderate",
    senior: "Advanced",
  };
  const color = levelColors[complexity.level] || chalk.gray;
  output(chalk.bold("  📊 Complexity Analysis:"));
  outputBlank();
  displayProjectMetrics(analysis);
  displayScoreBreakdown(complexity, color, levelNames);
  displayFactors(complexity);
  if (complexity.areaScores.length > 0) displayAreaBreakdown(complexity, levelColors);
  displaySuggestions(complexity);
  outputBlank();
}

function displayProjectMetrics(analysis: ProjectAnalysis): void {
  output(chalk.gray("    Project Metrics:"));
  output(chalk.gray(`      Packages:      ${analysis.packageCount}`));
  output(chalk.gray(`      Apps:          ${analysis.appCount}`));
  output(chalk.gray(`      Source files:  ${analysis.sourceFileCount}`));
  output(chalk.gray(`      Dependencies:  ${analysis.dependencyCount}`));
  output(chalk.gray(`      Monorepo:      ${analysis.monorepo ? "yes" : "no"}`));
  outputBlank();
}

function displayScoreBreakdown(
  complexity: ComplexityReport,
  color: typeof chalk.green,
  levelNames: Record<string, string>
): void {
  output(chalk.gray("    Score Breakdown:"));
  output(chalk.gray(`      Static score:  ${complexity.staticScore}`));
  output(chalk.gray(`      Behavior score: ${complexity.behaviorScore}`));
  output(chalk.bold(`      Total score:   ${complexity.score}  ${healthBar(complexity.score, 20)}`));
  outputBlank();
  output(chalk.gray("    Current level:"));
  output(color(`      ${levelNames[complexity.level] || complexity.level}`));
  outputBlank();
  output(chalk.gray("    Factors:"));
}

function displayFactors(complexity: ComplexityReport): void {
  for (const reason of complexity.reasons) {
    output(chalk.gray(`      • ${reason}`));
  }
}

function displayAreaBreakdown(
  complexity: ComplexityReport,
  levelColors: Record<string, typeof chalk.green>
): void {
  outputBlank();
  output(chalk.bold("    📍 Area Breakdown:"));
  outputBlank();
  output(chalk.gray("      Area                    Score  Bar      Lvl     Files Churn Snsve  Viol  Deps  Age   Ctx"));
  output(chalk.gray("      ─────────────────────── ────── ──────── ─────── ───── ───── ────── ───── ───── ───── ─────"));
  for (const area of complexity.areaScores.sort((a, b) => b.score - a.score)) {
    const areaColor = levelColors[area.level] || chalk.gray;
    const areaName = area.area.padEnd(23);
    const score = String(area.score).padStart(5);
    const level = (area.level).padEnd(7);
    const files = String(area.fileCount).padStart(4);
    const churn = String(area.churn).padStart(4);
    const sensitive = String(area.sensitiveSurface).padStart(5);
    const violations = String(area.violations).padStart(4);
    const deps = String(area.dependencyDepth).padStart(4);
    const age = String(area.incidentFreeAge).padStart(4);
    const ctx = String(area.contextPressure).padStart(4);
    output(`      ${areaColor(areaName)} ${chalk.bold(score)} ${miniBar(area.score)} ${areaColor(level)} ${chalk.gray(files)} ${chalk.gray(churn)} ${chalk.gray(sensitive)} ${chalk.gray(violations)} ${chalk.gray(deps)} ${chalk.gray(age)} ${chalk.gray(ctx)}`);
  }
  outputBlank();
}

function displaySuggestions(complexity: ComplexityReport): void {
  if (complexity.suggestions.length > 0) {
    outputBlank();
    output(chalk.bold("    💡 Suggestions:"));
    for (const suggestion of complexity.suggestions) {
      output(chalk.cyan(`      → ${suggestion}`));
    }
  }
}
