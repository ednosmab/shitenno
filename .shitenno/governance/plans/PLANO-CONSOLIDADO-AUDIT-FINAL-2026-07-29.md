# Plano Consolidado Final — `shugo audit` (Engine + Achados Reais)

**Status:** Refused

**Base:** commit `cdc9d44531c52cfe0c5355d3fccf41fc5e7be2a1`. Junta os dois planos anteriores (`PLANO-MELHORAR-AUDIT-ENGINE-2026-07-29.md` e `PLANO-ACHADOS-REAIS-2026-07-29.md`) num só, sem duplicar nada. Estrutura em duas partes bem separadas, porque são coisas diferentes:

- **Parte A — conserta a engine.** 4 bugs de detector, achados cruzando `shugo audit` com ferramentas independentes (`madge`, leitura manual de código). Depois desses 4, a engine para de gerar falso positivo nas categorias de segurança/circular-dep/monorepo.
- **Parte B — conserta o projeto.** 2 categorias de achado que a engine relatou **corretamente** — aqui o bug é no `shitenno` mesmo, não no detector.

---

# PARTE A — Consertar a Engine (4 bugs de detector)

## A.1 — Detector de dependência circular tem bug de resolução de path (não é limitação de algoritmo)

**Evidência, com prova ao vivo:** `detectCircularDeps` (`src/audit/engineering/code-health.ts`) constrói o grafo de imports concatenando string em vez de normalizar o path:

```ts
// código atual — src/audit/engineering/code-health.ts:82-84
const dirOfCurrentFile = file.relPath.split("/").slice(0, -1).join("/");
const resolved = pathToKey(dirOfCurrentFile + "/" + spec.replace(/\.js$/, ""));
if (resolved && resolved !== pathToKey(file.relPath)) deps.add(resolved);
```

Rodei com valores reais do projeto (`src/plan/checks.ts` importando `"../plan-lifecycle.js"`):

```
buggy resolved:  src/plan/../plan-lifecycle   ← nunca bate com nenhum node do grafo
fixed resolved:  src/plan-lifecycle           ← bate exatamente com a chave real
```

Qualquer import que suba um nível de diretório (`../`) gera uma chave tipo `"src/plan/../plan-lifecycle"`, que nunca é igual à chave real do node. Essa aresta é silenciosamente descartada — o ciclo nem entra na busca em profundidade. **É por isso que a engine acha 2 ciclos e o `madge` (ferramenta independente) acha 29 no mesmo código.**

**Correção — uma linha, resolve a causa raiz:**

```ts
// src/audit/engineering/code-health.ts
import { posix } from "node:path";

function buildImportGraph(files: SourceFileInfo[]): Map<string, Set<string>> {
  const importRegex = /(?:from|import)\s+["']([^"']+)["']/g;
  const pathToKey = (p: string) => p.replace(/\.ts$/, "").replace(/\.js$/, "");
  const importGraph = new Map<string, Set<string>>();
  for (const file of files) {
    const deps = new Set<string>();
    const contentWithoutTypeImports = file.content.split("\n").filter((line) => !/^\s*import\s+type\s+/.test(line)).join("\n");
    let match;
    while ((match = importRegex.exec(contentWithoutTypeImports)) !== null) {
      const spec = match[1];
      if (!spec) continue;
      if (spec.startsWith(".") || spec.startsWith("/")) {
        const dirOfCurrentFile = file.relPath.split("/").slice(0, -1).join("/");
        // posix.normalize resolve "../" e "./" de verdade, em vez de deixar a string literal quebrada
        const resolved = pathToKey(posix.normalize(`${dirOfCurrentFile}/${spec}`));
        if (resolved && resolved !== pathToKey(file.relPath)) deps.add(resolved);
      }
    }
    importGraph.set(pathToKey(file.relPath), deps);
  }
  return importGraph;
}
```

Removi também o `.replace(/\/\.\//g, "/")` do `pathToKey` antigo — era uma tentativa manual (e incompleta) de fazer o que `posix.normalize` já faz corretamente.

**Nota sobre `import type`:** o código já filtra `import type` antes de montar o grafo — isso é correto e intencional, evita contar ciclos que desaparecem em runtime. Não mude esse comportamento. Depois desse fix, o número de ciclos reportados deve ficar **entre** os 2 de hoje e os 29 do madge (madge conta tipo e valor juntos por padrão; a engine já é mais seletiva de propósito).

**Teste de regressão:**

```ts
// src/__tests__/circular-dep-detector.test.ts (novo)
import { describe, it, expect } from "vitest";
import { detectCircularDeps } from "../audit/engineering/code-health.js";

describe("detectCircularDeps", () => {
  it("detecta ciclo através de import com ../ (path traversal de diretório)", () => {
    const files = [
      { relPath: "src/a/one.ts", fullPath: "/root/src/a/one.ts", basename: "one", content: `import { b } from "../b/two.js";\nexport const a = 1;` },
      { relPath: "src/b/two.ts", fullPath: "/root/src/b/two.ts", basename: "two", content: `import { a } from "../a/one.js";\nexport const b = 2;` },
    ] as SourceFileInfo[];
    const issues = detectCircularDeps("/root", files);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]?.type).toBe("circular_dep");
  });

  it("NÃO conta ciclo que existe só via import type (apagado em runtime)", () => {
    const files = [
      { relPath: "src/a.ts", fullPath: "/root/src/a.ts", basename: "a", content: `import type { X } from "./b.js";\nexport const a = 1;` },
      { relPath: "src/b.ts", fullPath: "/root/src/b.ts", basename: "b", content: `import { a } from "./a.js";\nexport type X = number;` },
    ] as SourceFileInfo[];
    const issues = detectCircularDeps("/root", files);
    expect(issues.length).toBe(0);
  });
});
```

## A.2 — `detectSQLInjection`/`detectXSS` batem em comentário e se auto-detectam

**Causa raiz #1 — roda regex sobre comentários, não só código.** `src/plan/lifecycle-actions.ts:45,76` foi sinalizado como `sql_injection` crítico. O conteúdo real da linha é um **comentário em inglês**: `// runAutoVerification already handles status update + archiving`. O padrão `/UPDATE\s+.*\+\s*[a-zA-Z]/i` bate em `"update + archiving"` porque o detector roda a regex sobre `file.content.split("\n")` cru, sem remover comentário primeiro.

**Correção:**

```ts
// src/audit/security/injection.ts
import { stripComments } from "../shared.js";

export function detectSQLInjection(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const sqlPatterns = [
    /\.query\s*\(\s*[`"'].*\$\{/, /\.execute\s*\(\s*[`"'].*\$\{/,
    /\.raw\s*\(\s*[`"'].*\$\{/, /SELECT\s+.*\+\s*[a-zA-Z]/i,
    /INSERT\s+INTO.*\+\s*[a-zA-Z]/i, /UPDATE\s+.*\+\s*[a-zA-Z]/i,
    /DELETE\s+FROM.*\+\s*[a-zA-Z]/i,
  ];

  for (const file of files) {
    if (isDetectorDefinitionFile(file.relPath)) continue; // ver causa raiz #2
    const codeOnly = stripComments(file.content);
    const lines = codeOnly.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (sqlPatterns.some((p) => p.test(line))) {
        issues.push({
          type: "sql_injection", severity: 3,
          description: `Possível SQL injection em "${file.relPath}:${i + 1}" — query construída com concatenação/template literal`,
          location: `${file.relPath}:${i + 1}`,
          recommendation: "Usar prepared statements ou parameterized queries em vez de concatenação",
          confidence: 0.65,
        });
      }
    }
  }
  return issues;
}
```

```ts
// src/audit/shared.ts
/**
 * Remove comentários de linha (//) e de bloco (/* *​/) de forma simples,
 * o suficiente para parar de casar regex de segurança dentro de prosa.
 * Não é um parser completo — não precisa ser, só precisa parar de ler
 * comentário como se fosse código.
 */
export function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, "")) // preserva quebras de linha p/ não deslocar números de linha
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}
```

Aplicar o mesmo `stripComments` em `detectXSS`, `detectUnsafeEval`, `detectUnsafeDeserialization` e `detectWeakCrypto` — todos rodam regex sobre texto livre e sofrem do mesmo risco.

**Causa raiz #2 — lista de auto-exclusão existe, mas está incompleta.** `src/audit/security/injection.ts:47-48` foi sinalizado como `xss_risk` — são as próprias definições de regex do detector de XSS se auto-detectando. Já existe um mecanismo pra isso, `isDetectorDefinitionFile()` (`src/audit/security/helpers.ts`), mas a lista `SECURITY_DETECTOR_SELF_PATHS` (`src/audit/constants.ts:33-40`) não inclui a pasta onde os padrões de segurança vivem — e o mesmo padrão de auto-detecção também acontece em `weak_crypto` (`src/audit/security/crypto.ts:17`, achado ao investigar mais fundo).

```ts
// src/audit/constants.ts
export const SECURITY_DETECTOR_SELF_PATHS = [
  "src/health-auditor.ts",
  "src/audit/taint/",
  "src/audit/security/",              // ← faltava — aqui vivem os padrões de SQL/XSS/path-traversal/eval/crypto
  "src/audit/engineering-detectors.ts",
  "src/audit/engineering-detectors-security.ts",
  "src/audit/engineering-detectors-quality.ts",
  "src/audit/engineering-detectors-supply.ts",
];
```

E garantir que `detectSQLInjection` e `detectWeakCrypto` também chamem `isDetectorDefinitionFile()` no início do loop — hoje só `detectXSS`/`detectUnsafeEval` chamam.

## A.3 — `detectPathTraversal` não distingue origem confiável de não-confiável na maioria dos padrões

**Evidência:** dos 7 padrões em `src/audit/security/path-traversal.ts`, só 4 exigem `req.(query|params|body)` (evidência real de input HTTP não confiável). Os outros 3 disparam em **qualquer** concatenação/template literal perto de `readFile`/`writeFile`/`unlink`/`createReadStream`, mesmo quando a variável é interna e confiável. Numa CLI local (não um servidor web), isso gera ruído sistemático.

**Correção — separar por confiança:**

```ts
// src/audit/security/path-traversal.ts
const highConfidencePatterns = [ // origem comprovadamente não confiável (rede/CLI externo)
  /path\.join\s*\([^)]*req\./, /path\.resolve\s*\([^)]*req\./,
  /readFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /writeFile(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /unlink(?:Sync)?\s*\([^)]*\breq\.(query|params|body)\b/,
  /createReadStream\s*\([^)]*\breq\.(query|params|body)\b/,
];

const lowConfidencePatterns = [ // caminho dinâmico, origem não comprovada — pode ser interno e seguro
  /readFile(?:Sync)?\s*\([^)]*\+/, /writeFile(?:Sync)?\s*\([^)]*\+/,
  /readFile(?:Sync)?\s*\([^)]*\$\{/, /writeFile(?:Sync)?\s*\([^)]*\$\{/,
  /createReadStream\s*\([^)]*\+/, /unlink(?:Sync)?\s*\([^)]*\+/,
];

// no loop: usar severity: 3, confidence: 0.7 para highConfidence
// e severity: 1, confidence: 0.35 para lowConfidence — ainda visível no relatório
// (nível code-review/enterprise), mas não infla o healthScore nem o contador "critical"
```

## A.4 — `dep_confusion` não entende workspace pnpm (49 falsos positivos)

**Evidência:** todos os 49 achados de `dep_confusion` apontam para `apps/shitenno-dashboard/` — um app dentro do monorepo, com seu próprio `package.json` e `node_modules`. Confirmei manualmente: `react-router-dom`, `vite`, etc. **estão instalados de verdade** em `apps/shitenno-dashboard/node_modules/`. O detector está errado.

**Causa raiz:**

```ts
// src/audit/security/secrets.ts — detectDependencyConfusion()
const pkgPath = join(projectRoot, "package.json"); // ← só o package.json da raiz

// src/audit/security/helpers.ts — isUndeclaredDependency()
return !existsSync(join(projectRoot, "node_modules", pkgName)); // ← só o node_modules da raiz
```

Duas checagens, as duas olhando só pra raiz do monorepo, nunca pro workspace específico do arquivo sendo escaneado.

**Correção — resolver o `package.json`/`node_modules` mais próximo do arquivo:**

```ts
// src/audit/security/secrets.ts
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

function findNearestPackageJson(filePath: string, projectRoot: string): string | null {
  let dir = dirname(filePath);
  while (dir.startsWith(projectRoot)) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    if (dir === projectRoot) break;
    dir = dirname(dir);
  }
  return null;
}

export function detectDependencyConfusion(projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const declaredDepsCache = new Map<string, Set<string>>();

  function getDeclaredDeps(pkgJsonPath: string): Set<string> {
    const cached = declaredDepsCache.get(pkgJsonPath);
    if (cached) return cached;
    try {
      const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
      const deps = new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})]);
      declaredDepsCache.set(pkgJsonPath, deps);
      return deps;
    } catch {
      const empty = new Set<string>();
      declaredDepsCache.set(pkgJsonPath, empty);
      return empty;
    }
  }

  const importRegex = /(?:from|import)\s+["']([^"'./][^"']*)["']/g;

  for (const file of files) {
    const nearestPkgPath = findNearestPackageJson(file.fullPath, projectRoot);
    if (!nearestPkgPath) continue;
    const declaredDeps = getDeclaredDeps(nearestPkgPath);
    const workspaceRoot = dirname(nearestPkgPath);

    let match;
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(file.content)) !== null) {
      const spec = match[1];
      if (!spec || spec.includes("${")) continue;
      const pkgName = extractPackageName(spec);
      if (!isUndeclaredDependency(pkgName, declaredDeps, workspaceRoot, projectRoot)) continue;
      issues.push({
        type: "dep_confusion", severity: 2,
        description: `Dependência "${pkgName}" importada em "${file.relPath}" mas não existe em node_modules nem em ${nearestPkgPath.replace(projectRoot + "/", "")}`,
        location: file.relPath,
        recommendation: `Adicionar "${pkgName}" ao package.json correto ou remover o import`,
        confidence: 0.6,
      });
    }
  }
  return issues;
}
```

```ts
// src/audit/security/helpers.ts
export function isUndeclaredDependency(
  pkgName: string,
  declaredDeps: Set<string>,
  workspaceRoot: string,  // ← novo parâmetro
  projectRoot: string,
): boolean {
  if (!pkgName || NODE_BUILTINS.has(pkgName) || declaredDeps.has(pkgName)) return false;
  if (existsSync(join(workspaceRoot, "node_modules", pkgName))) return false;
  if (workspaceRoot !== projectRoot && existsSync(join(projectRoot, "node_modules", pkgName))) return false;
  return true;
}
```

**Teste de regressão:**

```ts
// src/__tests__/dep-confusion-detector.test.ts (novo)
import { describe, it, expect } from "vitest";
import { detectDependencyConfusion } from "../audit/security/secrets.js";

describe("detectDependencyConfusion", () => {
  it("não sinaliza dependência declarada num package.json de sub-workspace", () => {
    const files = [{
      relPath: "apps/dashboard/src/App.tsx",
      fullPath: "/root/apps/dashboard/src/App.tsx",
      basename: "App",
      content: `import { BrowserRouter } from "react-router-dom";`,
    }] as SourceFileInfo[];
    const issues = detectDependencyConfusion("/root", files);
    expect(issues.filter((i) => i.type === "dep_confusion")).toHaveLength(0);
  });
});
```

## A.5 — (opcional, maior escopo) `healthScore` não separa detectores de alta precisão dos de alta taxa de falso positivo

Depois de A.1-A.4 o ruído cai bastante, mas o princípio geral vale registrar pra não repetir: hoje todo `severity: 3` pesa igual, seja de um detector lexical preciso (`empty_catch`, `console_log_outside_cmd` — confirmei precisão alta nos dois) ou de um detector de regex solto sobre texto livre. Só entrar nisso se A.1-A.4 não forem suficientes na prática:

```ts
const DETECTOR_RELIABILITY_WEIGHT: Record<string, number> = {
  empty_catch: 1.0, console_log_outside_cmd: 1.0, orphan_module: 1.0, unused_export: 1.0, circular_dep: 1.0,
  sql_injection: 0.5, xss_risk: 0.5, path_traversal: 0.5, dep_confusion: 0.7,
};
```

---

# PARTE B — Consertar o Projeto (achados reais, não são bug de detector)

## B.1 — `high_complexity`: 6 achados reais

Complexidade ciclomática alta de verdade, confirmei lendo o código.

### `src/templates/base/scripts/sync-docs.ts:96` (`readManifestEntries`) — complexidade 32, máx 15

Parser de YAML "à mão" numa função só, com loop grande e vários `if` tratando estado. O comentário no código explica por que não usa lib de YAML — é script de template copiado pra projetos de usuário, não deve ter dependência externa. **Não mudar isso** — a correção é quebrar a função em pedaços menores.

```ts
// src/templates/base/scripts/sync-docs.ts
type ManifestEntry = { id: string; path: string; mandatory?: boolean; when?: Record<string, string> };

function finalizeEntry(current: Record<string, string>, when: Record<string, string> | undefined): ManifestEntry | null {
  if (!current.id) return null;
  return {
    id: current.id,
    path: current.path || "",
    mandatory: current.mandatory === "true" ? true : undefined,
    when,
  };
}

function parseManifestLine(
  line: string,
  state: { inBlock: boolean; inWhen: boolean; indent: number; current: Record<string, string>; when: Record<string, string> | undefined },
  key: string,
  entries: ManifestEntry[],
): "continue" | "break" {
  const trimmed = line.trim();

  if (trimmed === `${key}:`) {
    state.inBlock = true;
    return "continue";
  }
  if (!state.inBlock) return "continue";

  if (trimmed.startsWith("- id:")) {
    const finalized = finalizeEntry(state.current, state.when);
    if (finalized) entries.push(finalized);
    state.current = { id: trimmed.replace("- id:", "").trim() };
    state.when = undefined;
    state.inWhen = false;
    state.indent = line.search(/\S/);
    return "continue";
  }

  if (line.search(/\S/) <= state.indent && trimmed && !trimmed.startsWith("-")) {
    const finalized = finalizeEntry(state.current, state.when);
    if (finalized) entries.push(finalized);
    return "break";
  }

  if (trimmed === "when:") {
    state.inWhen = true;
    state.when = {};
    return "continue";
  }

  if (trimmed.includes(":")) {
    const [k, ...v] = trimmed.split(":");
    if (!k || !v.length) return "continue";
    const value = v.join(":").trim();
    if (state.inWhen) {
      state.when![k.trim()] = value;
    } else {
      state.current[k.trim()] = value;
      if (trimmed.startsWith("when:")) {
        state.inWhen = true;
        state.when = {};
      }
    }
  }
  return "continue";
}

function readManifestEntries(manifestPath: string, key: string): ManifestEntry[] {
  if (!existsSync(manifestPath)) return [];
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    const entries: ManifestEntry[] = [];
    const state = { inBlock: false, inWhen: false, indent: 0, current: {} as Record<string, string>, when: undefined as Record<string, string> | undefined };

    for (const line of raw.split("\n")) {
      if (parseManifestLine(line, state, key, entries) === "break") break;
    }
    const last = finalizeEntry(state.current, state.when);
    if (last) entries.push(last);
    return entries;
  } catch {
    return [];
  }
}
```

### Os outros 5 — mesma abordagem, sem código pronto (exigem contexto de negócio)

| Local | Função | Complexidade / máx |
|---|---|---|
| `.shitenno/scripts/add-frontmatter.ts:39` | `determineCategory` | não informado / 15 |
| `.shitenno/scripts/validators/check-docs-frontmatter.ts:32` | `determine...` (mesmo padrão) | não informado / 15 |
| `scripts/migrate-backlog.ts:23` | `parseBacklogManually` | não informado / 15 |
| `src/console/index.tsx:79` | componente anônimo | 21 / 15 |
| `src/handbook/index.tsx:45` | componente anônimo | 23 / 15 |

Instrução pro agente: aplicar o mesmo padrão do `readManifestEntries` acima — extrair sub-funções por responsabilidade, sem mudar comportamento, confirmar com os testes existentes antes/depois. Os dois últimos são componentes React anônimos — ali o refactor normal é extrair sub-componentes ou mover lógica condicional pra hooks/funções auxiliares fora do componente.

## B.2 — `broken_ref`: 19 referências quebradas em documentação de governança (baixa urgência)

Todas em `.shitenno/docs/` e `.shitenno/governance/` — documentação, não código. Notáveis: `docs/AGENTS.md` referencia `session-bootstrapper.ts` com path que não resolve; `governance/SYSTEM_MAP.md` referencia `feedback/summary.json`/`telemetry/maturity-2026-06-30.json` que não existem; `governance/WORKFLOW.md` referencia diretórios `done/` e `governance/context/checkpoints/` inexistentes.

**Ação:** `shugo audit --level standard --json | jq '.issues[] | select(.type=="broken_ref")'` pra lista completa, corrigir cada referência (ajustar path ou remover menção). Baixo risco, sem pressa, não afeta execução.

---

# Ordem de execução única

1. **A.1 — circular dep** — maior valor isolado da Parte A, uma função, teste incluso.
2. **A.2 — SQL/XSS/stripComments + self-exclusion** — mesma área, resolve 2 falsos positivos verificados ao vivo.
3. **A.4 — dep_confusion workspace-aware** — maior volume de ruído (49 issues), mesma "família" dos outros 3 (detector cego a alguma estrutura do projeto).
4. **A.3 — path traversal por confiança** — mais trabalho, menor urgência, fecha a Parte A.
5. **B.1 — refactor `sync-docs.ts`** (código pronto acima) — depois, aplicar mesmo padrão nos outros 5 quando sobrar tempo.
6. **B.2 — broken_ref** — limpeza de documentação, sem urgência.
7. **A.5 — peso do healthScore por confiabilidade** — só se 1-4 não forem suficientes na prática.

Depois de 1-4 (Parte A completa), rodar os 4 níveis de novo (`quick`/`standard`/`code-review`/`enterprise`) e comparar `issueCounts.critical` e `issueCounts.total` com o baseline atual (994 no enterprise) — deve cair uns 60-70 issues sem perder nenhum achado real. Comparar também `circularDeps` com `npx madge --circular --extensions ts src/` — devem ficar próximos (a menos da diferença esperada de `import type`, que é intencional).
