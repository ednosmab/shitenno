# PLAN-2026-07-19 — MASTER 2/3: Correção de Dados e Checks Genéricos

**Status:** Done
**Updated_at:** 2026-07-22T09:46:00.000Z
**Date:** 2026-07-21

**Continuação de `PLAN-2026-07-19-MASTER-1-integridade-gate.md`. Cobre M.8, M.9, M.10.**

---

## M.8 — `ActionEngine.execute` duplica política em vez de delegar (B.2, ainda pendente)

**Ficheiro:** `src/action-engine.ts`

O método `execute` (a partir da linha ~253) reimplementa a checagem de política manualmente — instancia `PolicyEngine`/`FilePolicyRepository` e chama `checkPolicyGate` direto, em vez de reaproveitar `invokeAction` (`decision-core/invoke.ts`), que já faz isso de forma testada.

```typescript
// Ficheiro: src/action-engine.ts
import { invokeAction } from "./decision-core/invoke.js";
// Remove os imports agora redundantes: PolicyEngine, FilePolicyRepository, checkPolicyGate,
// RuleAction, RuleContext — SE não forem usados em mais nenhum lugar do arquivo
// (confirmar com grep antes de remover, outros métodos da classe podem usá-los).

async execute(request: ActionRequest): Promise<ExecutionRecord> {
  const executionHash = computeExecutionHash(request.type, request.params);

  const existing = this.repo.findByActionId(request.id);
  if (existing && existing.status === "completed") return existing;

  const hashMatch = this.repo.findByHash(executionHash);
  if (hashMatch && hashMatch.status === "completed") return hashMatch;

  const result = await invokeAction({
    action: { type: request.type as RuleAction["type"], params: request.params as RuleAction["params"] },
    context: {
      trigger: "manual",
      eventData: {},
      projectRoot: "",
      shitennoDir: this.shitennoDir ?? "",
      timestamp: new Date().toISOString(),
    },
    mode: "deliberate",
  });

  const record: ExecutionRecord = {
    executionId: `EXE-${randomUUID().slice(0, 8).toUpperCase()}`,
    request,
    executionHash,
    status: result.success ? "completed" : "failed",
    result: result.success ? "success" : "failure",
    error: result.success ? undefined : result.message,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    duration: 0,
  };
  this.repo.save(record);

  // resto do método (busca de executor, chamada, etc.) continua igual a partir daqui,
  // só a checagem de política no início é que muda.
```

**Cuidado ao aplicar:** o método `execute` continua depois desse trecho com a busca do `executor` registrado e a chamada real da ação — não remover essa parte, só a checagem de política duplicada no começo. Ler o método inteiro antes de editar pra não cortar lógica que vem depois.

**Critério de aceite:** `npx vitest run src/__tests__/action-engine.test.ts` continua passando; adicionar um teste novo que confirma que uma ação bloqueada por política via `ActionEngine.execute` produz `status: "failed"` com a mesma mensagem que `invokeAction` produziria chamado direto — hoje isso não é garantido porque são dois caminhos de código diferentes que podem divergir.

---

## M.9 — Migração de backlog continua quebrada (`ACTIVE.md` vazio, `DONE.md` com 83 itens misturados)

**Situação confirmada nesta auditoria:** exatamente igual ao zip original — `docs/backlog/ACTIVE.md` tem 0 linhas, `docs/backlog/DONE.md` tem 83 itens, incluindo itens que claramente não estão concluídos. A correção nunca rodou.

**Causa raiz (relembrando, já diagnosticada antes):**
1. `scripts/migrate-backlog.ts` usa `SOURCE = "docs/BACKLOG.md"` — arquivo errado. A fonte real, intacta, é `.shitenno/docs/BACKLOG.md`.
2. O parser não reconhece o cabeçalho real `## Completed Items` (só reconhece `## Done`), nem a tabela sem negrito dentro dessa seção.

**Ficheiro:** `scripts/migrate-backlog.ts`

```typescript
// 1. Corrigir a fonte:
const SOURCE = ".shitenno/docs/BACKLOG.md";
const ACTIVE_DEST = "docs/backlog/ACTIVE.md";
const DONE_DEST = "docs/backlog/DONE.md";

// 2. Corrigir o reconhecimento de seção:
const sectionMatch = line.match(/^## (P[0-9]+|Done|Completed Items)\s?/);
if (sectionMatch) {
  currentSection = sectionMatch[1] === "Completed Items" ? "Done" : sectionMatch[1]!;
  inDoneTable = currentSection === "Done";
  // ... resto da lógica de parsing de seção permanece
}
```

**Passo de validação obrigatório antes de aceitar o resultado, dessa vez rodando de verdade, não só documentando a intenção:**

```bash
# 1. Contar itens na fonte real antes de migrar
grep -c "^### " .shitenno/docs/BACKLOG.md    # itens detalhados (P0-P3)
grep -c "^| .* | .* | .* |$" .shitenno/docs/BACKLOG.md  # linhas de tabela

# 2. Rodar a migração
npx tsx scripts/migrate-backlog.ts

# 3. Validar o resultado — este passo é o que faltou da última vez:
wc -l docs/backlog/ACTIVE.md docs/backlog/DONE.md
# ACTIVE.md NÃO pode estar vazio se a fonte tinha itens em P0-P3 com Status != Done

grep -i "não existe\|ainda não\|falta " docs/backlog/DONE.md
# qualquer match aqui é sinal de item mal classificado como concluído — se aparecer
# algo, a migração ainda tem bug, não commitar o resultado
```

**Por que estou insistindo neste passo de validação como parte do plano, não só como sugestão:** essa exata migração já foi "implementada" segundo o código (o script existe, tem a lógica) mas **nunca foi de fato rodada e conferida** — é o padrão exato que essa conversa inteira existe pra evitar. O script existir não é o critério de aceite; o resultado (`ACTIVE.md` não vazio, `DONE.md` sem itens mal classificados) é.

**Critério de aceite:** `ACTIVE.md` não está vazio; `DONE.md` só contém itens cuja descrição de fato indica conclusão; soma total bate com a contagem da fonte; nenhuma das duas checagens de `grep` acima retorna resultado.

---

## M.10 — `checkBuild`/`checkTests`/`checkLint` hardcoded em pnpm/vitest (a premissa falsa do Bloco L original)

**Por que isso é prioridade alta, não só "seria bom":** este é o núcleo de todo o mecanismo de gate (Bloco F inteiro depende dessas três funções). Hoje elas assumem `pnpm` e `vitest` especificamente — instalar isso num projeto de terceiro com `npm`+`Jest`, ou `yarn`, faz o gate falhar sistematicamente (bloqueando trabalho legítimo) ou, pior, pode nem executar o comando certo. Isso conecta direto com o Bloco H (validação cross-project): sem este fix, H.4 nunca vai produzir uma validação bem-sucedida em projeto de stack diferente.

**Boa notícia encontrada nesta auditoria:** já existe a infraestrutura de detecção — `analyseProject()` em `src/analyser.ts` já retorna `packageManager: "pnpm" | "npm" | "yarn" | "unknown"`. Não precisa reinventar a detecção, só reaproveitar.

**Ficheiro:** `src/plan-lifecycle.ts`

```typescript
import { analyseProject } from "./analyser.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function getRunCommand(projectRoot: string): string {
  const { packageManager } = analyseProject(projectRoot);
  switch (packageManager) {
    case "pnpm": return "pnpm run";
    case "yarn": return "yarn run";
    case "npm": return "npm run";
    default: return "npm run"; // fallback razoável — npm está sempre disponível onde node está
  }
}

function hasScript(projectRoot: string, scriptName: string): boolean {
  const pkgPath = join(projectRoot, "package.json");
  if (!existsSync(pkgPath)) return false;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    return typeof pkg.scripts?.[scriptName] === "string";
  } catch {
    return false;
  }
}

// Antes:
function checkBuild(projectRoot: string): CompletionCheck {
  try {
    execSync("pnpm run build 2>/dev/null", { encoding: "utf-8", cwd: projectRoot, timeout: 120000, stdio: ["pipe", "pipe", "pipe"] });
    return { name: "BUILD", passed: true, message: "Build passed" };
  } catch {
    return { name: "BUILD", passed: false, message: "Build failed" };
  }
}

// Depois:
function checkBuild(projectRoot: string): CompletionCheck {
  if (!hasScript(projectRoot, "build")) {
    // Diferente de "passou" — projeto sem script de build (ex.: script Python
    // solto) não deveria bloquear nem fingir que validou algo que não existe.
    return { name: "BUILD", passed: true, message: "No build script configured — skipped" };
  }
  try {
    execSync(`${getRunCommand(projectRoot)} build`, {
      encoding: "utf-8", cwd: projectRoot, timeout: 120000, stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "BUILD", passed: true, message: "Build passed" };
  } catch {
    return { name: "BUILD", passed: false, message: "Build failed" };
  }
}

// Mesma estrutura para checkLint:
function checkLint(projectRoot: string): CompletionCheck {
  if (!hasScript(projectRoot, "lint")) {
    return { name: "LINT", passed: true, message: "No lint script configured — skipped" };
  }
  try {
    execSync(`${getRunCommand(projectRoot)} lint`, {
      encoding: "utf-8", cwd: projectRoot, timeout: 60000, stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "LINT", passed: true, message: "Lint passed" };
  } catch {
    return { name: "LINT", passed: false, message: "Lint failed" };
  }
}

// checkTests é o mais delicado — hoje roda "npx vitest run" direto, ignorando
// se o projeto alvo usa Jest, Mocha, ou nem tem "test" configurado. Ler o
// script real do package.json em vez de assumir uma ferramenta:
function checkTests(projectRoot: string): CompletionCheck {
  if (!hasScript(projectRoot, "test")) {
    return { name: "TESTS", passed: false, message: "No test script configured in package.json — cannot verify" };
    // NOTA DE DESIGN: diferente de build/lint, ausência de script de teste
    // retorna passed:false, não true. Testar é o check mais importante do
    // gate — "não sei se passa" não deveria contar como "passou". Se isso
    // for demais para projetos que genuinamente não têm testes ainda,
    // trocar para passed:true com o mesmo aviso é uma decisão de produto
    // válida, mas precisa ser deliberada, não um efeito colateral de --if-present.
  }
  try {
    execSync(`${getRunCommand(projectRoot)} test`, {
      encoding: "utf-8", cwd: projectRoot, timeout: 180000, stdio: ["pipe", "pipe", "pipe"],
    });
    return { name: "TESTS", passed: true, message: "Tests passed" };
  } catch {
    return { name: "TESTS", passed: false, message: "Tests failed" };
  }
}
```

**E, com isso corrigido, o L.1 original volta a fazer sentido de verdade:**

**Ficheiro:** `src/task-completion.ts`

```typescript
// Antes (linhas ~48-70) — implementação própria, hardcoded, com --if-present perigoso:
function checkTestPass(projectRoot: string, execFn: typeof execSync): CompletionGate {
  try {
    execFn("pnpm run test --recursive --if-present --filter=core 2>/dev/null | tail -1", {
      cwd: projectRoot, timeout: 120000, stdio: "pipe",
    });
    return { name: "tests", passed: true, message: "All tests pass" };
  } catch {
    return { name: "tests", passed: false, message: "Tests failed or not executed" };
  }
}
// ... checkLintPass com a mesma estrutura hardcoded

// Depois — delega para as versões agora genéricas de plan-lifecycle.ts:
import { checkTests, checkLint } from "./plan-lifecycle.js";

function checkTestPass(projectRoot: string): CompletionGate {
  const result = checkTests(projectRoot);
  return { name: "tests", passed: result.passed, message: result.message };
}

function checkLintPass(projectRoot: string): CompletionGate {
  const result = checkLint(projectRoot);
  return { name: "lint", passed: result.passed, message: result.message };
}
```

Isso remove o parâmetro `execFn` de ambas — não é mais necessário injetar comando customizado. **Os testes existentes de `task-completion.ts` que mockam `execFn` para essas duas funções precisam ser atualizados para mockar `checkTests`/`checkLint` de `plan-lifecycle.ts`** — não é perda de cobertura, é mudança de onde o mock aponta.

**Nota sobre o monorepo real deste projeto:** o comando antigo tinha `--filter=core`, sinal de que o próprio Shitenno é hoje um workspace pnpm (`apps/shitenno-dashboard` confirmado no zip). A versão genérica acima não replica esse `--filter` — se isso for necessário especificamente pro monorepo do próprio Shitenno (não pros projetos de terceiro instalando a ferramenta), considerar detectar `pnpm-workspace.yaml` e adicionar `--recursive` condicionalmente, só quando for esse cenário específico, não como comportamento padrão pra todo projeto que instala o Shitenno.

**Critério de aceite:** rodar `checkTests`/`validateCompletionGate` num projeto fake com `package.json` usando `npm` (sem `pnpm-lock.yaml`) e `scripts.test` apontando pra um teste que falha de propósito → gate `TESTS`/`tests` reporta `passed: false` de verdade. Rodar noutro projeto fake sem nenhum `scripts.test` → reporta `passed: false` com mensagem clara ("No test script configured"), nunca "passou" sem ter rodado nada — o oposto exato do bug do `--if-present`.

---

## Ordem de execução desta parte (2/3)

1. **M.10** primeiro — é pré-requisito de confiança pra M.9 fazer sentido (a migração de backlog não depende disso, mas o gate como um todo só é confiável fora do repo do próprio Shitenno depois desse fix).
2. **M.9** — independente dos outros dois, pode rodar em paralelo.
3. **M.8** — independente, menor risco.

Depois de cada item: `npm run build && npx vitest run`.

**Continua em `PLAN-2026-07-19-MASTER-3-estrutura-e-cobertura.md` (M.11-M.13).**
