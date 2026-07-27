import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import fse from "fs-extra";

const { readdirSync } = fse;

export function getFilesToSync(shitennoDir: string, _targetDir: string): string[] {
  const files: string[] = [];

  const coreFiles = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Shitenno_GUIDE.md",
    "opencode.json",
    "scripts/validate-session.ts",
    "scripts/close-session.ts",
  ];

  for (const file of coreFiles) {
    if (existsSync(join(shitennoDir, file))) {
      files.push(file);
    }
  }

  const skillsDir = join(shitennoDir, "docs/skills");
  if (existsSync(skillsDir)) {
    const skillFiles = readdirSync(skillsDir).filter((f: string) =>
      f.endsWith(".md")
    );
    for (const skill of skillFiles) {
      files.push(`docs/skills/${skill}`);
    }
  }

  return files;
}

export function shouldPreserveCustomizations(filePath: string): boolean {
  const preserveList = [
    "docs/AGENTS.md",
    "docs/opencode-context.md",
    "docs/Shitenno_GUIDE.md",
    "opencode.json",
  ];
  return preserveList.includes(filePath);
}

export function mergeWithCustomizations(
  shitennoFile: string,
  targetFile: string
): string {
  const shitennoContent = readFileSync(shitennoFile, "utf-8");
  const targetContent = readFileSync(targetFile, "utf-8");

  if (shitennoFile.endsWith(".json")) {
    return mergeJsonFiles(shitennoContent, targetContent);
  }

  if (shitennoFile.endsWith(".md")) {
    return mergeMarkdownFiles(shitennoContent, targetContent);
  }

  return shitennoContent;
}

export function mergeJsonFiles(shitennoContent: string, targetContent: string): string {
  try {
    const shugo = JSON.parse(shitennoContent);
    const target = JSON.parse(targetContent);

    const preserved: Record<string, unknown> = {};

    if (target.agent && shugo.agent) {
      preserved.agent = { ...shugo.agent };
      for (const [agentName, agentConfig] of Object.entries(target.agent)) {
        if (!preserved.agent || typeof preserved.agent !== "object") continue;
        const preservedAgent = preserved.agent[agentName as keyof typeof preserved.agent] as Record<string, unknown> | undefined;
        if (!preservedAgent) continue;
        const targetAgent = agentConfig as Record<string, unknown>;
        if (targetAgent.model) preservedAgent.model = targetAgent.model;
        if (targetAgent.permission) preservedAgent.permission = targetAgent.permission;
      }
    }

    if (target.mcp) preserved.mcp = target.mcp;

    return JSON.stringify({ ...shugo, ...preserved }, null, 2);
  } catch {
    return shitennoContent;
  }
}

export function mergeMarkdownFiles(shitennoContent: string, targetContent: string): string {
  const shitennoSections = extractSections(shitennoContent);
  const targetSections = extractSections(targetContent);

  let result = shitennoContent;

  for (const [sectionTitle, sectionContent] of Object.entries(targetSections)) {
    if (!shitennoSections[sectionTitle]) {
      result += `\n\n${sectionContent}`;
    }
    else if (shitennoSections[sectionTitle] !== sectionContent) {
      if (!sectionContent.includes("[PERSONALIZAR:") && !sectionContent.includes("[Adicionar")) {
        result = result.replace(shitennoSections[sectionTitle], sectionContent);
      }
    }
  }

  return result;
}

export function extractSections(content: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const lines = content.split("\n");
  let currentSection = "";
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      if (currentSection) {
        sections[currentSection] = currentContent.join("\n");
      }
      currentSection = headingMatch[2]?.trim() ?? "";
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  if (currentSection) {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}
