/**
 * scaffold/templates.ts — Template Filling and File Customization
 */

import fse from "fs-extra";
const { copySync, readFileSync, writeFileSync, existsSync, ensureDirSync, removeSync } = fse;
import { join, dirname } from "node:path";
import type { UserAnswers } from "../interface/cli/prompts.js";
import type { Capability } from "../application/maturity-profile.js";

export function fillPlaceholders(content: string, answers: UserAnswers): string {
  const stackStr = Array.isArray(answers.stack) && answers.stack.length > 0
    ? answers.stack.join(", ")
    : "a definir";
  const dbStr = answers.database || "a definir";
  const stylingStr = answers.styling || "a definir";

  return content
    .replace(/\[PERSONALIZAR: linguagens, frameworks e tecnologias usados\]/g, stackStr)
    .replace(/\[PERSONALIZAR: regras de estilização do projecto\]/g, `Usar apenas ${stylingStr} para estilização`)
    .replace(/\[PERSONALIZAR: SGBD e convenções usados\]/g, dbStr)
    .replace(/\[PERSONALIZAR: biblioteca de validação usada\]/g, "Validação de dados na camada de entrada")
    .replace(/\[PERSONALIZAR: referência ao roadmap do projecto, se existir\]/g, "[Adicionar referência ao roadmap se existir]")
    .replace(/\[PERSONALIZAR: regras específicas de ambiente de teste e deploy, se aplicável\]/g, "[Adicionar regras de ambiente se aplicável]")
    .replace(/\[PERSONALIZAR: regras específicas do design system do projecto[\s\S]*?\]/g, `[Adicionar regras do design system: ${stylingStr}]`)
    .replace(/\[PERSONALIZAR: ex: T-shaped\]/g, "T-shaped")
    .replace(/\[PERSONALIZAR: ex: senior\]/g, answers.maturity?.usedShitennoBefore ? "senior" : "pleno")
    .replace(/\[PERSONALIZAR: ex: junior-pleno\]/g, "pleno")
    .replace(/\[PERSONALIZAR: ex: peer \(par a par\)\]/g, "peer")
    .replace(/\[PERSONALIZAR: ex: mentor \(explicativo\)\]/g, answers.maturity?.isFirstProject ? "mentor" : "peer")
    .replace(/\[PERSONALIZAR: ex: calibrado por camada\]/g, "calibrado por camada")
    .replace(/opencode\/\[modelo-principal\]/g, `opencode/${(answers.principalModel || "model").replace(/^opencode\//, "")}`)
    .replace(/opencode\/\[modelo-executor\]/g, `opencode/${(answers.executorModel || "model").replace(/^opencode\//, "")}`)
    .replace(/\[PERSONALIZAR: comando de testes\]/g, "pnpm run test");
}

export function customizeContent(raw: string, dest: string, capabilities: Capability[], answers: UserAnswers): string {
  let content = fillPlaceholders(raw, answers);
  if (dest.includes("AGENTS.md")) content = filterAgentsMdByCapabilities(content, capabilities);
  if (dest.includes("SYSTEM_MAP.md")) content = updateSystemMapCapabilityStatus(content, capabilities);
  return content;
}

export function copyAndCustomizeFiles(ctx: {
  targetDir: string;
  baseDir: string;
  allFiles: Array<{ src: string; dest: string; customize?: boolean }>;
  answers: UserAnswers;
  capabilities: Capability[];
  result: { filesCreated: string[] };
}): void {
  for (const file of ctx.allFiles) {
    const srcPath = join(ctx.baseDir, file.src);
    const destPath = join(ctx.targetDir, file.dest);
    ensureDirSync(dirname(destPath));
    if (!existsSync(srcPath)) continue;

    if (file.customize) {
      const raw = readFileSync(srcPath, "utf-8");
      writeFileSync(destPath, customizeContent(raw, file.dest, ctx.capabilities, ctx.answers), "utf-8");
    } else {
      copySync(srcPath, destPath);
    }
    ctx.result.filesCreated.push(file.dest);
  }
}

export function generateOpencodeJson(
  targetDir: string,
  baseDir: string,
  answers: UserAnswers,
  result: { filesCreated: string[] }
): void {
  const opencodeTemplate = readFileSync(join(baseDir, "opencode.json"), "utf-8");
  const opencodeContent = opencodeTemplate
    .replace(/\[modelo-principal\]/g, answers.principalModel.replace(/^opencode\//, ""))
    .replace(/\[modelo-executor\]/g, answers.executorModel.replace(/^opencode\//, ""));
  writeFileSync(join(targetDir, "opencode.json"), opencodeContent, "utf-8");
  result.filesCreated.push("opencode.json");
}

export function removeTemplateFile(targetDir: string, shitennoDirName: string): void {
  const templatePath = join(targetDir, shitennoDirName, "profile", "_template.config.ts");
  if (existsSync(templatePath)) removeSync(templatePath);
}

function filterAgentsMdByCapabilities(
  content: string,
  installedCapabilities: Capability[]
): string {
  const capabilityBlockRegex = /<!-- CAPABILITY: (\w+) -->[\s\S]*?<!-- \/CAPABILITY -->/g;

  return content.replace(capabilityBlockRegex, (match, capability: string) => {
    if (installedCapabilities.includes(capability as Capability)) {
      return match
        .replace(/<!-- CAPABILITY: \w+ -->\n?/, "")
        .replace(/<!-- \/CAPABILITY -->\n?$/, "");
    }
    return "";
  });
}

const CAPABILITY_DEFS: Array<{ id: string; name: string; description: string }> = [
  { id: "core", name: "core", description: "Fundação básica (docs, scripts, opencode.json)" },
  { id: "knowledge", name: "knowledge", description: "Skills, AGENTS.md regras, documentação" },
  { id: "governance", name: "governance", description: "Workflows, context buffer, handoffs" },
  { id: "architecture", name: "architecture", description: "ADRs, SDRs, planos, session templates" },
  { id: "ai", name: "ai", description: "Contratos de agentes, cognition, prompts" },
  { id: "quality", name: "quality", description: "Scripts de validação, sync-docs" },
  { id: "metrics", name: "metrics", description: "Relatórios, histórico" },
  { id: "operations", name: "operations", description: "Runbooks, close-session, premortem" },
  { id: "compliance", name: "compliance", description: "Premortem reviews, session reviews" },
];

export function updateSystemMapCapabilityStatus(
  content: string,
  installedCapabilities: Capability[]
): string {
  const blockRegex = /<!-- CAPABILITY_STATUS -->[\s\S]*?<!-- \/CAPABILITY_STATUS -->/;

  const newRows = CAPABILITY_DEFS.map((cap) => {
    const isInstalled = installedCapabilities.includes(cap.id as Capability);
    const icon = isInstalled ? "✅" : "📋";
    const status = isInstalled ? "instalado" : "disponível";
    return `| \`${cap.name}\` | ${icon} ${status} | ${cap.description} |`;
  });

  const newBlock = [
    "<!-- CAPABILITY_STATUS -->",
    "As capacidades instaladas neste projecto determinam quais secções do AGENTS.md",
    "estão activas. Execute `shugo upgrade --list` para ver todas as capacidades.",
    "",
    "| Capacidade | Estado | Descrição |",
    "|---|---|---|",
    ...newRows,
    "<!-- /CAPABILITY_STATUS -->",
  ].join("\n");

  return content.replace(blockRegex, newBlock);
}
