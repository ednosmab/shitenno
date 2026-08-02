import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..', '..');
const GOV = resolve(ROOT, '.shitenno', 'governance');

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
function checkTestsLocal() {
  try {
    const pkgPath = resolve(ROOT, 'package.json');
    if (!existsSync(pkgPath)) {
      warn('TESTS', 'No package.json found — cannot run tests');
      return;
    }
    let testScript = '';
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      testScript = pkg.scripts?.test ?? '';
    } catch { /* no-op */ }

    if (!testScript) {
      warn('TESTS', 'No test script in package.json — cannot verify');
      return;
    }

    execSync('npm run test 2>/dev/null | tail -1', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 120000,
    });
    pass('TESTS', 'Tests passed');
  } catch {
    warn('TESTS', 'Tests not executed or failed — run your project test command');
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
  const modularPath = resolve(ROOT, '.shitenno', 'docs', 'backlog', 'ACTIVE.md');
  const legacyPath = resolve(ROOT, '.shitenno', 'docs', 'BACKLOG.md');
  const backlogPath = existsSync(modularPath) ? modularPath : legacyPath;

  if (!existsSync(backlogPath)) {
    warn('BACKLOG', 'Backlog not found');
    return;
  }
  const content = readFileSync(backlogPath, 'utf-8');
  if (content.includes('Concluído') || content.includes('Done') || content.includes('In Progress')) {
    pass('BACKLOG', 'Backlog has tracked items');
  } else {
    warn('BACKLOG', 'Backlog may need updating');
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
function checkBuildLocal() {
  try {
    const pkgPath = resolve(ROOT, 'package.json');
    let buildScript = '';
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
        buildScript = pkg.scripts?.build ?? '';
      } catch { /* no-op */ }
    }

    if (!buildScript) {
      pass('BUILD', 'No build script — skipped');
      return;
    }

    execSync('npm run build 2>/dev/null | tail -5', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 180000,
    });
    pass('BUILD', 'Build verification passed');
  } catch {
    warn('BUILD', 'Build failed — run your project build command');
  }
}

// ── 7. Plan lifecycle — detect active plans ────────────────────────────────
async function checkPlanLifecycle() {
  try {
    const { detectActivePlans, runAutoVerification } = await import(resolve(ROOT, 'dist', 'plan-lifecycle.js'));
    const { acquireVerificationLock, releaseVerificationLock } = await import(resolve(ROOT, 'dist', 'verification-lock.js'));
    const shitennoDir = resolve(ROOT, '.shitenno');
    
    // K.1: Acquire verification lock to prevent concurrent verification with daemon
    if (!acquireVerificationLock(shitennoDir)) {
      warn('PLAN_LIFECYCLE', 'Verification already in progress by daemon — skipping, daemon will complete it');
      return;
    }
    
    try {
      // CORREÇÃO: detectActivePlans espera shitennoDir, não o dir de planos.
      const plans = detectActivePlans(shitennoDir);
      const pendingCheck = plans.filter((p: { status: string }) => p.status === 'check');

      if (pendingCheck.length > 0) {
        warn('PLAN_LIFECYCLE', `${pendingCheck.length} plan(s) em 'check' ao fechar sessão — rodando verificação agora`);
        for (const p of pendingCheck) {
          const record = runAutoVerification(shitennoDir, ROOT, p.id);
          if (record.passed) {
            pass('PLAN_LIFECYCLE', `${p.id} → verificado e movido para done/`);
          } else {
            fail('PLAN_LIFECYCLE', `${p.id} → bloqueado (${record.checks.filter((c: { passed: boolean }) => !c.passed).map((c: { name: string }) => c.name).join(', ')})`);
          }
        }
      }
    } finally {
      releaseVerificationLock(shitennoDir);
    }

    // Create nag reminder for plans stuck in 'check' across session boundaries
    if (pendingCheck.length > 0) {
      try {
        const bufferPath = resolve(shitennoDir, 'governance', 'context', 'context_buffer.yaml');
        if (existsSync(bufferPath)) {
          const bufContent = readFileSync(bufferPath, 'utf-8');
          let updated = bufContent;
          let changed = false;
          for (const p of pendingCheck) {
            const nagMsg = `Plano ${p.id} segue em 'check' — verificacao nao conseguiu resolver`;
            const escapedMsg = nagMsg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (!new RegExp(`^\\s*- message: "${escapedMsg}"`, 'm').test(updated)) {
              const priority = 'high';
              const createdAt = new Date().toISOString();
              const entry = `  - message: "${nagMsg}"\n    priority: "${priority}"\n    category: "infra"\n    createdAt: "${createdAt}"\n`;
              // Robust: match reminders: anywhere in the file, not just at line start
              if (/^reminders:/m.test(updated)) {
                updated = updated.replace(/^(reminders:)\s*\n/m, `$1\n${entry}`);
              } else {
                // No reminders section yet — append at end
                updated = updated.trimEnd() + '\n\nreminders:\n' + entry;
              }
              changed = true;
              warn('PLAN_LIFECYCLE', `High-priority reminder created for stale plan ${p.id}`);
            }
          }
          if (changed) {
            writeFileSync(bufferPath, updated, 'utf-8');
          }
        }
      } catch { /* best effort */ }
    }

    const stillActive = plans.filter((p: { status: string }) => p.status !== 'done' && p.status !== 'check' && !pendingCheck.some((pc: { id: string }) => pc.id === p.id));
    if (stillActive.length > 0) {
      warn('PLAN_LIFECYCLE', `${stillActive.length} plan(s) ainda em andamento/parado — normal, não é bloqueante`);
    }
    if (plans.length === 0) {
      pass('PLAN_LIFECYCLE', 'No active plans — all archived');
    }
  } catch {
    warn('PLAN_LIFECYCLE', 'Plan lifecycle module not available — run pnpm build first');
  }
}

// ── 8. E2E suite — best-effort, never blocks session close ─────────────────
// A suíte pesada (cli-integration, dashboard, heavy-bootstrap-scoping, bench)
// não roda no gate de plan done (usa test:unit — ver BLOCO P). Roda aqui
// pelo menos uma vez por sessão como best-effort: se falhar, gera um reminder
// P1 em context_buffer.yaml visível no próximo briefing, mas NÃO bloqueia
// o fechamento da sessão.
function runE2eBestEffort() {
  try {
    const pkgPath = resolve(ROOT, 'package.json');
    if (!existsSync(pkgPath)) {
      warn('E2E_SUITE', 'No package.json found — skipping');
      return;
    }
    let e2eScript = '';
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      e2eScript = pkg.scripts?.['test:e2e'] ?? '';
    } catch { /* no-op */ }

    if (!e2eScript) {
      warn('E2E_SUITE', 'No test:e2e script — skipped (non-blocking)');
      return;
    }

    console.log('🧪 [E2E_SUITE] Running test:e2e (best-effort, non-blocking)...');
    execSync('npm run test:e2e 2>&1 | tail -20', {
      encoding: 'utf-8',
      cwd: ROOT,
      timeout: 600000, // 10min — suíte pesada é lenta mas NÃO é bloqueante
    });
    pass('E2E_SUITE', 'test:e2e passed');
  } catch (err) {
    // NÃO define exitCode — best-effort, sessão fecha normalmente
    const detail = err instanceof Error ? err.message : String(err);
    warn('E2E_SUITE', `test:e2e failed (non-blocking): ${String(detail).slice(0, 200)}`);

    // Registar reminder P1 em context_buffer.yaml para visibilidade no próximo briefing
    try {
      const shitennoDir = resolve(ROOT, '.shitenno');
      const bufferPath = resolve(shitennoDir, 'governance', 'context', 'context_buffer.yaml');
      if (existsSync(bufferPath)) {
        const bufContent = readFileSync(bufferPath, 'utf-8');
        const nagMsg = 'e2e-suite: test:e2e falhou na última sessão — investigar antes do próximo release';
        const escapedMsg = nagMsg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!new RegExp(`^\\s*- message: "${escapedMsg}"`, 'm').test(bufContent)) {
          const priority = 'P1';
          const createdAt = new Date().toISOString();
          const entry = `  - message: "${nagMsg}"\n    priority: "${priority}"\n    category: "quality"\n    createdAt: "${createdAt}"\n`;
          let updated = bufContent;
          if (/^reminders:/m.test(updated)) {
            updated = updated.replace(/^(reminders:)\s*\n/m, `$1\n${entry}`);
          } else {
            updated = updated.trimEnd() + '\n\nreminders:\n' + entry;
          }
          writeFileSync(bufferPath, updated, 'utf-8');
        }
      }
    } catch { /* best effort */ }
  }
}

// ── Execute ───────────────────────────────────────────────────────────────
console.log('\n🔒 CLOSE SESSION — Closing session checklist\n');

checkWorkingTree();
checkTestsLocal();
checkBuffer();
checkBacklog();
checkCommit();
checkBuildLocal();
await checkPlanLifecycle();
runE2eBestEffort();

console.log(`\n${exitCode === 0 ? '✅ Session ready to close' : '❌ Session has issues to resolve'}`);
if (warnings.length > 0) {
  console.warn('\n⚠️  Warnings:');
  warnings.forEach((w) => console.warn(`   - ${w}`));
}
console.log('');
process.exit(exitCode);
