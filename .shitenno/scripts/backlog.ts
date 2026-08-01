import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const BACKLOG_MODULAR = resolve(ROOT, '.shitenno', 'docs', 'backlog', 'ACTIVE.md');
const BACKLOG_LEGACY = resolve(ROOT, '.shitenno', 'docs', 'BACKLOG.md');
const BACKLOG = existsSync(BACKLOG_MODULAR) ? BACKLOG_MODULAR : BACKLOG_LEGACY;

// ── CLI Flags ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ALL = args.includes('--all') || args.includes('-a');
const JSON_OUTPUT = args.includes('--json') || args.includes('-j');
const PRIORITY = args.includes('--priority') || args.includes('-p');
const priorityValue = PRIORITY ? args[args.indexOf('--priority') + 1] || args[args.indexOf('-p') + 1] : undefined;

// ── Types ──────────────────────────────────────────────────────────────────

interface BacklogItem {
  id: string;
  title: string;
  status: string;
  severity: string;
  priority: string;
  owner: string;
  description: string;
}

// ── Parser ─────────────────────────────────────────────────────────────────

function parseBacklog(content: string): BacklogItem[] {
  const items: BacklogItem[] = [];
  const lines = content.split('\n');
  
  let currentSection = '';
  let currentItem: Partial<BacklogItem> | null = null;
  
  for (const line of lines) {
    // Detect section headers (## P0, ## P1, ## P2, ## P3)
    const sectionMatch = line.match(/^## (P[0-9]+)\s/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }
    
    // Detect item headers (### 2.1, ### SA3, ### NEW-001, etc.)
    const itemMatch = line.match(/^### (.+)/);
    if (itemMatch) {
      // Save previous item
      if (currentItem?.id) {
        items.push(currentItem as BacklogItem);
      }
      
      const title = itemMatch[1];
      const id = title.split(' ')[0];
      currentItem = {
        id,
        title,
        status: '',
        severity: '',
        priority: currentSection,
        owner: '',
        description: '',
      };
      continue;
    }
    
    // Parse table rows
    if (currentItem && line.startsWith('| **')) {
      const match = line.match(/\*\*(\w+)\*\*\s*\|\s*(.+?)\s*\|?\s*$/);
      if (match) {
        const [, key, value] = match;
        const val = value.trim().replace(/\|$/, '').trim();
        
        switch (key) {
          case 'Status':
            currentItem.status = val;
            break;
          case 'Severity':
            currentItem.severity = val;
            break;
          case 'Priority':
            currentItem.priority = val;
            break;
          case 'Owner':
            currentItem.owner = val;
            break;
          case 'Descricao':
            currentItem.description = val;
            break;
        }
      }
    }
  }
  
  // Push last item
  if (currentItem?.id) {
    items.push(currentItem as BacklogItem);
  }
  
  return items;
}

// ── Output Formatters ──────────────────────────────────────────────────────

function formatTable(items: BacklogItem[]): string {
  if (items.length === 0) {
    return 'Nenhum item encontrado.';
  }
  
  const header = '| ID | Prioridade | Severidade | Status | Titulo | Owner |';
  const separator = '|---|---|---|---|---|---|';
  const rows = items.map(item => 
    `| ${item.id} | ${item.priority} | ${item.severity} | ${item.status} | ${item.title} | ${item.owner} |`
  );
  
  return [header, separator, ...rows].join('\n');
}

function formatJson(items: BacklogItem[]): string {
  return JSON.stringify(items, null, 2);
}

function formatCompact(items: BacklogItem[]): string {
  if (items.length === 0) {
    return 'Nenhum item encontrado.';
  }
  
  const byPriority = items.reduce((acc, item) => {
    const p = item.priority || 'P?';
    if (!acc[p]) acc[p] = [];
    acc[p].push(item);
    return acc;
  }, {} as Record<string, BacklogItem[]>);
  
  const lines: string[] = [];
  const priorities = ['P0', 'P1', 'P2', 'P3'];
  
  for (const p of priorities) {
    const pItems = byPriority[p];
    if (pItems && pItems.length > 0) {
      lines.push(`\n${p} (${pItems.length} itens):`);
      for (const item of pItems) {
        const icon = item.severity === 'Critico' ? '🔴' : 
                     item.severity === 'Alto' ? '🟠' : 
                     item.severity === 'Medio' ? '🟡' : '🟢';
        lines.push(`  ${icon} ${item.id} — ${item.title}`);
      }
    }
  }
  
  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

function main() {
  if (!existsSync(BACKLOG)) {
    console.error('BACKLOG.md nao encontrado:', BACKLOG);
    process.exit(1);
  }
  
  const content = readFileSync(BACKLOG, 'utf-8');
  let items = parseBacklog(content);
  
  // Filter: only active items (not Done)
  if (!ALL) {
    items = items.filter(item => item.status !== 'Done');
  }
  
  // Filter by priority
  if (priorityValue) {
    const p = priorityValue.toUpperCase();
    items = items.filter(item => item.priority === p);
  }
  
  // Output
  if (JSON_OUTPUT) {
    console.log(formatJson(items));
  } else if (ALL) {
    console.log(formatTable(items));
  } else {
    console.log(`📋 BACKLOG — ${items.length} itens activos\n`);
    console.log(formatCompact(items));
    console.log(`\nUse --all para ver todos os itens, --json para formato JSON, --priority P1 para filtrar.`);
  }
}

main();
