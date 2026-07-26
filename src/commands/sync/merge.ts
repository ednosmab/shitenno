import { readFileSync } from "node:fs";

export function shouldPreserveCustomizations(filePath: string): boolean {
  // Files that should preserve project-specific customizations
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

  // JSON files: merge preserving project-specific values
  if (shitennoFile.endsWith(".json")) {
    return mergeJsonFiles(shitennoContent, targetContent);
  }

  // Markdown files: preserve custom sections, update/add shugo sections
  if (shitennoFile.endsWith(".md")) {
    return mergeMarkdownFiles(shitennoContent, targetContent);
  }

  // For other files, use shugo content
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
  // Extract sections from both files
  const shitennoSections = extractSections(shitennoContent);
  const targetSections = extractSections(targetContent);

  // Start with shugo content as base
  let result = shitennoContent;

  // For each section in target, check if it's a custom section
  for (const [sectionTitle, sectionContent] of Object.entries(targetSections)) {
    // If section doesn't exist in shugo, it's custom - preserve it
    if (!shitennoSections[sectionTitle]) {
      // Add custom section at the end
      result += `\n\n${sectionContent}`;
    }
    // If section exists but content differs, check if it's personalized
    else if (shitennoSections[sectionTitle] !== sectionContent) {
      // Check if target section contains personalized content (not placeholders)
      if (!sectionContent.includes("[PERSONALIZAR:") && !sectionContent.includes("[Adicionar")) {
        // Preserve user's personalized content
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
    // Check if line is a heading (## or ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections[currentSection] = currentContent.join("\n");
      }
      // Start new section
      currentSection = headingMatch[2]?.trim() ?? "";
      currentContent = [line];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join("\n");
  }

  return sections;
}
