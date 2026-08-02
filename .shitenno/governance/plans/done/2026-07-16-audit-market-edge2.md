# PLAN-AUDIT-EDGE — Fechar gaps de mercado sem perder o diferencial de Governance Intelligence

**Status:** In Progress
**Date:** 2026-07-16
**Updated_at:** 2026-07-21T15:11:11.067Z
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 8-10h (3 sub-planos independentes, podem ser feitos em paralelo)

---


## Checklist

- [ ] `shiten audit --apply` num repo de teste com um `unused_import` conhecido: import é removido, `npm run typecheck` roda automaticamente, e se passar o fix fica; se um fix quebrar o build, o arquivo volta ao estado original e o issue é reportado como "fix tentado e revertido".
- [ ] `shiten audit --changed` num branch com 2 arquivos alterados de um projeto com 200 arquivos: tempo de execução cai proporcionalmente (medir com `durationMs` já existente no `HealthAuditReport`).
- [ ] Output humano do `shiten audit` mostra um card por dimensão com nota/score antes da lista de issues.

## Contexto

Análise comparativa (2026) contra SonarQube, Semgrep, CodeQL, Snyk Code, DeepSource e Rafter:

| Dimensão | Líder de mercado | Shitenno-go hoje |
|---|---|---|
| Autofix | DeepSource/Rafter geram **patches verificados**, não só texto | `suggestion-engine.ts` já tem `currentCode`/`suggestedCode` mas nada aplica nem valida |
| Velocidade / feedback incremental | Semgrep escaneia diff em ~10s | `cache.ts` é all-or-nothing: 1 arquivo mudou → recalcula tudo |
| Relatório por dimensão ("PR Report Card") | Rafter agrupa em 5 eixos (segurança/confiabilidade/complexidade/higiene/cobertura) | `audit.ts` lista issue por issue, sem agregação por dimensão |
| Análise semântica/taint | CodeQL é referência (5% FP, mas lento e trancado no GitHub) | `detectTaintFlow` já existe — comparável em conceito |
| **Memória institucional / governança** (ADRs, knowledge graph, coerência doc↔código, decisões passadas) | **Nenhum concorrente cobre isso** — é *out of scope* pra todos eles | `governance-detectors-*.ts` já cobre. **Este é o fosso competitivo real.** |
| Black-box vs. auditável | Snyk Code é ML black-box (não dá pra saber por quê) | 100% detectors determinísticos, sem LLM — motivo já documentado no cabeçalho do `suggestion-engine.ts` |

**Conclusão estratégica:** não faz sentido copiar Snyk/CodeQL na profundidade de SAST puro — isso é jogo de escala e research team dedicado. O melhor uso do esforço é **(a)** fechar os 3 gaps táticos que dão vantagem imediata de produto (autofix verificado, incremental, relatório por dimensão) e **(b)** continuar investindo no que nenhum concorrente faz (governança), documentando isso como posicionamento explícito.

Este plano cobre os 3 gaps táticos como sub-planos independentes. O reforço de governança fica fora daqui — é trabalho de expandir detectors já existentes, não uma capability nova.

## Objetivo

1. `shiten audit --apply` aplica um fix de baixo risco **e valida** (typecheck + testes) antes de manter a mudança — se falhar, reverte automaticamente.
2. `shiten audit --changed` (ou detecção automática de PR/branch) escaneia só arquivos alterados desde a base branch, com fallback pro scan completo.
3. Saída do CLI (humana e `--json`) agrupa issues em dimensões (Segurança / Confiabilidade / Complexidade / Higiene / Cobertura / Governança) com uma nota por dimensão, não só lista plana.

**Critérios de aceitação:**
- [ ] `shiten audit --apply` num repo de teste com um `unused_import` conhecido: import é removido, `npm run typecheck` roda automaticamente, e se passar o fix fica; se um fix quebrar o build, o arquivo volta ao estado original e o issue é reportado como "fix tentado e revertido".
- [ ] `shiten audit --changed` num branch com 2 arquivos alterados de um projeto com 200 arquivos: tempo de execução cai proporcionalmente (medir com `durationMs` já existente no `HealthAuditReport`).
- [ ] Output humano do `shiten audit` mostra um card por dimensão com nota/score antes da lista de issues.

## Passos de Implementação

### Sub-plano A: Autofix Verificado

#### Passo A1: Motor de aplicação de patch com sandbox e rollback
**Ficheiro:** novo `src/audit/autofix-engine.ts`
**Ação:**

```ts
import { readFileSync, writeFileSync, copyFileSync, unlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import type { Suggestion } from "./suggestion-engine.js";

export interface ApplyResult {
  suggestion: Suggestion;
  status: "applied" | "reverted" | "skipped";
  reason?: string;
}

/**
 * Aplica uma sugestão, valida com typecheck, reverte se quebrar.
 * NUNCA aplica se confidence < threshold (default 0.85) — autofix só em fixes de alta certeza.
 */
export function applyAndVerify(
  suggestion: Suggestion,
  projectRoot: string,
  opts: { minConfidence?: number; verifyCommand?: string } = {}
): ApplyResult {
  const minConfidence = opts.minConfidence ?? 0.85;
  if (suggestion.confidence < minConfidence) {
    return { suggestion, status: "skipped", reason: `confidence ${suggestion.confidence} < ${minConfidence}` };
  }

  const filePath = `${projectRoot}/${suggestion.file}`;
  const backupPath = `${filePath}.shiten-backup`;
  copyFileSync(filePath, backupPath);

  try {
    const content = readFileSync(filePath, "utf-8");
    if (!content.includes(suggestion.currentCode)) {
      unlinkSync(backupPath);
      return { suggestion, status: "skipped", reason: "currentCode não encontrado — arquivo mudou desde o audit" };
    }
    const patched = content.replace(suggestion.currentCode, suggestion.suggestedCode);
    writeFileSync(filePath, patched, "utf-8");

    const verifyCmd = opts.verifyCommand ?? "npm run typecheck";
    execSync(verifyCmd, { cwd: projectRoot, stdio: "pipe" });

    unlinkSync(backupPath);
    return { suggestion, status: "applied" };
  } catch (error) {
    copyFileSync(backupPath, filePath);
    unlinkSync(backupPath);
    return { suggestion, status: "reverted", reason: String(error).slice(0, 200) };
  }
}
```

**Verificação:** Teste unitário com fixture: (1) fix válido que passa typecheck → `status: "applied"`; (2) fix que injeta erro de sintaxe proposital → `status: "reverted"` e arquivo original intacto (comparar hash antes/depois).

#### Passo A2: Flag `--apply` no comando de audit
**Ficheiro:** `src/commands/audit.ts`
**Ação:** Adicionar `.option("--apply", "Aplicar fixes de alta confiança automaticamente (com verificação e rollback)")`.
Quando ativa: gerar suggestions via `generateFixSuggestions` (já existe, linha ~466), chamar `applyAndVerify` para cada uma com `confidence >= 0.85`, e reportar contagem de `applied`/`reverted`/`skipped` no resumo final. **Nunca aplicar sem essa flag explícita** — comportamento padrão continua só sugerindo.

**Verificação:** Rodar `shiten audit --apply --dry-run` (adicionar `--dry-run` que só simula, não escreve) antes de liberar `--apply` de verdade, para reduzir risco de regressão em uso real.

### Sub-plano B: Scan incremental (`--changed`)

#### Passo B1: Detectar arquivos alterados via git
**Ficheiro:** novo `src/audit/changed-files.ts`
**Ação:**

```ts
import { execSync } from "node:child_process";

/** Retorna paths (relativos ao projectRoot) alterados desde a base branch. */
export function getChangedFiles(projectRoot: string, baseBranch = "main"): string[] {
  try {
    const output = execSync(`git diff --name-only ${baseBranch}...HEAD`, { cwd: projectRoot, encoding: "utf-8" });
    return output.split("\n").filter(Boolean);
  } catch {
    return []; // não é repo git, ou base branch não existe — caller decide fallback
  }
}
```

**Verificação:** Rodar em branch com commits conhecidos e comparar contra `git diff --name-only main` manual.

#### Passo B2: Filtrar `collectSourceFiles` e desativar detectors incompatíveis com scan parcial
**Ficheiro:** `src/health-auditor.ts`, `src/audit/shared.ts`
**Ação:** Adicionar parâmetro opcional `changedOnly?: string[]` em `auditHealth`. Quando presente, filtrar `sourceFiles` para os paths informados **antes** de rodar detectors por-arquivo (complexidade, dead code, secrets, etc). Detectors que dependem de análise cross-file (`detectCircularDeps`, `detectOrphanModules`, `detectSystemMapMismatch`, correlação de knowledge graph) devem continuar rodando no projeto completo — documentar essa lista explicitamente em `constants.ts` como `CROSS_FILE_DETECTORS` pra não gerar falso-negativo silencioso (ex: dizer "0 circular deps" só porque só 2 arquivos foram olhados seria enganoso).

```ts
export const CROSS_FILE_ONLY_DETECTORS = new Set([
  "detectCircularDeps",
  "detectOrphanModules",
  "detectSystemMapMismatch",
  "detectModuleCoupling",
  "detectBarrelFileCycles",
  // ... demais que precisam do grafo completo
]);
```

**Verificação:** Rodar `--changed` num repo com 2 arquivos modificados; confirmar no `--json` que `detectorsRun` mostra os cross-file detectors executados sobre o projeto todo e os demais só sobre os 2 arquivos; comparar `durationMs` com scan completo.

#### Passo B3: Flag `--changed [baseBranch]` no CLI
**Ficheiro:** `src/commands/audit.ts`
**Ação:** `.option("--changed [base]", "Auditar apenas arquivos alterados desde a base branch (default: main)")`. Fallback automático pro scan completo se não for repo git ou branch não existir, com aviso claro (não falhar silenciosamente).

**Verificação:** Critério de aceitação do Objetivo 2.

### Sub-plano C: Relatório por dimensão ("Health Card")

#### Passo C1: Mapear cada `HealthIssueType` pra uma dimensão
**Ficheiro:** novo `src/audit/dimensions.ts`
**Ação:**

```ts
export type AuditDimension = "security" | "reliability" | "complexity" | "hygiene" | "coverage" | "governance";

export const DIMENSION_BY_TYPE: Partial<Record<string, AuditDimension>> = {
  hardcoded_secret: "security", sql_injection: "security", xss_risk: "security",
  command_injection: "security", weak_crypto: "security", insecure_cors: "security",
  missing_circuit_breaker: "reliability", race_condition_risk: "reliability",
  deadlock_risk: "reliability", missing_retry_policy: "reliability",
  high_complexity: "complexity", god_function: "complexity", deep_nesting: "complexity",
  duplicate_code: "complexity",
  console_log_outside_cmd: "hygiene", empty_catch: "hygiene", dead_code: "hygiene",
  unused_export: "hygiene",
  missing_test: "coverage", low_coverage_threshold: "coverage", test_failure: "coverage",
  dead_rule: "governance", broken_ref: "governance", adr_coverage_gap: "governance",
  system_map_mismatch: "governance", cross_doc_p0_contradiction: "governance",
  // ... completar pros ~150 tipos; tipo sem mapeamento cai em "hygiene" por default
};

export function dimensionOf(type: string): AuditDimension {
  return DIMENSION_BY_TYPE[type] ?? "hygiene";
}
```

**Verificação:** Teste garantindo que todo `HealthIssueType` do union em `types.ts` tem entrada aqui (script simples que compara as duas listas e falha o CI se houver tipo órfão — isso também vira um novo self-check do próprio sistema).

#### Passo C2: Calcular nota por dimensão
**Ficheiro:** `src/audit/health-score.ts`
**Ação:** Adicionar `calculateDimensionScores(issues: HealthIssue[], totalFiles: number): Record<AuditDimension, number>` reaproveitando a mesma fórmula de `calculateHealthScore`, mas filtrando por dimensão antes.

**Verificação:** Soma ponderada das dimensões deve ser coerente com o score geral (não precisa ser média simples, mas não pode divergir absurdamente — documentar a relação).

#### Passo C3: Exibir o "Health Card" no CLI antes da lista de issues
**Ficheiro:** `src/commands/audit.ts`
**Ação:** Logo após o banner, antes de "Critical Issues", imprimir um bloco:

```
  📊 Health Card
    🔒 Segurança       92/100
    🛡️  Confiabilidade  78/100
    🧩 Complexidade     85/100
    🧹 Higiene          70/100
    ✅ Cobertura        60/100
    🏛️  Governança       95/100
```

Incluir os mesmos valores em `report` (`HealthAuditReport.dimensionScores`) pro `--json`.

**Verificação:** Critério de aceitação do Objetivo 3.

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | Autofix só acima de `confidence >= 0.85` e sempre com rollback automático | Aplicar tudo e deixar o usuário reverter via git | Documentado no próprio `suggestion-engine.ts`: "NEVER auto-applies" é um valor do projeto — `--apply` precisa manter essa garantia via verificação, não relaxar a regra |
| 2 | Scan incremental mantém detectors cross-file rodando full-scan sempre | Rodar tudo só nos arquivos alterados | Falso-negativo silencioso em `circular_dep`/`orphan_module` é pior que scan mais lento — combina com o valor de "auditável" que diferencia de ferramentas black-box |
| 3 | Dimensão "Governança" como uma das 6 categorias do Health Card | Deixar governança misturada em "hygiene" como hoje | É o diferencial competitivo (nenhum concorrente tem) — precisa aparecer como categoria de primeira classe no relatório, não enterrada |
| 4 | Não competir em profundidade de SAST puro com CodeQL/Snyk | Investir em taint analysis mais avançado que a concorrência | Custo/benefício ruim — são empresas com times dedicados a isso; o `detectTaintFlow` atual já é suficiente pro nível de risco do projeto |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | `--apply` corrompe arquivo se `verifyCommand` for lento/flaky (testes com timeout) | Alto | Backup físico (`.shiten-backup`) antes de qualquer escrita, sempre; timeout curto no `execSync` (ex: 60s) tratado como falha → reverte |
| 2 | Scan incremental gera falsa sensação de segurança ("0 issues" porque só 2 arquivos foram olhados) | Médio | Output sempre declara explicitamente `Scanned: 2/200 files (--changed mode)` — nunca omitir esse contexto |
| 3 | Mapeamento de dimensão (`dimensions.ts`) fica desatualizado conforme novos detectors são criados | Baixo | Teste de CI que falha se `HealthIssueType` novo não tiver entrada em `DIMENSION_BY_TYPE` (Passo C1) |
| 4 | `git diff` em Sub-plano B falha silenciosamente em ambientes sem git (CI de terceiros, zip extraído) | Baixo | Fallback documentado no Passo B3 — nunca crash, sempre cai pro scan completo com aviso |

---

## Nota de posicionamento (não é passo de implementação, é contexto pro time)

Depois desses 3 sub-planos, o `shiten audit` cobre as mesmas expectativas básicas de mercado
(autofix, velocidade, relatório legível) **sem abrir mão do que o diferencia**: é o único audit
que entende decisões de arquitetura passadas, coerência entre documentação e código, e memória
institucional do projeto — coisa que SonarQube, Semgrep, CodeQL e Snyk nem tentam fazer porque
não é o problema que eles resolvem. Vale documentar isso em `docs/capabilities.md` como
posicionamento explícito assim que os sub-planos forem concluídos.
