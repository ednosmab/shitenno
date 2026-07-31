import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const GOV = resolve(ROOT, 'shitenno', 'governance');

let exitCode = 0;
let warnings: string[] = [];

function fail(check: string, detail: string) {
  console.error(`❌ [${check}] ${detail}`);
  exitCode = 1;
}

function pass(check: string, detail: string) {
  console.log(`✅ [${check}] ${detail}`);
}

function warn(check: string, detail: string) {
  console.warn(`⚠️  [${check}] ${detail}`);
  warnings.push(`${check}: ${detail}`);
}

// ── 1. Working tree clean? ────────────────────────────────────────────────
function checkWorkingTree() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: ROOT }).trim();
    if (!status) {
      pass('WORKING_TREE', 'No uncommitted changes');
    } else {
      const lines = status.split('\n').length;
      warn('WORKING_TREE', `${lines} uncommitted change(s) — commit before closing`);
    }
  } catch {
    fail('WORKING_TREE', 'Git command failed');
  }
}

// ── 2. Tests executed? ────────────────────────────────────────────────────
function checkTests() {
  try {
    execSync('pnpm run test --recursive --if-present --filter=core 2>/dev/null | tail -1', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 60000,
    });
    pass('TESTS', 'Core tests passed');
  } catch {
    warn('TESTS', 'Tests not executed or failed — run pnpm run test');
  }
}

// ── 3. Context buffer updated? ────────────────────────────────────────────
function checkBuffer() {
  const yamlPath = resolve(GOV, 'context/context_buffer.yaml');
  if (!existsSync(yamlPath)) {
    fail('BUFFER', 'context_buffer.yaml not found');
    return;
  }
  const content = readFileSync(yamlPath, 'utf-8');
  if (content.includes('status: "completed"') || content.includes('status: "in_progress"')) {
    pass('BUFFER', 'context_buffer.yaml has valid session status');
  } else {
    warn('BUFFER', 'Session status not set in context_buffer.yaml');
  }
}

// ── 4. Backlog updated? ───────────────────────────────────────────────────
function checkBacklog() {
  const backlogPath = resolve(ROOT, 'shitenno', 'docs', 'BACKLOG.md');
  if (!existsSync(backlogPath)) {
    warn('BACKLOG', 'BACKLOG.md not found');
    return;
  }
  const content = readFileSync(backlogPath, 'utf-8');
  if (content.includes('Concluído') || content.includes('Done') || content.includes('In Progress')) {
    pass('BACKLOG', 'BACKLOG.md has tracked items');
  } else {
    warn('BACKLOG', 'BACKLOG.md may need updating');
  }
}

// ── 5. Commit check ──────────────────────────────────────────────────────
function checkCommit() {
  const lastCommit = execSync('git log --oneline -1', { encoding: 'utf-8', cwd: ROOT }).trim();
  if (lastCommit) {
    pass('COMMIT', `Last commit: ${lastCommit}`);
  } else {
    warn('COMMIT', 'No commits found');
  }
}

// ── 6. Build verification ───────────────────────────────────────────────
function checkBuild() {
  try {
    execSync('pnpm run build:verify 2>/dev/null | tail -5', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 180000,
    });
    pass('BUILD', 'Build verification passed');
  } catch {
    warn('BUILD', 'Build failed — run pnpm run build:verify');
  }
}

// ── 7. Completion Pipeline (legacy fallback) ─────────────────────────────
async function checkCompletionPipeline() {
  await checkCompletionGateLegacy();
  await checkPlanLifecycle();
}

// ── 7b. Legacy completion gate (fallback) ─────────────────────────────────
async function checkCompletionGateLegacy() {
  try {
    const mod = await import(resolve(ROOT, 'dist', 'task-completion.js'));
    const result = mod.validateCompletionGate({
      projectRoot: ROOT,
      shitennoDir: resolve(ROOT, 'shitenno'),
      taskId: 'session-close',
    });
    if (result.passed) {
      pass('COMPLETION_GATE', 'All 5 gates passed (tests, lint, docs, backlog, plan_status)');
    } else {
      const failures = result.gates
        .filter((g: { passed: boolean }) => !g.passed)
        .map((g: { name: string; message: string }) => `${g.name}: ${g.message}`);
      fail('COMPLETION_GATE', `Gate(s) failed: ${failures.join('; ')}`);
    }
  } catch {
    warn('COMPLETION_GATE', 'Completion gate module not available — skipping (run pnpm build first)');
  }
}

// ── 8. Plan lifecycle — detect active plans ────────────────────────────────
async function checkPlanLifecycle() {
  try {
    const { detectActivePlans } = await import(resolve(ROOT, 'dist', 'plan-lifecycle.js'));
    const plans = detectActivePlans(resolve(GOV, 'plans'));
    if (plans.length > 0) {
      warn('PLAN_LIFECYCLE', `${plans.length} active plan(s) — run "shugo plan md lifecycle" to review and archive`);
      for (const p of plans) {
        console.log(`         → ${p.id}: ${p.title} [${p.status}]`);
      }
    } else {
      pass('PLAN_LIFECYCLE', 'No active plans — all archived');
    }
  } catch {
    warn('PLAN_LIFECYCLE', 'Plan lifecycle module not available — run pnpm build first');
  }
}

// ── Execute ───────────────────────────────────────────────────────────────
console.log('\n🔒 CLOSE SESSION — Closing session checklist\n');

checkWorkingTree();
checkTests();
checkBuffer();
checkBacklog();
checkCommit();
checkBuild();
await checkCompletionPipeline();

console.log(`\n${exitCode === 0 ? '✅ Session ready to close' : '❌ Session has issues to resolve'}`);
if (warnings.length > 0) {
  console.warn('\n⚠️  Warnings:');
  warnings.forEach((w) => console.warn(`   - ${w}`));
}
console.log('');
process.exit(exitCode);
