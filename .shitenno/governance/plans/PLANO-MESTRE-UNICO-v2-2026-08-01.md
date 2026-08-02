# Plano Mestre Único v2 (2026-08-01) — com código verificado contra o repositório real

**Status:** checked
**Updated_at:** 2026-08-02T02:53:52.951Z
**Date:** 2026-08-01

> Esta versão adiciona diffs concretos aos itens que consegui investigar a fundo no código deste turno (Fase 0, Fase 1 completa, e o item 12 da Fase 3). Os itens 8-11, 13-14 (Fases 2-4) continuam como estavam no documento anterior — não investiguei os módulos deles ainda (corpus de vulnerabilidades, matriz de nível, eventos órfãos). Aviso onde a investigação mudou uma conclusão do plano original.

---

## Fase 0 — sem mudança (já detalhado no v1)

**1. Migração do backlog real** — ver `PLANO-UPDATE-MANIFEST-BACKLOG-2026-08-01.md`, Achado 2. Comando `git mv` já especificado, sem alteração.

---

## Fase 1 — código isolado, agora com diffs reais

### 2. R4 — handler global de erro no daemon: ⚠️ **já existe, verificar se é isso mesmo que o item pede**

Investiguei `src/daemon/shutdown.ts` — já tem exatamente isso:
```ts
export function setupShutdown(ctx: DaemonContext, timers: ShutdownTimers): void {
  process.on("SIGTERM", () => gracefulShutdown(ctx, timers, "SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown(ctx, timers, "SIGINT"));

  process.on("uncaughtException", (err) => {
    daemonLog(ctx.logPath, "FATAL", `Uncaught exception — daemon crashing: ${err.stack ?? err.message}`);
    try { persistState(ctx.state, ctx.statePath); } catch { /* best-effort */ }
    cleanup(ctx.pidPath, ctx.sockPath);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    daemonLog(ctx.logPath, "ERROR", `Unhandled promise rejection: ${msg}`);
  });
}
```
E já está registrado em `src/daemon/index.ts:236` (`setupShutdown(ctx, shutdownTimers)`), dentro do fluxo real de inicialização do daemon — não é código morto tipo o `session-bootstrapper.ts`.

**Não tenho o texto original do Item 4 do `PLANO-FORCA-EXECUCAO`**, então não sei se ele pede algo mais específico que isso não cobre (ex.: reportar o crash pra um `getBriefing`/telemetria, ou distinguir tipos de erro). Antes de gastar esforço aqui: comparar o texto original do item com este código e confirmar se ainda falta algo, ou se o item já está resolvido e pode sair da Fase 1.

---

### 3-4. `getTemplatesDir()` + `scanTemplateHashes`/`diffManifestsV2`

Sem mudança — código completo já está em `PLANO-UPDATE-MANIFEST-BACKLOG-2026-08-01.md`, seções "Achado 1", passos 1-6. Reaproveitar de lá.

---

### 5. Regressão 1 — composição estrutural de níveis: confirmado, com diff real

`src/audit/constants/detectors-standard.ts`, `detectors-code-review.ts` e `detectors-enterprise.ts` **copiam e colam** os itens do nível anterior em vez de compor por spread. Confirmado lendo os três arquivos lado a lado — `STANDARD_DETECTORS` repete literalmente as 6 entradas de `QUICK_DETECTORS`; `CODE_REVIEW_DETECTORS` repete as ~16 de `STANDARD_DETECTORS`, e assim por diante.

**Fix:**
```diff
--- a/src/audit/constants/detectors-standard.ts
+++ b/src/audit/constants/detectors-standard.ts
+import { QUICK_DETECTORS } from "./detectors-quick.js";
+
 /** Standard-level detectors — includes all quick-level plus structural and security checks. */
 export const STANDARD_DETECTORS: string[] = [
-  // Quick-level detectors
-  "detectMissingDocs",
-  "detectDatePlaceholders",
-  "detectMissingGitignore",
-  "detectMissingPackageJson",
-  "detectStaleBuffer",
-  "detectMaturityInconsistency",
+  ...QUICK_DETECTORS,
   // Structural detectors
   "detectBrokenRefs",
   "detectBrokenDirRefs",
   ... (resto inalterado)
 ];
```
Mesmo padrão em `detectors-code-review.ts` (importar e espalhar `STANDARD_DETECTORS`) e `detectors-enterprise.ts` (importar e espalhar `CODE_REVIEW_DETECTORS`).

**Script de verificação** (`scripts/verify/detector-composition.ts`, referenciado no plano original, ainda não escrito):
```ts
import { QUICK_DETECTORS } from "../../src/audit/constants/detectors-quick.js";
import { STANDARD_DETECTORS } from "../../src/audit/constants/detectors-standard.js";
import { CODE_REVIEW_DETECTORS } from "../../src/audit/constants/detectors-code-review.js";
import { ENTERPRISE_DETECTORS } from "../../src/audit/constants/detectors-enterprise.js";

function assertSuperset(bigger: string[], smaller: string[], biggerName: string, smallerName: string) {
  const missing = smaller.filter((d) => !bigger.includes(d));
  if (missing.length > 0) {
    console.error(`❌ ${biggerName} não contém todos os detectores de ${smallerName}: ${missing.join(", ")}`);
    process.exit(1);
  }
}

assertSuperset(STANDARD_DETECTORS, QUICK_DETECTORS, "STANDARD_DETECTORS", "QUICK_DETECTORS");
assertSuperset(CODE_REVIEW_DETECTORS, STANDARD_DETECTORS, "CODE_REVIEW_DETECTORS", "STANDARD_DETECTORS");
assertSuperset(ENTERPRISE_DETECTORS, CODE_REVIEW_DETECTORS, "ENTERPRISE_DETECTORS", "CODE_REVIEW_DETECTORS");
console.log("✅ Composição de níveis OK — cada nível é superset do anterior");
```
Adicionar como `pnpm run verify:detector-composition` e plugar no `pnpm run test` ou CI.

---

### 6. Regressão 2 — exclusão por padrão de linha, não por caminho: confirmado, nome real diferente do plano

O plano chama de `isSelfPath`; a função real se chama **`isDetectorDefinitionFile`**, em `src/audit/security/helpers.ts`:
```ts
export function isDetectorDefinitionFile(relPath: string): boolean {
  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
}
```
Usada em **10 pontos** (`secrets.ts` ×2, `crypto.ts` ×2, `cors.ts` ×2, `path-traversal.ts`, `injection.ts` ×4), sempre como `if (isDetectorDefinitionFile(file.relPath)) continue;` — pula o **arquivo inteiro**. E `SECURITY_DETECTOR_SELF_PATHS` inclui `"src/audit/security/"` como prefixo — ou seja, **todo o diretório de detectores de segurança fica cego pra si mesmo**, não só os arquivos que de fato definem padrões (`taint/sinks.ts`, `taint/sources.ts`, etc.). Um segredo real hardcoded em `src/audit/security/cors.ts`, por exemplo, nunca seria detectado.

**Fix — restringir a exclusão a arquivos que genuinamente definem padrões, e por linha, não por arquivo inteiro:**
```diff
--- a/src/audit/constants.ts
+++ b/src/audit/constants.ts
-export const SECURITY_DETECTOR_SELF_PATHS = [
-  "src/health-auditor.ts",
-  "src/audit/taint/analyzer.ts",
-  "src/audit/taint/ast-visitor.ts",
-  "src/audit/taint/sinks.ts",
-  "src/audit/taint/sources.ts",
-  "src/audit/taint/sanitizers.ts",
-  "src/audit/taint/issue-builder.ts",
-  "src/audit/security/",
-  "src/audit/engineering-detectors.ts",
-  "src/audit/engineering-detectors-security.ts",
-  "src/audit/engineering-detectors-quality.ts",
-  "src/audit/engineering-detectors-supply.ts",
-];
+// Só os ficheiros que literalmente DEFINEM padrões de deteção (listas de nomes/regex),
+// não qualquer ficheiro que trate do assunto "segurança".
+export const DETECTOR_PATTERN_FILES = new Set([
+  "src/audit/taint/sinks.ts",
+  "src/audit/taint/sources.ts",
+  "src/audit/taint/sanitizers.ts",
+]);
```

```diff
--- a/src/audit/security/helpers.ts
+++ b/src/audit/security/helpers.ts
-import { SECURITY_DETECTOR_SELF_PATHS } from "../constants.js";
+import { DETECTOR_PATTERN_FILES } from "../constants.js";

-export function isDetectorDefinitionFile(relPath: string): boolean {
-  return SECURITY_DETECTOR_SELF_PATHS.some((p) => relPath.startsWith(p));
-}
+/** true só quando a LINHA é uma definição de padrão dentro de um ficheiro de definição —
+ *  nunca exclui o ficheiro inteiro, e nunca exclui ficheiros fora da lista fechada. */
+export function isDetectorPatternLine(relPath: string, lineContent: string): boolean {
+  if (!DETECTOR_PATTERN_FILES.has(relPath)) return false;
+  return /name:\s*["'`]/.test(lineContent) || /pattern:\s*\//.test(lineContent);
+}
```

Isso muda a forma como os 10 call sites funcionam — hoje pulam o arquivo inteiro no topo do loop; precisam passar a checar por linha/match, dentro do loop:
```diff
--- a/src/audit/security/secrets.ts (exemplo — mesmo padrão nos outros 9 call sites)
+++ b/src/audit/security/secrets.ts
 for (const match of matches) {
-  if (isDetectorDefinitionFile(file.relPath)) continue;
+  if (isDetectorPatternLine(file.relPath, match.lineContent)) continue;
   ... reportar issue
 }
```
(o nome exato do campo de conteúdo da linha, `match.lineContent` aqui, precisa ser confirmado olhando a assinatura real de `matches` em cada um dos 5 arquivos — não é uniforme o suficiente pra eu garantir sem ver os 5 tipos de `match` usados)

**Script de verificação** (`scripts/verify/self-exclusion.ts`, o teste do vazamento real):
```ts
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectHardcodedSecrets } from "../../src/audit/security/secrets.js"; // ajustar export real

const dir = mkdtempSync(join(tmpdir(), "self-excl-"));
const fakeFile = join(dir, "src/audit/security/analyzer.ts"); // caminho que já vazou 2x
writeFileSync(fakeFile, `const key = "AKIAIOSFODNN7EXAMPLE"; // AWS key real, não padrão de deteção`);

const issues = detectHardcodedSecrets(/* ... */);
if (issues.length === 0) {
  console.error("❌ Segredo real em src/audit/security/analyzer.ts não foi detectado — regressão do self-exclusion voltou");
  process.exit(1);
}
console.log("✅ Self-exclusion não está mais mascarando segredos reais");
rmSync(dir, { recursive: true });
```

---

### 12. Causa raiz sistêmica (`ts.TypeChecker`) — plano original superestimou o esforço, o checker já está disponível

O plano trata isto como "sessão de investigação dedicada, não patch pronto". Fui ver o código: **não precisa ser.** `src/audit/taint/ast-visitor.ts` já recebe `ctx.checker: ts.TypeChecker` disponível exatamente no ponto onde o match por nome acontece:
```ts
// src/audit/taint/ast-visitor.ts, ~linha 79
const sinkDef = findTaintSink(funcName);
```
E `findTaintSink`, em `src/audit/taint/sinks.ts`:
```ts
export function findTaintSink(name: string): TaintSinkDef | undefined {
  return ALL_SINKS.find((s) => s.name === name || name.endsWith(\".\" + s.name));
}
```
Casa só pelo nome — `.find()` de um array e `.find()` de uma collection MongoDB são indistinguíveis hoje.

**Fix — passar o checker e o node original até o ponto de match, confirmar o tipo do receiver antes de aceitar:**
```diff
--- a/src/audit/taint/sinks.ts
+++ b/src/audit/taint/sinks.ts
-export function findTaintSink(name: string): TaintSinkDef | undefined {
-  return ALL_SINKS.find((s) => s.name === name || name.endsWith("." + s.name));
-}
+export function findTaintSink(
+  name: string,
+  receiverType?: ts.Type,
+  checker?: ts.TypeChecker
+): TaintSinkDef | undefined {
+  const candidates = ALL_SINKS.filter((s) => s.name === name || name.endsWith("." + s.name));
+  if (candidates.length <= 1 || !receiverType || !checker) return candidates[0];
+  // Mais de um sink candidato pro mesmo nome (ex.: "find" bate em NOSQL_SINKS e em Array.prototype.find):
+  // descartar candidatos cujo tipo declarado do receiver não é compatível com o esperado
+  // (ex.: Array<T> nunca deveria casar com um sink de driver Mongo).
+  return candidates.find((s) => isReceiverTypeCompatible(receiverType, s, checker)) ?? undefined;
+}
+
+function isReceiverTypeCompatible(receiverType: ts.Type, sink: TaintSinkDef, checker: ts.TypeChecker): boolean {
+  const typeName = checker.typeToString(receiverType);
+  if (sink.issueType === "nosql_injection") {
+    // heurística inicial: excluir Array/ReadonlyArray explicitamente do lado do array nativo
+    return !/^(Array|ReadonlyArray)</.test(typeName);
+  }
+  return true;
+}
```
```diff
--- a/src/audit/taint/ast-visitor.ts
+++ b/src/audit/taint/ast-visitor.ts
-  const sinkDef = findTaintSink(funcName);
+  const receiverExpr = /* expressão do node de acesso, ex. node.expression.expression */;
+  const receiverType = ctx.checker.getTypeAtLocation(receiverExpr);
+  const sinkDef = findTaintSink(funcName, receiverType, ctx.checker);
```
Esboço, não diff final — falta eu ver a AST exata de `CallExpression`/`PropertyAccessExpression` usada nesse ponto de `ast-visitor.ts` pra saber qual sub-expressão exata é "o receiver" em cada forma de chamada (`x.find()` vs `x?.find()` vs `(await x).find()`). Mas a heurística de "resolver o tipo do receiver e descartar candidatos incompatíveis" é a direção certa, e o `checker` já passa por toda a cadeia de chamadas sem precisar ser adicionado — isso é o que reduz o item de "sessão de investigação cara" pra "meio dia de trabalho com teste".

**Teste TDD (vermelho antes do fix):**
```ts
// src/audit/taint/__tests__/sink-type-check.test.ts (novo)
it("NÃO marca Array.prototype.find() como sink NoSQL", () => {
  const code = `const arr = [1,2,3]; const found = arr.find(x => x > 1);`;
  const issues = runTaintAnalysis(code);
  expect(issues.filter(i => i.issueType === "nosql_injection")).toHaveLength(0);
});

it("AINDA marca collection.find() como sink NoSQL quando o tipo é de driver Mongo", () => {
  const code = `const doc = await db.collection("users").find(req.body.filter);`;
  const issues = runTaintAnalysis(code);
  expect(issues.some(i => i.issueType === "nosql_injection")).toBe(true);
});
```

---

## Fases 2-4 (8-14) — sem mudança, ainda não investigadas a fundo

Não abri `vuln-corpus/`, `audit-level-matrix.test.ts`, nem os 9 eventos órfãos (W2) neste turno — o texto do plano original (itens 8-14) continua sendo o que temos. Se quiser o mesmo nível de detalhe aí, preciso investigar esses módulos especificamente — aviso, porque não quero prometer profundidade que não confirmei.

---

## Guardrails (sem mudança do v1)

- `pnpm run build && npx vitest run --maxWorkers=2` após cada item.
- `diffManifests()` original intocada.
- Nenhum item considerado concluído sem o script de verificação correspondente rodando e pegando o problema de propósito pelo menos uma vez.
- **Novo, específico do item 6:** antes de aplicar, confirmar a assinatura real de `matches`/`match.lineContent` nos 5 arquivos afetados (`secrets.ts`, `crypto.ts`, `cors.ts`, `path-traversal.ts`, `injection.ts`) — os nomes de campo podem não ser idênticos entre eles.
