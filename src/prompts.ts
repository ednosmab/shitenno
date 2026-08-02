/**
 * prompts.ts — Questionário de Descoberta de Maturidade
 *
 * Substitui a seleção simples de nível (L1/L2/L3) por um questionário
 * multi-categoria que permite ao Shugo construir um perfil de maturidade.
 *
 * PRINCÍPIO: O usuário responde perguntas — o Shugo determina a configuração.
 */

import inquirer from "inquirer";
import chalk from "chalk";
import type { ProjectAnalysis } from "./analyser.js";
import type { MaturityAnswers } from "./maturity-profile.js";
import { output, outputBlank } from "./output.js";

export interface UserAnswers {
  principalModel: string;
  executorModel: string;
  stack: string[];
  database: string;
  styling: string;
  maturity: MaturityAnswers;
  /** Capacidades selecionadas pelo usuário (override do perfil) */
  selectedCapabilities?: string[];
  /** Whether to register shitenno-mcp in .mcp.json */
  enableMcpRegistration?: boolean;
  /** User profile for personalized feedback */
  userProfile?: {
    name: string;
    role: string;
    architecture: "junior" | "pleno" | "senior";
    coding: "junior" | "pleno" | "senior";
    leadership: "junior" | "pleno" | "senior";
    tone: "mentor" | "peer" | "relatorio";
    language: "pt" | "en";
    codeFreePercent: number;
    focusAreas: string[];
  };
}

function renderBlockHeader(icon: string, title: string): void {
  outputBlank();
  output(chalk.bold.cyan("  ╭──────────────────────────────────────╮"));
  output(chalk.bold.cyan(`  │   ${icon}  ${title.padEnd(30)}│`));
  output(chalk.bold.cyan("  ╰──────────────────────────────────────╯"));
  outputBlank();
}

async function promptAIConfig() {
  renderBlockHeader("🤖", "Configuração IA");
  return inquirer.prompt([
    { type: "input", name: "principalModel", message: "Modelo de IA principal (para planning/review):", default: "opencode/mimo-v2.5-free" },
    { type: "input", name: "executorModel", message: "Modelo de IA para build/executor:", default: "opencode/deepseek-v4-flash-free" },
  ]);
}

async function promptStackConfig(analysis: ProjectAnalysis) {
  renderBlockHeader("📦", "Stack Tecnológica");
  return inquirer.prompt([
    {
      type: "checkbox",
      name: "stack",
      message: "Stack tecnológica detectada:",
      choices: [
        { name: "React", value: "react", checked: analysis.stack.includes("react") },
        { name: "Next.js", value: "nextjs", checked: analysis.stack.includes("nextjs") },
        { name: "Vue", value: "vue", checked: analysis.stack.includes("vue") },
        { name: "Nuxt", value: "nuxt", checked: analysis.stack.includes("nuxt") },
        { name: "Svelte", value: "svelte", checked: analysis.stack.includes("svelte") },
        { name: "Expo", value: "expo", checked: analysis.stack.includes("expo") },
        { name: "React Native", value: "react-native", checked: analysis.stack.includes("react-native") },
        { name: "Angular", value: "angular", checked: analysis.stack.includes("angular") },
        { name: "TypeScript", value: "typescript", checked: analysis.hasTypeScript },
        { name: "Vite", value: "vite", checked: analysis.stack.includes("vite") },
        { name: "Tailwind CSS", value: "tailwindcss", checked: analysis.stack.includes("tailwindcss") },
        { name: "Outro", value: "other" },
      ],
    },
    { type: "list", name: "database", message: "SGBD / banco de dados:", choices: ["PostgreSQL", "MySQL", "SQLite", "MongoDB", "Supabase", "Firebase", "Nenhum", "Outro"] },
    { type: "list", name: "styling", message: "Framework de estilização:", choices: ["Tailwind CSS", "CSS Modules", "Styled Components", "Emotion", "Tamagui", "NativeWind", "Nenhum (CSS puro)", "Outro"] },
  ]);
}

async function promptExperience() {
  renderBlockHeader("👤", "Experiência");
  return inquirer.prompt([
    { type: "confirm", name: "usedShitennoBefore", message: "Já utilizou o Shugo anteriormente?", default: false },
    { type: "confirm", name: "isFirstProject", message: "É seu primeiro projeto utilizando o Shugo?", default: false },
  ]);
}

async function promptProjectInfo() {
  renderBlockHeader("📁", "Projeto");
  return inquirer.prompt([
    {
      type: "list", name: "projectAge", message: "Idade do projeto:",
      choices: [
        { name: "Novo (menos de 1 mês)", value: "new" },
        { name: "Poucos meses (1-6 meses)", value: "few_months" },
        { name: "Estabelecido (6-18 meses)", value: "established" },
        { name: "Maduro (mais de 18 meses)", value: "mature" },
      ],
    },
    {
      type: "list", name: "teamSize", message: "Tamanho da equipa:",
      choices: [
        { name: "Solo (só eu)", value: "solo" },
        { name: "Pequena (2-3 pessoas)", value: "small" },
        { name: "Média (4-8 pessoas)", value: "medium" },
        { name: "Grande (9+ pessoas)", value: "large" },
      ],
    },
    { type: "confirm", name: "hasDedicatedTeam", message: "Existe equipe dedicada ao projeto?", default: false },
  ]);
}

async function promptArchitecture() {
  renderBlockHeader("🏗️", "Arquitetura");
  return inquirer.prompt([
    { type: "confirm", name: "hasArchitectureDocs", message: "Existe documentação arquitetural?", default: false },
    { type: "confirm", name: "hasADRs", message: "Existem Architecture Decision Records (ADRs)?", default: false },
    { type: "confirm", name: "hasTechnicalReviews", message: "Há revisão técnica regular?", default: false },
  ]);
}

async function promptQuality(analysis: ProjectAnalysis) {
  renderBlockHeader("✅", "Qualidade");
  return inquirer.prompt([
    { type: "confirm", name: "hasCICD", message: "Existe CI/CD configurado?", default: analysis.hasCI },
    { type: "confirm", name: "hasAutomatedTests", message: "Existem testes automatizados?", default: analysis.hasTests },
    { type: "confirm", name: "hasValidationPipeline", message: "Existe pipeline de validação?", default: false },
  ]);
}

async function promptAIUsage() {
  renderBlockHeader("🧠", "Inteligência Artificial");
  return inquirer.prompt([
    { type: "confirm", name: "intendsToUseAI", message: "Pretende utilizar IA durante o desenvolvimento?", default: true },
    { type: "confirm", name: "aiWillImplement", message: "A IA participará da implementação?", default: true },
    { type: "confirm", name: "requiresHumanReview", message: "Haverá revisão humana obrigatória?", default: true },
  ]);
}

async function promptGovernance() {
  renderBlockHeader("📋", "Governança");
  return inquirer.prompt([
    { type: "confirm", name: "hasDefinedPatterns", message: "Existem padrões definidos?", default: false },
    { type: "confirm", name: "hasReviewProcess", message: "Existe processo de revisão?", default: false },
    { type: "confirm", name: "hasDecisionControl", message: "Existe controle de decisões?", default: false },
  ]);
}

const ROLE_CHOICES = [
  { name: "Tech Lead em Formação", value: "Tech Lead em Formação" },
  { name: "Senior Developer", value: "Senior Developer" },
  { name: "Junior Developer", value: "Junior Developer" },
  { name: "Pleno Developer", value: "Pleno Developer" },
  { name: "Architect", value: "Architect" },
  { name: "Engineering Manager", value: "Engineering Manager" },
  { name: "Outro", value: "Outro" },
];

const LEVEL_CHOICES = [
  { name: "Júnior — ainda a aprender padrões", value: "junior" },
  { name: "Pleno — conhece bem os fundamentos", value: "pleno" },
  { name: "Sênior — domina system design", value: "senior" },
];

const CODING_CHOICES = [
  { name: "Júnior — ainda a aprender", value: "junior" },
  { name: "Pleno — escreve bem", value: "pleno" },
  { name: "Sênior — domina padrões e optimização", value: "senior" },
];

const LEADERSHIP_CHOICES = [
  { name: "Júnior — foco em execução", value: "junior" },
  { name: "Pleno — começa a guiar", value: "pleno" },
  { name: "Sênior — guia o time", value: "senior" },
];

const TONE_CHOICES = [
  { name: "Mentor — suportivo, didático, encorajador", value: "mentor" },
  { name: "Peer — directo, entre pares", value: "peer" },
  { name: "Relatório — técnico, impessoal", value: "relatorio" },
];

function validateCodeFreePercent(value: string): string | true {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0 || num > 100) return "Deve ser um número entre 0 e 100";
  return true;
}

async function promptUserProfile() {
  renderBlockHeader("👤", "Perfil do Usuário");
  output(chalk.gray("  Para feedback personalizado. Pode configurar depois com 'shugo profile'."));
  outputBlank();
  return inquirer.prompt([
    { type: "input", name: "name", message: "O teu nome:", default: "Developer" },
    { type: "list", name: "role", message: "O teu cargo/role:", choices: ROLE_CHOICES },
    { type: "list", name: "architecture", message: "Nível de Arquitectura:", choices: LEVEL_CHOICES },
    { type: "list", name: "coding", message: "Nível de Código:", choices: CODING_CHOICES },
    { type: "list", name: "leadership", message: "Nível de Leadership:", choices: LEADERSHIP_CHOICES },
    { type: "list", name: "tone", message: "Tom de feedback preferido:", choices: TONE_CHOICES },
    { type: "list", name: "language", message: "Idioma do feedback:", choices: [{ name: "Português", value: "pt" }, { name: "English", value: "en" }] },
    { type: "input", name: "codeFreePercent", message: "Percentagem de feedback no-code (0-100):", default: "50", validate: validateCodeFreePercent },
    { type: "input", name: "focusAreas", message: "Áreas de foco (vírgula-separado, ex: visão,leadership):", default: "" },
  ]);
}

async function promptMcpConfig() {
  renderBlockHeader("🔌", "MCP Server");
  output(chalk.gray("  Regista o shitenno-mcp em .mcp.json para AI agents (Claude Code, Cursor, etc.)."));
  outputBlank();
  return inquirer.prompt([
    { type: "confirm", name: "enableMcpRegistration", message: "Registar servidor MCP (.mcp.json)?", default: true },
  ]);
}

export async function askQuestions(
  analysis: ProjectAnalysis
): Promise<UserAnswers> {
  outputBlank();

  const aiConfig = await promptAIConfig();
  const stackConfig = await promptStackConfig(analysis);
  const experience = await promptExperience();
  const projectInfo = await promptProjectInfo();
  const architecture = await promptArchitecture();
  const quality = await promptQuality(analysis);
  const aiUsage = await promptAIUsage();
  const governance = await promptGovernance();
  const userProfile = await promptUserProfile();
  const mcpConfig = await promptMcpConfig();

  return {
    principalModel: aiConfig.principalModel,
    executorModel: aiConfig.executorModel,
    stack: stackConfig.stack,
    database: stackConfig.database,
    styling: stackConfig.styling,
    enableMcpRegistration: mcpConfig.enableMcpRegistration,
    maturity: {
      ...experience,
      ...projectInfo,
      ...architecture,
      ...quality,
      ...aiUsage,
      ...governance,
    },
    userProfile: {
      name: userProfile.name,
      role: userProfile.role,
      architecture: userProfile.architecture as "junior" | "pleno" | "senior",
      coding: userProfile.coding as "junior" | "pleno" | "senior",
      leadership: userProfile.leadership as "junior" | "pleno" | "senior",
      tone: userProfile.tone as "mentor" | "peer" | "relatorio",
      language: userProfile.language as "pt" | "en",
      codeFreePercent: parseInt(userProfile.codeFreePercent, 10),
      focusAreas: userProfile.focusAreas
        ? userProfile.focusAreas.split(",").map((a: string) => a.trim()).filter(Boolean)
        : [],
    },
  };
}
