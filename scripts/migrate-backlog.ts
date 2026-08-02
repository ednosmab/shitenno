/**
 * migrate-backlog.ts — Migração one-shot do BACKLOG.md monolítico
 * para docs/backlog/{ACTIVE,DONE}.md. Parser customizado para o formato real do BACKLOG.md.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

interface BacklogItem {
  id: string;
  title: string;
  state: string;
  severity: string;
  priority: string;
  owner: string;
  description: string;
}

const SOURCE = ".shitenno/docs/BACKLOG.md";
const ACTIVE_DEST = ".shitenno/docs/backlog/ACTIVE.md";
const DONE_DEST = ".shitenno/docs/backlog/DONE.md";
const README_DEST = ".shitenno/docs/backlog/README.md";

function parseBacklogManually(content: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split("\n");

  let currentSection = "";
  let currentItem: Partial<BacklogItem> | null = null;
  let inDoneTable = false;
  let doneTableItems: BacklogItem[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    // Detect sections (P0, P1, P2, P3, Done, Completed Items)
    const sectionMatch = line.match(/^## (P[0-9]+|Done|Completed Items)\s?/);
    if (sectionMatch) {
      currentSection = sectionMatch[1] === "Completed Items" ? "Done" : sectionMatch[1]!;
      inDoneTable = currentSection === "Done";
      
      // Save previous item
      if (currentItem?.id) {
        items.push(currentItem as BacklogItem);
      }
      currentItem = null;
      continue;
    }

    // Parse the Done table (first table under ## Done)
    if (inDoneTable && line.startsWith("| ") && !line.startsWith("| Item") && !line.startsWith("|---")) {
      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length >= 3) {
        const [item, severity, resolution] = cells;
        if (item && item !== "Item" && item !== "---") {
          doneTableItems.push({
            id: item.split(" ")[0]!,
            title: item,
            state: "Done",
            severity,
            priority: "",
            owner: "",
            description: resolution
          });
        }
      }
      continue;
    }

    // Parse detailed items (### ID Title)
    const itemMatch = line.match(/^### (.+)/);
    if (itemMatch) {
      if (currentItem?.id) {
        items.push(currentItem as BacklogItem);
      }

      const titleRaw = itemMatch[1]!;
      const id = titleRaw.split(" ")[0]!;
      currentItem = {
        id,
        title: titleRaw,
        state: currentSection === "Done" ? "Done" : "",
        severity: "",
        priority: currentSection,
        owner: "",
        description: "",
      };
      continue;
    }

    // Parse table fields
    if (currentItem && line.startsWith("| **")) {
      const match = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (match) {
        const [, key, value] = match;
        const val = value!.trim().replace(/\|$/, "").trim();

        switch (key) {
          case "Status":
            currentItem.state = val;
            break;
          case "Severidade":
            currentItem.severity = val;
            break;
          case "Prioridade":
            currentItem.priority = val;
            break;
          case "Owner":
            currentItem.owner = val;
            break;
          case "Descricao":
            currentItem.description = val;
            break;
        }
      }
    }
  }

  // Don't forget last item
  if (currentItem?.id) {
    items.push(currentItem as BacklogItem);
  }

  // Combine done table items with detailed Done items
  return [...doneTableItems, ...items];
}

function renderBacklogSection(items: BacklogItem[], title: string): string {
  if (items.length === 0) return "";

  const p0 = items.filter((i) => i.priority === "P0");
  const p1 = items.filter((i) => i.priority === "P1");
  const p2 = items.filter((i) => i.priority === "P2");
  const p3 = items.filter((i) => i.priority === "P3");

  let section = `## ${title}\n\n`;
  section += `> **Total:** ${items.length} itens (${p0.length} P0, ${p1.length} P1, ${p2.length} P2, ${p3.length} P3)\n\n`;

  for (const item of items) {
    section += `### ${item.id} ${item.title}\n\n`;
    section += `| Campo | Valor |\n`;
    section += `|---|---|\n`;
    section += `| **Status** | ${item.state} |\n`;
    section += `| **Severidade** | ${item.severity} |\n`;
    section += `| **Prioridade** | ${item.priority} |\n`;
    section += `| **Owner** | ${item.owner || "unassigned"} |\n`;
    section += `| **Descricao** | ${item.description} |\n\n`;
  }

  return section;
}

function renderDoneSection(items: BacklogItem[]): string {
  if (items.length === 0) return "";

  let section = `## Done\n\n`;
  section += `| Item | Severidade | Resolucao |\n`;
  section += `|---|---|---|\n`;

  for (const item of items) {
    const title = item.title.replace(item.id + " ", "");
    section += `| ${item.id} ${title} | ${item.severity} | ${item.description || "Concluído"} |\n`;
  }

  return section;
}

function renderReadme(): string {
  return `# BACKLOG.md (movido)

Este arquivo foi dividido para reduzir o tamanho de contexto carregado por sessão:

- Itens ativos (Backlog / In Progress / Paused): \`.shitenno/docs/backlog/ACTIVE.md\`
- Itens concluídos (histórico): \`.shitenno/docs/backlog/DONE.md\`
`;
}

function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Arquivo fonte não encontrado: ${SOURCE}`);
    process.exit(1);
  }

  const content = readFileSync(SOURCE, "utf-8");
  const items = parseBacklogManually(content);

  console.log(`Total de itens parseados: ${items.length}`);

  // Separar por status
  const done = items.filter((i) => i.state === "Done" || i.state.includes("Done"));
  const active = items.filter((i) => i.state !== "Done" && !i.state.includes("Done"));

  console.log(`Itens Done: ${done.length}`);
  console.log(`Itens Ativos: ${active.length}`);

  // Criar diretório se não existir
  const dir = ".shitenno/docs/backlog";
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Gerar arquivos
  const activeContent = renderBacklogSection(active, "Ativo");
  const doneContent = renderDoneSection(done);
  const readmeContent = renderReadme();

  writeFileSync(ACTIVE_DEST, activeContent, "utf-8");
  writeFileSync(DONE_DEST, doneContent, "utf-8");
  writeFileSync(README_DEST, readmeContent, "utf-8");

  console.log(`Migrados: ${done.length} done, ${active.length} ativos. Total: ${items.length}.`);
  console.log(`Arquivos criados:`);
  console.log(`  - ${ACTIVE_DEST}`);
  console.log(`  - ${DONE_DEST}`);
  console.log(`  - ${README_DEST}`);
}

main();