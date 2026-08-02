# PLAN-2026-07-24-FASE-2 — Hardening do mecanismo de "done": formatter reativo, portas de entrada unificadas e close-session.ts funcional

**Status:** Done
**Date:** 2026-07-24
**Updated_at:** 2026-07-24T05:05:34.985Z
**Priority:** P0
**Owner:** AI Agent
**Estimated Time:** 5h

---

## Contexto

Continuação do BLOCO Q (`PLAN-2026-07-21-BLOCO-Q-hardening-mecanismo-de-done.md`). O item 3 daquele plano ("duas portas de entrada divergentes") foi apenas **documentado** via comentário + `done-entrypoints-coverage.test.ts` (um snapshot dos *nomes* dos gates, não um teste de comportamento real) — nunca foi de fato resolvido. Esta investigação, motivada por um relato concreto ("coloquei um plano sem formatação e o formatter não formatou como esperado"), encontrou a causa raiz e mais três problemas relacionados que nunca tinham sido detectados porque nenhum teste existente exercitava os caminhos reais:

1. **`normalizePlanHeader` (`markdown-plan-engine.ts`) falhava em silêncio** em dois casos: bloco YAML frontmatter sem chave `status`, e plano sem heading `# `. Em ambos, retornava o conteúdo inalterado sem log nenhum.
2. **As duas portas de entrada para "done"** (`checkPlanStatus` em `task-completion.ts` e `findActivePlanForTask` em `task-completion-pipeline.ts`) reimplementavam leitura de status com um regex que só reconhece `**Status:**` — invisível para planos com YAML frontmatter, que é o formato que `shugo plan md create` gera por padrão hoje.
3. **Bug de debounce no daemon** (`daemon/index.ts`): o `Map` de debounce era recriado a cada evento `plan.file_changed`, então o debounce de 3s nunca funcionava de fato — mudanças sucessivas geravam verificações completas (build+tests+lint+gate_self_test) redundantes.
4. **`close-session.ts` está, na prática, quase inteiramente não-funcional**, por quatro causas independentes que se mascaravam mutuamente atrás de `try/catch` genéricos:
   - `checkBuild()` chama `pnpm run build:verify`, script que **não existe** em `package.json` — sempre lança, sempre cai em `warn()` (nunca bloqueia).
   - `checkTests()` chama `pnpm run test --recursive --filter=core` — `core` não é o nome de nenhum pacote no workspace (`pnpm-workspace.yaml` só declara `apps/*`; o pacote raiz chama-se `shitenno`) — o filtro não casa com nada e o teste real nunca roda.
   - `checkCompletionPipeline()`, `checkCompletionGateLegacy()` e `checkPlanLifecycle()` fazem `import(resolve(ROOT, 'dist', '<módulo>.js'))` para três módulos internos (`task-completion-pipeline`, `task-completion`, `plan-lifecycle`) que **nunca são emitidos como ficheiros próprios** pelo `tsup.config.ts` — só `bin/shugo.ts` e `src/daemon.ts` são `entry`. Os três `import()` falham sempre, e o fallback em cascata (pipeline → gate legado → plan lifecycle) degrada para três `warn()` seguidos, nunca um `fail()`.
   - **Bug crítico independente**: a constante `GOV` e três outras chamadas usavam `resolve(ROOT, 'shitenno', ...)` (sem o ponto) em vez de `.shitenno`. Isso fazia `checkBuffer()` falhar **incondicionalmente** (`fail()`, não `warn()` — mas mascarado porque ninguém nota um exit code 1 que já era esperado por outros motivos) e fazia `checkPlanLifecycle()`/`checkCompletionPipeline()` apontarem para um diretório que nunca existiu.

   Resultado prático: `pnpm run close:session` hoje não valida quase nada do que diz validar — a seção de maior peso (item 7, "Completion Pipeline") sempre reporta warning, nunca sucesso real nem falha real, independente do estado do código.

5. **Achado a confirmar (não corrigido neste plano)**: `resolveBacklogPaths()` (`backlog-parser.ts`) espera o backlog em `<shitennoDir>/docs/backlog/ACTIVE.md` ou `<shitennoDir>/docs/BACKLOG.md` (confirmado pelo scaffold em `src/templates/base/docs/backlog/ACTIVE.md`). Mas o `BACKLOG.md` real deste repositório vive em `docs/BACKLOG.md` na raiz do projeto, **fora** de `.shitenno/`. Se `shitennoDir` passado a `validateCompletionGate` em produção for literalmente `.shitenno/`, o gate `backlog` de `checkBacklogUpdated` nunca encontra o ficheiro real. Não apliquei correção porque não tenho certeza se isso é um desvio real deste repo específico ou se há alguma outra resolução de caminho que não encontrei — **precisa de confirmação da equipa antes de mexer**.

Todas as correções abaixo (exceto o item 5) já foram implementadas e verificadas estaticamente numa cópia de trabalho do zip enviado. Não foi possível rodar `pnpm install`/`vitest` no sandbox (sem acesso de rede), então os patches precisam ser aplicados no repositório real e validados com a suíte antes do merge.

## Objetivo

- O gate `plan_status` (e a decisão de arquivar) reconhece planos independentemente do formato (YAML frontmatter ou `**Status:**` legado), com uma única fonte de verdade.
- O formatter de header nunca falha em silêncio — ou corrige, ou loga por que não conseguiu.
- O debounce do daemon efetivamente coalesce mudanças sucessivas em uma única verificação.
- `pnpm run close:session` reflete o estado real do sistema (tests, build, pipeline de conclusão), não um `warn()` permanente.

**Critérios de aceitação:**
1. Um plano criado via `shugo plan md create` (YAML frontmatter) é reconhecido corretamente pelo gate `plan_status` em ambas as portas de entrada — coberto por teste automatizado nos dois formatos (done e não-done).
2. `pnpm run close:session`, após `pnpm run build`, importa com sucesso os três módulos internos e reporta falha real (`fail`, exit code 1) quando testes ou build realmente falham — não apenas quando o script está mal configurado.
3. Duas mudanças no mesmo plano dentro da janela de 3s geram no máximo uma chamada a `verifyAllPendingPlans()`.

---

## Passos de Implementação

### Passo 1: Cobrir casos silenciosos do normalizador de status
**Ficheiro:** `src/markdown-plan-engine.ts`
**Ação:** Substituir o método privado `normalizePlanHeader` (e método auxiliares) pelo código abaixo. Ele passa a: (a) injetar `status` num bloco YAML frontmatter que não tenha a chave, em vez de assumir "tem `---` logo já está formatado"; (b) logar via `logger.warn`/`logger.info` em vez de retornar conteúdo inalterado em silêncio; (c) tolerar variantes de "Status:" fora do padrão estrito em negrito, evitando duplicar campo.

```ts
// Substitui o normalizePlanHeader original (que só tratava **Status:** e
// pulava qualquer bloco YAML sem checar se tinha a chave status).

private hasLooseStatusLine(content: string): boolean {
  return /^\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*\S/im.test(content);
}

private inferStatusFromCheckboxes(content: string): { legacy: string; canonical: string } {
  const openBoxes = (content.match(/^- \[ \]/gm) || []).length;
  const closedBoxes = (content.match(/^- \[x\]/gm) || []).length;
  const done = closedBoxes > 0 && openBoxes === 0;
  return { legacy: done ? "Done" : "In Progress", canonical: done ? "done" : "andamento" };
}

private normalizeYamlHeader(filePath: string, content: string): string {
  const match = content.match(YAML_BLOCK_RE);
  if (!match || !match[1]) return content;

  let parsed: Record<string, unknown> | null;
  try {
    parsed = parseYaml(match[1]) as Record<string, unknown> | null;
  } catch {
    logger.warn("markdown-plan-engine",
      `normalizePlanHeader: malformed YAML frontmatter in ${filePath} — skipping normalization`);
    return content;
  }

  if (parsed && typeof parsed === "object" && parsed["status"]) {
    return content; // já tem status não-vazio
  }

  const { canonical } = this.inferStatusFromCheckboxes(content);
  const merged = { status: canonical, ...(parsed ?? {}) };
  const newFrontmatter = stringifyYaml(merged).trimEnd();
  const updated = content.replace(YAML_BLOCK_RE, `---\n${newFrontmatter}\n---\n`);

  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch (err) {
    logger.warn("markdown-plan-engine", `normalizePlanHeader: failed to write ${filePath}: ${err}`);
    return content;
  }
  logger.info("markdown-plan-engine",
    `normalizePlanHeader: injected "status: ${canonical}" into YAML frontmatter of ${filePath}`);
  return updated;
}

private normalizePlanHeader(filePath: string, content: string): string {
  if (YAML_BLOCK_RE.test(content)) {
    return this.normalizeYamlHeader(filePath, content);
  }

  if (this.hasLooseStatusLine(content)) return content;

  const { legacy: status } = this.inferStatusFromCheckboxes(content);

  const lines = content.split("\n");
  const titleIndex = lines.findIndex((l) => l.startsWith("# "));
  if (titleIndex === -1) {
    logger.warn("markdown-plan-engine",
      `normalizePlanHeader: ${filePath} has no "# " title heading and no status field — ` +
      `could not inject **Status:**. Plan won't be recognized until a title is added or ` +
      `status is set explicitly (e.g. via "shugo plan md done").`);
    return content;
  }

  lines.splice(titleIndex + 1, 0, "", `**Status:** ${status}`);
  const updated = lines.join("\n");

  try {
    writeFileSync(filePath, updated, "utf-8");
  } catch (err) {
    logger.warn("markdown-plan-engine", `normalizePlanHeader: failed to write ${filePath}: ${err}`);
    return content;
  }
  logger.info("markdown-plan-engine", `normalizePlanHeader: injected "**Status:** ${status}" into ${filePath}`);
  return updated;
}
```

**Verificação:** `pnpm run test:unit -- markdown-plan-engine`. Adicionar (já redigidos, ver Passo 5) casos: YAML sem `status` (deve injetar), YAML com `status` já presente (não deve tocar no ficheiro), plano sem `# ` (deve permanecer intocado + logar warn).

---

### Passo 2: Unificar leitura de status — gate `plan_status`
**Ficheiro:** `src/task-completion.ts`
**Ação:** Remover `findMatchingPlan`/`readPlanStatus` baseados em regex; delegar para `MarkdownPlanEngine.listAll()` (não `list()` — este último exclui planos já `done`, e o gate precisa continuar encontrando-os para poder *passar*).

```ts
import { MarkdownPlanEngine } from "./markdown-plan-engine.js";
// ... remover import de readdirSync (deixa de ser usado)

function findMatchingPlan(
  shitennoDir: string,
  taskId: string
): { id: string; status: string; display: string } | null {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);
    const lowerTaskId = taskId.toLowerCase();
    const plan = engine.listAll().find((p) => matchesTaskId(p.id.toLowerCase(), lowerTaskId));
    if (!plan) return null;
    // metadata.status preserva o texto bruto (ex.: "Done"); plan.status é o
    // valor canônico em minúsculas usado na decisão de passa/falha.
    const display = plan.metadata["status"] ?? plan.status;
    return { id: plan.id, status: plan.status, display };
  } catch {
    return null;
  }
}

function checkPlanStatus(shitennoDir: string, taskId: string): CompletionGate {
  const plansDir = getPlansDir(shitennoDir);
  if (!existsSync(plansDir)) {
    return { name: "plan_status", passed: true, message: "No plans directory found — skipping" };
  }

  const matchingPlan = findMatchingPlan(shitennoDir, taskId);
  if (!matchingPlan) {
    return { name: "plan_status", passed: true, message: `No active plan found for task ${taskId} — skipping` };
  }

  if (matchingPlan.status === "done" || matchingPlan.status === "checked") {
    return { name: "plan_status", passed: true, message: `Plan ${matchingPlan.id} status is "${matchingPlan.display}"` };
  }
  return {
    name: "plan_status", passed: false,
    message: `Plan ${matchingPlan.id} status is "${matchingPlan.display}" — run "shugo plan md done ${matchingPlan.id}" to archive`,
  };
}
```

**Verificação:** os 3 testes já existentes em `task-completion.test.ts` (andamento / done / no plans dir / no matching plan) devem continuar passando com as mesmas mensagens. Ver Passo 5 para os novos testes YAML.

---

### Passo 3: Unificar leitura de status — decisão de arquivar
**Ficheiro:** `src/task-completion-pipeline.ts`
**Ação:** Mesma ideia, mas aqui usar `list()` (não `listAll()`) — a função decide se *ainda há algo a arquivar*, então planos já concluídos devem continuar sendo tratados como "nada a fazer".

```ts
import { MarkdownPlanEngine } from "./markdown-plan-engine.js";
// remover readdirSync do import de node:fs (existsSync e readFileSync continuam em uso)

function findActivePlanForTask(shitennoDir: string, taskId: string): string | null {
  try {
    const engine = new MarkdownPlanEngine(shitennoDir);
    const lowerTaskId = taskId.toLowerCase();
    const plan = engine.list().find((p) => matchesTaskId(p.id.toLowerCase(), lowerTaskId));
    return plan ? plan.id : null;
  } catch {
    return null;
  }
}
```

Remover `isDoneStatus`, `listPlanFiles`, `planIsActive` (não são mais necessários).

**Verificação:** `task-completion-pipeline.test.ts` testa a lógica via mocks inline de fs, não chama a função real — não deve quebrar, mas vale considerar reescrever esses testes para exercitar `findActivePlanForTask` de verdade (hoje eles não cobrem a implementação real, só a própria reimplementação inline do teste).

---

### Passo 4: Corrigir lifetime do debounce no daemon
**Ficheiro:** `src/daemon/index.ts`
**Ação:** Mover a criação do `Map` de debounce para fora do handler, para `subscribeTier1Events` (chamado uma única vez no boot do daemon), e passá-lo como parâmetro.

```ts
function onPlanFileChanged(
  ctx: DaemonContext,
  verificationDebounce: Map<string, NodeJS.Timeout>,
  verifyAllPendingPlans: () => Promise<void>,
  runPeriodicAuditFn: () => Promise<void>,
): void {
  recordEvent(ctx.state, "plan.file_changed");
  // ... resto do corpo inalterado (usa verificationDebounce recebido por parâmetro)
}
```

```ts
// dentro de subscribeTier1Events:
const bus = getEventBus();

// Criado uma única vez aqui — antes era recriado a cada evento, então o
// debounce de 3s nunca persistia entre mudanças sucessivas de arquivo.
const verificationDebounce = new Map<string, NodeJS.Timeout>();

bus.subscribe("plan.file_changed", () => {
  onPlanFileChanged(ctx, verificationDebounce, verifyAllPendingPlans, runPeriodicAuditFn);
});
```

**Verificação:** teste manual — editar um plano `status: check` duas vezes em menos de 3s com o daemon ativo, e conferir no log do daemon que `verifyAllPendingPlans` roda uma vez, não duas.

---

### Passo 5: Testes de regressão
**Ficheiro:** `src/__tests__/markdown-plan-engine.test.ts`
**Ação:** Adicionar casos cobrindo YAML sem `status` (deve injetar `andamento`/`done` conforme checkboxes), YAML já com `status` (não deve tocar no ficheiro), e plano sem `# ` (deve ficar intocado).

**Ficheiro:** `src/__tests__/task-completion.test.ts`
**Ação:** Adicionar dois casos usando plano com YAML frontmatter (`status: andamento` → gate falha com mensagem contendo "andamento", não "no status field"; `status: done` → gate passa) — isto é exatamente a regressão do bug relatado.

*(Os dois arquivos de teste já foram escritos por completo durante a investigação; recomendo copiá-los da cópia de trabalho em vez de reescrever do zero — posso reexportar o conteúdo completo se for útil.)*

**Verificação:** `pnpm run test:unit`.

---

### Passo 6: Dar aos módulos internos suas próprias entradas no build
**Ficheiro:** `tsup.config.ts`
**Ação:** `close-session.ts` faz `import(resolve(ROOT, 'dist', '<módulo>.js'))` para três módulos que hoje não são `entry` do tsup — logo nunca existem como ficheiro próprio, e o `import()` falha sempre.

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/shugo": "bin/shugo.ts",
    "daemon": "src/daemon.ts",
    "task-completion-pipeline": "src/task-completion-pipeline.ts",
    "task-completion": "src/task-completion.ts",
    "plan-lifecycle": "src/plan-lifecycle.ts",
  },
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  external: ["typescript"],
  loader: { ".tsx": "tsx", ".ts": "ts" },
});
```

**Verificação:** `pnpm run build && ls dist/task-completion-pipeline.js dist/task-completion.js dist/plan-lifecycle.js` — os três devem existir.

---

### Passo 7: Corrigir `checkTests()` e `checkBuild()` em `close-session.ts`
**Ficheiro:** `.shitenno/scripts/close-session.ts`
**Ação:**

```ts
// checkTests(): --filter=core mirava um pacote de workspace inexistente
// ("core" não existe; pnpm-workspace.yaml só declara apps/*, e o pacote
// raiz chama-se "shitenno") — o comando nunca rodava a suíte de verdade.
function checkTests() {
  try {
    execSync('pnpm run test:unit 2>&1 | tail -5', {
      encoding: 'utf-8', cwd: ROOT, timeout: 120000,
    });
    pass('TESTS', 'Unit tests passed');
  } catch {
    fail('TESTS', 'Tests failed — run pnpm run test:unit');
  }
}

// checkBuild(): "build:verify" não existe em package.json — o comando
// sempre lançava e sempre virava warn(), nunca bloqueava a sessão.
function checkBuild() {
  try {
    execSync('pnpm run typecheck && pnpm run build 2>&1 | tail -5', {
      encoding: 'utf-8', cwd: ROOT, timeout: 180000,
    });
    pass('BUILD', 'Typecheck + build passed');
  } catch {
    fail('BUILD', 'Typecheck or build failed — run pnpm run typecheck && pnpm run build');
  }
}
```

**Nota de comportamento:** troquei `warn()` por `fail()` nos dois — antes, mesmo com teste/build genuinamente quebrado, o script nunca marcava `exitCode = 1` por causa desses dois checks. Isso é intencional (é o comportamento que "validar de verdade" implica), mas está listado em Riscos abaixo porque muda o resultado observável de `close:session`.

---

### Passo 8: Corrigir o bug do ponto ausente em `.shitenno`
**Ficheiro:** `.shitenno/scripts/close-session.ts`
**Ação:** Quatro ocorrências de `resolve(ROOT, 'shitenno', ...)` deveriam ser `resolve(ROOT, '.shitenno', ...)`. Sem o ponto, o caminho aponta para um diretório que nunca existiu neste projeto.

```ts
// linha 9
const GOV = resolve(ROOT, '.shitenno', 'governance');

// linha ~83 (checkBacklog) — ver Achado a Confirmar abaixo antes de aplicar
const backlogPath = resolve(ROOT, '.shitenno', 'docs', 'BACKLOG.md');

// linha ~128 (checkCompletionPipeline)
const result = mod.runCurrentTaskPipeline(ROOT, resolve(ROOT, '.shitenno'));

// linha ~170 (checkCompletionGateLegacy)
shitennoDir: resolve(ROOT, '.shitenno'),
```

**Impacto antes da correção:** `checkBuffer()` falhava (`fail()`, exit code 1) em **toda** execução, incondicionalmente — não dependia de nada estar realmente errado.

**Verificação:** `pnpm run close:session` — `BUFFER` deve passar quando `context_buffer.yaml` tiver `status` válido; `PLAN_LIFECYCLE` deve listar planos ativos reais (hoje sempre reportava "module not available").

---

## Achado a confirmar (não aplicado — precisa de decisão da equipa)

`resolveBacklogPaths()` (`src/backlog-parser.ts`) espera o backlog em `<shitennoDir>/docs/BACKLOG.md` ou `<shitennoDir>/docs/backlog/ACTIVE.md` (confere com o scaffold em `src/templates/base/docs/backlog/ACTIVE.md`, usado para novos projetos). Neste repositório, porém, o `BACKLOG.md` real está em `docs/BACKLOG.md` — na raiz do projeto, fora de `.shitenno/`. Se isso não for intencional, o gate `backlog` (`checkBacklogUpdated`, um dos 5 gates de `validateCompletionGate`) nunca encontra o ficheiro real neste projeto específico. Duas hipóteses, a confirmar:
- (a) é um desvio real deste `.shitenno` self-hospedado (precisa mover o ficheiro ou ajustar o caminho default); ou
- (b) existe algum outro mecanismo de resolução de caminho para este caso que não localizei na leitura estática.

Recomendo não aplicar Passo 8 (linha do `checkBacklog`) até confirmar isso — a correção de "adicionar o ponto" pode estar corrigindo o caminho errado se a hipótese (a) for verdadeira (nesse caso o caminho certo seria `resolve(ROOT, 'docs', 'BACKLOG.md')`, sem `shitenno` nenhum no meio).

---

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Unificar as duas portas de entrada delegando para `MarkdownPlanEngine` | Ensinar o regex de cada porta a reconhecer YAML também | Reescrever o regex resolve o sintoma mas mantém a duplicação — a próxima mudança de formato reintroduz a mesma divergência. Uma única fonte de verdade elimina a classe inteira de bug. |
| 2 | Dar aos 3 módulos internos suas próprias `entry` no tsup | Criar um subcomando dedicado no CLI (`shugo task complete --json`) e fazer `close-session.ts` chamá-lo via `execSync` | Menor risco, sem precisar desenhar um novo comando/formato de saída. Se o número de bundles internos crescer e o tempo de build virar problema, reavaliar essa alternativa numa iteração futura. |
| 3 | `Map` de debounce criado uma vez em `subscribeTier1Events` | Guardar o debounce dentro de `ctx.state` (`DaemonContext`) | `ctx.state` já é lido/escrito por muitos outros pontos do daemon; mudar sua forma exigiria migrar todos os leitores. Um `Map` local ao escopo de `subscribeTier1Events` (chamado uma única vez) resolve o bug com a menor superfície de mudança possível. |
| 4 | Trocar `warn()` por `fail()` em `checkTests`/`checkBuild` de `close-session.ts` | Manter `warn()` e só corrigir os comandos quebrados | Manter `warn()` reproduziria o mesmo problema de fundo (o script nunca bloqueia de verdade) — só que com comandos corretos por baixo. O objetivo explícito era "o done mechanism precisa validar de verdade", então falha real deve bloquear. |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Novas entradas no `tsup.config.ts` aumentam tempo/tamanho de build (cada entry vira um bundle próprio, sem `splitting` os módulos compartilhados como `logger.ts`/`id-matcher.ts` ficam duplicados entre bundles) | Baixo–Médio | Medir o tempo de `pnpm run build` antes/depois; se piorar sensivelmente, migrar para a Alternativa 2 da tabela acima (subcomando CLI) numa 2ª iteração |
| 2 | `checkTests`/`checkBuild` agora podem de fato **falhar** (`exitCode=1`) onde antes sempre passavam/avisavam — sessões que pareciam "prontas para fechar" podem começar a reportar problemas reais que já existiam mas estavam mascarados | Baixo (é o comportamento correto) | Comunicar à equipa antes do merge — é esperado que `close:session` comece a pegar coisas que passavam despercebidas |
| 3 | `normalizeYamlHeader` reescreve o bloco YAML inteiro via `stringify` — campos com tipos especiais (datas sem aspas, por ex.) podem sofrer pequena reformatação no round-trip | Baixo | Não afeta o campo `status` em si; se necessário, adicionar teste de round-trip para os demais campos do frontmatter |
| 4 | Correção do `checkBacklog` (Passo 8) pode apontar para o caminho errado se a hipótese (a) do "Achado a confirmar" estiver certa | Médio | Não aplicar essa linha específica até confirmação — ver seção dedicada acima |
