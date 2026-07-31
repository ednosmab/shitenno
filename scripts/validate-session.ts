import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const GOV = resolve(ROOT, 'shitenno', 'governance');
const DOCS = resolve(ROOT, 'shitenno', 'docs');

let exitCode = 0;

function fail(check: string, detail: string) {
  console.error(`❌ [${check}] ${detail}`);
  exitCode = 1;
}

function pass(check: string, detail: string) {
  console.log(`✅ [${check}] ${detail}`);
}

function warn(check: string, detail: string) {
  console.warn(`⚠️  [${check}] ${detail}`);
}

// ── 1. Context: Is there an active task? ─────────────────────────────────
function checkActiveTask() {
  const yamlPath = resolve(GOV, 'context/context_buffer.yaml');
  if (!existsSync(yamlPath)) {
    fail('ACTIVE_TASK', 'context_buffer.yaml not found');
    return;
  }
  const content = readFileSync(yamlPath, 'utf-8');
  if (content.includes('current_task:') && content.includes('in_progress')) {
    pass('ACTIVE_TASK', 'Active task found in context_buffer.yaml');
  } else {
    warn('ACTIVE_TASK', 'No active task in progress');
  }
}

// ── 2. Governance: Was ADR created when architecture changed? ─────────────
function checkAdrRequired() {
  const adrDir = resolve(DOCS, 'adrs');
  if (!existsSync(adrDir)) {
    warn('ADR_CHECK', 'No adrs/ directory found');
    return;
  }
  const adrs = execSync(
    `ls -1 "${adrDir}"/*.md 2>/dev/null | wc -l`,
    { encoding: 'utf-8', cwd: ROOT }
  ).trim();
  const count = parseInt(adrs, 10);
  if (count > 0) {
    pass('ADR_CHECK', `${count} ADRs exist`);
  } else {
    warn('ADR_CHECK', 'No ADRs found');
  }
}

// ── 3. Config: Is opencode.json consistent? ───────────────────────────────
function checkOpencodeConfig() {
  const configPath = resolve(ROOT, 'opencode.json');
  if (!existsSync(configPath)) {
    fail('CONFIG_CHECK', 'opencode.json not found');
    return;
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    if (config.model && config.agent) {
      pass('CONFIG_CHECK', 'opencode.json has model and agent config');
    } else {
      warn('CONFIG_CHECK', 'opencode.json missing model or agent');
    }
  } catch {
    fail('CONFIG_CHECK', 'opencode.json is not valid JSON');
  }
}

// ── 4. Agents: Are governance/agents contracts consistent? ────────────────
function checkAgentContracts() {
  const agentsDir = resolve(GOV, 'agents');
  if (!existsSync(agentsDir)) {
    warn('AGENTS_CHECK', 'governance/agents/ not found');
    return;
  }
  const files = execSync(
    `ls -1 "${agentsDir}"/*.yaml 2>/dev/null | wc -l`,
    { encoding: 'utf-8', cwd: ROOT }
  ).trim();
  const count = parseInt(files, 10);
  if (count > 0) {
    pass('AGENTS_CHECK', `${count} agent contracts exist`);
  } else {
    warn('AGENTS_CHECK', 'No agent contracts found');
  }
}

// ── 5. State: Is context_buffer.yaml valid? ───────────────────────────────
function checkBufferState() {
  const yamlPath = resolve(GOV, 'context/context_buffer.yaml');
  if (!existsSync(yamlPath)) {
    fail('BUFFER_STATE', 'context_buffer.yaml not found');
    return;
  }
  const content = readFileSync(yamlPath, 'utf-8');
  if (content.includes('session:') && content.includes('current_task:')) {
    pass('BUFFER_STATE', 'context_buffer.yaml has required sections');
  } else {
    fail('BUFFER_STATE', 'context_buffer.yaml missing required sections');
  }
}

// ── Execute ───────────────────────────────────────────────────────────────
console.log('\n🔍 VALIDATE SESSION — Checking session integrity\n');

checkActiveTask();
checkAdrRequired();
checkOpencodeConfig();
checkAgentContracts();
checkBufferState();

console.log(`\n${exitCode === 0 ? '✅ All checks passed' : '❌ Some checks failed'}\n`);
process.exit(exitCode);
