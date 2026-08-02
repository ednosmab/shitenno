/**
 * handbook.ts — Shugo Handbook CLI Command
 *
 * The `shugo handbook` command. By default, launches an interactive TUI.
 * Use --print for non-interactive mode.
 *
 * Usage:
 *   shugo handbook                  # Interactive TUI (default)
 *   shugo handbook --print          # Print content and exit
 *   shugo handbook --print --level 1  # Print only fundamentals
 *   shugo handbook --list           # List all available topics
 */

import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { banner } from "../formatting.js";
import { output, outputBlank } from "../output.js";

function findHandbookRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, "docs", "handbook"))) return join(dir, "docs", "handbook");
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume running from project root
  return join(process.cwd(), "docs", "handbook");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDBOOK_ROOT = findHandbookRoot(__dirname);

// ── Types ──────────────────────────────────────────────────────────────────

interface HandbookTopic {
  level: number;
  levelName: string;
  file: string;
  title: string;
  description: string;
}

// ── Topic Registry ─────────────────────────────────────────────────────────

const TOPICS: HandbookTopic[] = [
  // Level 1 — Fundamentals
  { level: 1, levelName: "Fundamentos", file: "01-fundamentals/what-is-shugo.md", title: "O que é Shugo", description: "Definição, problema que resolve, para quem serve" },
  { level: 1, levelName: "Fundamentos", file: "01-fundamentals/installation.md", title: "Instalação", description: "Pré-requisitos, métodos de instalação, verificação" },
  { level: 1, levelName: "Fundamentos", file: "01-fundamentals/quick-start.md", title: "Primeiros Passos", description: "Init, status, detect, briefing, feedback" },
  { level: 1, levelName: "Fundamentos", file: "01-fundamentals/concepts.md", title: "Conceitos", description: "Maturity, capabilities, governance, knowledge debt" },

  // Level 2 — Commands
  { level: 2, levelName: "Comandos", file: "02-commands/setup.md", title: "Setup & Config", description: "init, mcp, upgrade, clean" },
  { level: 2, levelName: "Comandos", file: "02-commands/analysis.md", title: "Status & Análise", description: "status, audit, doctor, assess, detect" },
  { level: 2, levelName: "Comandos", file: "02-commands/pipeline.md", title: "Pipeline & Execução", description: "run, evolve, act, plan" },
  { level: 2, levelName: "Comandos", file: "02-commands/governance.md", title: "Governança", description: "goal, decide, policy" },
  { level: 2, levelName: "Comandos", file: "02-commands/reports.md", title: "Relatórios", description: "console, report, digest, bench" },
  { level: 2, levelName: "Comandos", file: "02-commands/ai-integration.md", title: "Integração AI", description: "briefing, feedback, profile, dashboard, reminders" },
  { level: 2, levelName: "Comandos", file: "02-commands/system.md", title: "Sistema", description: "validate, shell-init" },
  { level: 2, levelName: "Comandos", file: "02-commands/documentation.md", title: "Documentação", description: "docs-audit" },

  // Level 3 — Architecture
  { level: 3, levelName: "Arquitetura", file: "03-architecture/event-system.md", title: "Sistema de Eventos", description: "Event bus, tipos de eventos, subscribe/publish" },
  { level: 3, levelName: "Arquitetura", file: "03-architecture/rule-engine.md", title: "Rule Engine", description: "Regras reativas, triggers, como criar regras" },
  { level: 3, levelName: "Arquitetura", file: "03-architecture/mcp-server.md", title: "MCP Server", description: "Protocolo MCP, configuração, uso com AI agents" },
  { level: 3, levelName: "Arquitetura", file: "03-architecture/custom-rules.md", title: "Regras Customizadas", description: "Como criar regras próprias" },
  { level: 3, levelName: "Arquitetura", file: "03-architecture/contributing.md", title: "Contribuindo", description: "Guia para contribuidores" },
];

// ── Print Mode Functions ───────────────────────────────────────────────────

function readTopicContent(topic: HandbookTopic): string | null {
  const filePath = join(HANDBOOK_ROOT, topic.file);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

function printTopicContent(topic: HandbookTopic): void {
  const content = readTopicContent(topic);
  if (!content) {
    output(chalk.red(`  Arquivo não encontrado: ${topic.file}`));
    return;
  }

  outputBlank();
  output(chalk.bold.cyan(`# ${topic.title}`));
  output(chalk.gray(`Nível ${topic.level} — ${topic.levelName}`));
  outputBlank();
  output(content);
}

function printLevel(level: number): void {
  const topics = TOPICS.filter((t) => t.level === level);
  if (topics.length === 0) {
    output(chalk.red(`  Nível ${level} não encontrado.`));
    return;
  }

  const levelName = topics[0]!.levelName;

  outputBlank();
  banner(`shugo handbook --print --level ${level}`, levelName);
  outputBlank();

  for (const topic of topics) {
    printTopicContent(topic);
    outputBlank();
    output(chalk.gray("─".repeat(60)));
    outputBlank();
  }
}

function printAllLevels(): void {
  outputBlank();
  banner("shugo handbook --print", "Handbook Completo");
  outputBlank();

  for (const topic of TOPICS) {
    printTopicContent(topic);
    outputBlank();
    output(chalk.gray("─".repeat(60)));
    outputBlank();
  }
}

function listTopics(): void {
  outputBlank();
  banner("shugo handbook", "Todos os Tópicos");
  outputBlank();

  let currentLevel = 0;

  for (const topic of TOPICS) {
    if (topic.level !== currentLevel) {
      currentLevel = topic.level;
      output(chalk.bold.green(`  Nível ${topic.level} — ${topic.levelName}:`));
    }

    const filePath = join(HANDBOOK_ROOT, topic.file);
    const exists = existsSync(filePath);
    const status = exists ? chalk.green("✅") : chalk.red("❌");

    output(`    ${status} ${chalk.bold(topic.title)} — ${chalk.gray(topic.description)}`);
  }

  outputBlank();
}

// ── Command Export ─────────────────────────────────────────────────────────

export const handbookCommand = new Command("handbook")
  .description("Exibe o handbook de referência do Shugo (TUI interativo por padrão). Acessibilidade: use --print para saida em texto plano compativel com screen readers.")
  .option("--print", "Modo nao-interativo: imprime conteudo em texto plano e sai (recomendado para screen readers)")
  .option("--level <number>", "Mostrar apenas um nivel (1, 2 ou 3) — funciona com --print")
  .option("--list", "Listar todos os topicos disponiveis")
  .action(async (options) => {
    // List mode
    if (options.list) {
      listTopics();
      return;
    }

    // Print mode (non-interactive)
    if (options.print) {
      if (options.level) {
        const level = parseInt(options.level, 10);
        if (level < 1 || level > 3) {
          output(chalk.red("  Nível inválido. Use 1, 2 ou 3."));
          return;
        }
        printLevel(level);
        return;
      }

      printAllLevels();
      return;
    }

    // Interactive mode (default)
    try {
      const { render } = await import("ink");
      const { HandbookApp } = await import("../handbook/index.js");
      // Clear screen + cursor home so sidebar items are at known positions
      process.stdout.write("\x1B[2J\x1B[H");
      const { waitUntilExit } = render(React.createElement(HandbookApp));
      await waitUntilExit();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      output(chalk.red(`  ✘ Failed to launch handbook: ${msg}`));
      output(chalk.gray("  Falling back to static output..."));
      outputBlank();
      printAllLevels();
    }
  });
