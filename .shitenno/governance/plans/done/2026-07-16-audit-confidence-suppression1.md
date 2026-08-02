# PLAN-AUDIT-CONF — Confidence Score + Suppression Baseline no `shiten audit`

**Status:** In Progress
**Date:** 2026-07-16
**Updated_at:** 2026-07-21T15:11:11.067Z
**Priority:** P1
**Owner:** AI Agent
**Estimated Time:** 4-6h

---


## Checklist

- [x] Passo 1 — Estender o tipo `HealthIssue`
- [x] Passo 2 — Anotar confiança nos detectors de maior risco de falso positivo
- [x] Passo 3 — Correlação entre detectors aumenta confiança
- [x] Passo 4 — `healthScore` pondera por confiança
- [x] Passo 5 — Suppression baseline
- [x] Passo 6 — Comando `shiten audit suppress` e flags de CLI
- [x] `npm run typecheck` sem erros após a mudança.
- [x] `health-auditor.test.ts` e `suggestion-engine` tests continuam passando (2043 tests pass across 130 files).
- [ ] Rodar `shiten audit --level enterprise` num repo real e comparar `healthScore` antes/depois — divergência deve ser explicável (não aleatória).
- [ ] Suprimir um issue via `shiten audit suppress <hash>` e confirmar que ele some do próximo `shiten audit` mas aparece em `shiten audit --show-suppressed`.

## Contexto

O `shiten audit` hoje roda ~150 detectors (4 níveis: `quick`/`standard`/`code-review`/`enterprise`)
mas o tipo `HealthIssue` (`src/audit/types.ts`) não carrega nenhum sinal de confiança:

```ts
export interface HealthIssue {
  type: HealthIssueType;
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
}
```

Consequência prática: um detector baseado em regex frágil (ex: `detectConsoleSecrets`,
`detectWeakRandomness`) tem o mesmo peso, na tela e no `healthScore`
(`src/audit/health-score.ts`), que um detector com data-flow real (`detectTaintFlow`).
Isso gera ruído e corrói a confiança do usuário no relatório — ele para de ler os issues
"info" porque não sabe quais são reais.

Também não existe mecanismo de **supressão auditável**: se o usuário decide que um issue é
falso positivo ou aceitável (ex: `console.log` proposital num script CLI), a única opção hoje
é ignorar visualmente — o issue volta a aparecer em toda auditoria, sem histórico da decisão.

Ficheiros afetados: `src/audit/types.ts`, `src/audit/shared.ts`, `src/audit/health-score.ts`,
`src/audit/detector-map.ts`, `src/commands/audit.ts`, detectors de maior risco de falso
positivo (`engineering-detectors-security.ts`, `code-quality-detectors.ts`).

## Objetivo

1. Todo `HealthIssue` carrega um `confidence: number` (0–1). Detectors com heurística fraca
   declaram confiança menor; detectors com análise estrutural (taint, AST) declaram confiança alta.
2. `healthScore` passa a ponderar por confiança, não só por severidade.
3. Usuário pode suprimir um issue específico com motivo, e a supressão fica registrada e
   visível no relatório (não é um "sumiço silencioso").
4. CLI ganha `--min-confidence <0..1>` para filtrar ruído sem esconder issues de alta confiança.

**Critérios de aceitação:**
- [ ] `npm run typecheck` sem erros após a mudança.
- [ ] `health-auditor.test.ts` e `suggestion-engine` tests continuam passando (rodar com fixtures antigas para garantir que `confidence` default não quebra contrato existente).
- [ ] Rodar `shiten audit --level enterprise` num repo real e comparar `healthScore` antes/depois — divergência deve ser explicável (não aleatória).
- [ ] Suprimir um issue via `shiten audit suppress <hash>` e confirmar que ele some do próximo `shiten audit` mas aparece em `shiten audit --show-suppressed`.

## Passos de Implementação

### Passo 1: Estender o tipo `HealthIssue`
**Ficheiro:** `src/audit/types.ts`
**Ação:** Adicionar campo opcional `confidence?: number` (0–1, default implícito 1.0 quando
ausente para não quebrar detectors não migrados ainda) e um `id`/hash estável para permitir
supressão. Adicionar helper de hash:

```ts
export interface HealthIssue {
  type: HealthIssueType;
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  recommendation: string;
  /** 0–1. Confiança do detector no achado. Ausente = tratar como 1.0 (detectors legados). */
  confidence?: number;
}
```

Criar em `src/audit/shared.ts`:

```ts
import { createHash } from "node:crypto";

/** Hash estável do issue, usado para supressão e tracking histórico. */
export function issueFingerprint(issue: HealthIssue): string {
  return createHash("sha1")
    .update(`${issue.type}|${issue.location}|${issue.description}`)
    .digest("hex")
    .slice(0, 10);
}
```

**Verificação:** `npm run typecheck` limpo; nenhum detector existente quebra (campo é opcional).

### Passo 2: Anotar confiança nos detectors de maior risco de falso positivo
**Ficheiro:** `src/audit/engineering-detectors-security.ts`, `src/audit/code-quality-detectors.ts`
**Ação:** Não é preciso migrar os ~150 detectors de uma vez — priorizar os que usam regex solto
sobre texto livre (alto risco de FP): `detectConsoleSecrets`, `detectWeakRandomness`,
`detectHardcodedSecrets`, `detectMagicNumbers`, `detectDeepNesting`. Exemplo:

```ts
// Antes
issues.push({
  type: "hardcoded_secret",
  severity: 3,
  description: `Possível secret hardcoded: ${match[0].slice(0, 20)}...`,
  location: `${file.relPath}:${lineNum}`,
  recommendation: "Mover para variável de ambiente ou secret manager.",
});

// Depois — confiança varia conforme o padrão
const isHighEntropy = shannonEntropy(match[0]) > 4.0; // reaproveitar heurística já usada em detectDependencyConfusion se existir, senão implementar simples
issues.push({
  type: "hardcoded_secret",
  severity: 3,
  description: `Possível secret hardcoded: ${match[0].slice(0, 20)}...`,
  location: `${file.relPath}:${lineNum}`,
  recommendation: "Mover para variável de ambiente ou secret manager.",
  confidence: isHighEntropy ? 0.9 : 0.55,
});
```

Regra prática de calibração inicial (documentar em comentário no topo de cada arquivo de detector):
- `1.0 – 0.9`: análise estrutural/data-flow (taint, AST) ou match determinístico (arquivo ausente, JSON inválido).
- `0.75 – 0.89`: regex específica com baixo overlap com código legítimo.
- `0.5 – 0.74`: regex genérica ou heurística textual (ex: contagem de palavras-chave).
- `< 0.5`: não emitir issue — se a confiança é essa baixa, é melhor nem reportar.

**Verificação:** Rodar `shiten audit --level enterprise --json` e conferir no output que os issues desses tipos têm `confidence` presente.

### Passo 3: Correlação entre detectors aumenta confiança
**Ficheiro:** `src/audit/shared.ts` (função `deduplicateIssues`, renomear conceito para `deduplicateAndCorrelate`)
**Ação:** Quando dois detectors diferentes apontam a mesma `location` (mesmo arquivo/linha) com
tipos correlatos (ex: `hardcoded_secret` + `console_secret` na mesma linha), subir a confiança do
issue mantido em vez de simplesmente descartar o duplicado:

```ts
export function deduplicateIssues(issues: HealthIssue[]): HealthIssue[] {
  const seen = new Map<string, HealthIssue>();
  const locationHits = new Map<string, number>(); // quantos detectors distintos bateram no mesmo local

  for (const issue of issues) {
    const key = `${issue.type}|${issue.description}|${issue.location}`;
    if (!seen.has(key)) seen.set(key, issue);
    locationHits.set(issue.location, (locationHits.get(issue.location) ?? 0) + 1);
  }

  return Array.from(seen.values()).map((issue) => {
    const hits = locationHits.get(issue.location) ?? 1;
    if (hits > 1 && issue.confidence !== undefined) {
      return { ...issue, confidence: Math.min(1, issue.confidence + 0.1 * (hits - 1)) };
    }
    return issue;
  });
}
```

**Verificação:** Teste unitário novo em `src/__tests__/health-auditor.test.ts` — dois issues sintéticos na mesma location, confiança sobe.

### Passo 4: `healthScore` pondera por confiança
**Ficheiro:** `src/audit/health-score.ts`
**Ação:** Multiplicar o peso do issue pela confiança (default 1.0 se ausente), para não deixar
issues de baixa confiança derrubarem o score tanto quanto um issue certeiro:

```ts
export function calculateHealthScore(issues: HealthIssue[], totalFiles: number): number {
  const weights: Record<number, number> = { 3: 5, 2: 2, 1: 0.5 };
  const rawPenalty = issues.reduce((sum, issue) => {
    const w = weights[issue.severity] ?? 0;
    const conf = issue.confidence ?? 1.0;
    return sum + w * conf;
  }, 0);
  const normalizer = Math.max(totalFiles, 10);
  const density = rawPenalty / normalizer;
  const score = 100 * Math.exp(-density * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}
```

Nota: isso muda a fórmula de `Math.sqrt(count)` agregado por severidade para soma direta ponderada por
confiança — validar contra os snapshots de `health-*.json` existentes em `shitenno-go/reports/` para
não gerar regressão brusca de score num projeto já auditado. Se a diferença for grande, manter
`Math.sqrt` por severidade e aplicar confiança como fator multiplicativo por grupo, não por issue.

**Verificação:** Comparar `healthScore` antes/depois nos relatórios já salvos em `shitenno-go/reports/health-*.json` deste próprio repo — a mudança deve ser pequena e para cima (menos penalização por ruído), nunca para baixo sem explicação.

### Passo 5: Suppression baseline
**Ficheiro:** novo `src/audit/suppression.ts`
**Ação:** Arquivo de configuração versionável `shitenno-go/audit-suppressions.json`:

```ts
export interface Suppression {
  fingerprint: string;      // issueFingerprint()
  type: string;              // HealthIssueType, para leitura humana
  location: string;
  reason: string;
  suppressedBy: string;      // "user" | nome do agente
  suppressedAt: string;      // ISO date
}

export function loadSuppressions(shitenDir: string): Suppression[] { /* lê JSON, [] se ausente */ }

export function applySuppressions(issues: HealthIssue[], suppressions: Suppression[]): {
  visible: HealthIssue[];
  suppressed: Array<HealthIssue & { suppressionReason: string }>;
} {
  const bySuppressed = new Map(suppressions.map((s) => [s.fingerprint, s]));
  const visible: HealthIssue[] = [];
  const suppressed: Array<HealthIssue & { suppressionReason: string }> = [];
  for (const issue of issues) {
    const fp = issueFingerprint(issue);
    const match = bySuppressed.get(fp);
    if (match) suppressed.push({ ...issue, suppressionReason: match.reason });
    else visible.push(issue);
  }
  return { visible, suppressed };
}
```

Integrar em `health-auditor.ts` logo após `deduplicateIssues`, antes de `calculateHealthScore`
(issues suprimidos não contam pro score, mas ficam no `HealthAuditReport.suppressedIssues` para
transparência).

**Verificação:** Suprimir um issue manualmente no JSON, rodar `shiten audit --no-cache`, confirmar que ele não aparece na lista principal mas aparece em `report.suppressedIssues`.

### Passo 6: Comando `shiten audit suppress` e flags de CLI
**Ficheiro:** `src/commands/audit.ts`
**Ação:**
- Novo subcomando `audit suppress <fingerprint> --reason "<texto>"` que grava em `audit-suppressions.json`.
- Nova flag `--min-confidence <0..1>` no comando `audit` (filtra `report.issues` antes de exibir, mas mantém no JSON completo com `--json` para não perder dado).
- Nova flag `--show-suppressed` para listar o que está suprimido e por quê (evita "esquecimento" de supressões antigas).

**Verificação:** `shiten audit --min-confidence 0.7` mostra menos issues que sem a flag, em projeto com issues de baixa confiança conhecidos.

## Decisões de Design

| # | Decisão | Alternativa rejeitada | Racional |
|---|---------|----------------------|----------|
| 1 | `confidence` opcional, default 1.0 | Campo obrigatório em todos os 150 detectors de uma vez | Migração incremental, evita PR gigante e regressão em massa |
| 2 | Supressão por fingerprint (hash de type+location+description) | Supressão por ID incremental | Fingerprint é estável entre execuções sem precisar persistir contador global |
| 3 | Issues suprimidos ficam visíveis via `--show-suppressed`, não somem de vez | Supressão silenciosa (like `.eslintignore`) | Evita que o time esqueça por que algo foi suprimido; alinhado ao princípio de auditabilidade do próprio projeto (governance/) |
| 4 | Score pondera por confiança multiplicativamente, preservando fórmula `sqrt` por severidade | Reescrever fórmula do zero | Minimiza risco de quebrar histórico de scores já salvos em `reports/` |

## Riscos

| # | Risco | Impacto | Mitigação |
|---|-------|---------|-----------|
| 1 | Mudança na fórmula do `healthScore` quebra comparabilidade com relatórios históricos | Médio | Validar contra `shitenno-go/reports/health-*.json` existentes antes de merge; se divergência > 5 pontos, ajustar fator de ponderação |
| 2 | Calibração de confiança inicial é subjetiva (chute do agente) | Médio | Tratar valores do Passo 2 como ponto de partida; abrir plano de follow-up para calibrar com dados reais (taxa de FP observada) depois de 2-3 semanas de uso |
| 3 | `audit-suppressions.json` cresce sem limpeza e mascara regressões reais | Baixo | `detectStaleBuffer`-like check futuro: alertar se uma supressão tem >90 dias sem revisão (plano separado) |
| 4 | Subcomando `audit suppress` sem validação de fingerprint pode suprimir o issue errado | Baixo | Exigir que `--reason` seja obrigatório e logar fingerprint completo (10 chars) + `location` no confirm antes de gravar |

---

## Próximos planos sugeridos (não incluídos aqui, para não inflar escopo)

- **PLAN-AUDIT-DETECTORS-2**: novos detectors (qualidade de teste, breaking change de API pública, custo/cloud).
- **PLAN-AUDIT-ADAPTIVE**: thresholds adaptativos por percentil do próprio projeto (`COMPLEXITY_WARNING_THRESHOLD` fixo → calibrado).
- **PLAN-AUDIT-UX**: `--explain <fingerprint>`, diff aplicável via `suggestion-engine`, comparação de tendência entre execuções (usa `history/snapshots`, hoje só placeholder).
