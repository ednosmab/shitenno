---
category: reference
lifecycle: Historical
---

# Plano: Production Readiness — shitenno-cli

**Data:** 2026-06-27
**Objetivo:** Cobrir os gaps restantes para o shugo ser um sistema production-ready.
**Escopo:** 3 fases leves, ~2-3 horas de trabalho.

---

## Gap Analysis (resumo da auditoria)

| Item | Estado Atual | Ação |
|------|-------------|------|
| Catch blocks vazios | 0 (todos tratados) | Nenhuma |
| JSDoc em exports | 6 funções públicas sem doc | Adicionar |
| `test:coverage` script | Ausente | Adicionar |
| `.npmrc` | Ausente | Opcional (npm publish funciona sem) |
| Publish dry-run test | Não existe | Adicionar ao CI |
| Edge cases (1000+ files) | Não testado | Adicionar benchmark |

---

## Fase 1 — JSDoc nos Exports Públicos (30 min)

Adicionar JSDoc às 6 funções exportadas que faltam. Cada uma recebe:
- Descrição em 1 linha
- `@param` para cada parâmetro
- `@returns` com o tipo de retorno
- `@example` quando aplicável

### 1.1 `src/analyser.ts:23` — `analyseProject`

```typescript
/**
 * Analisa a estrutura de um projeto e detecta stack tecnológico.
 *
 * @param projectRoot - Diretório raiz do projeto
 * @returns Análise com contagem de packages, apps, files, dependencies
 *
 * @example
 * ```ts
 * const analysis = analyseProject("/path/to/project");
 * console.log(analysis.packageCount); // 3
 * ```
 */
export function analyseProject(projectRoot: string): ProjectAnalysis {
```

### 1.2 `src/scorer.ts:130` — `calculateComplexityScore`

```typescript
/**
 * Calcula o score de complexidade de um projeto (0-20).
 *
 * Combina métricas estáticas (packages, files, deps) com métricas
 * comportamentais (bug fixes, branches, commits) para gerar um
 * score composto com nível recomendado (junior/pleno/senior).
 *
 * @param projectRoot - Diretório raiz do projeto
 * @param shitennoDir - Caminho para shitenno/
 * @param analysis - Resultado de analyseProject()
 * @returns Relatório completo de complexidade
 */
export async function calculateComplexityScore(
  projectRoot: string,
  shitennoDir: string,
  analysis: ProjectAnalysis
): Promise<ComplexityReport> {
```

### 1.3 `src/scaffolder.ts:91` — `scaffoldShitenno`

```typescript
/**
 * Cria a estrutura inicial do Shitenno num projeto.
 *
 * Gera opencode.json, shitenno/, shitenno-profile/, skills,
 * scripts e docs baseado no nível do time.
 *
 * @param projectRoot - Diretório onde criar a estrutura
 * @param options - Opções de scaffolding (level, force, etc.)
 * @returns Resultado com arquivos criados
 */
export function scaffoldShitenno(
  projectRoot: string,
  options: ScaffolderOptions
): ScaffolderResult {
```

### 1.4 `src/health-auditor.ts:343` — `writeHealthReport`

```typescript
/**
 * Grava relatório de saúde em shitenno/reports/.
 *
 * @param shitennoDir - Diretório do shitenno
 * @param report - Relatório de auditoria de saúde
 * @returns Nome do ficheiro criado ou null se reports/ não existir
 */
export function writeHealthReport(
  shitennoDir: string,
  report: HealthAuditReport
): string | null {
```

### 1.5 `src/logger.ts:18` — `setLogLevel`

```typescript
/**
 * Define o nível de log global.
 *
 * Níveis: "debug" | "info" | "warn" | "error"
 * Default: "info"
 *
 * @param level - Nível de log a ativar
 */
export function setLogLevel(level: LogLevel): void {
```

### 1.6 `src/logger.ts:22` — `muteLogs`

```typescript
/**
 * Suprime todo output de log (útil em testes).
 * Equivalente a setLogLevel("error").
 */
export function muteLogs(): void {
```

---

## Fase 2 — Scripts e Config (20 min)

### 2.1 Adicionar `test:coverage` ao `package.json`

```json
// Adicionar em scripts:
"test:coverage": "vitest run --coverage"
```

### 2.2 Criar `.npmrc` (opcional)

```ini
# .npmrc
registry=https://registry.npmjs.org/
```

### 2.3 Adicionar dry-run publish ao CI

Adicionar step em `ci.yml`:

```yaml
  publish-check:
    name: Publish Check
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - run: npm publish --dry-run
        env:
          NODE_AUTH_TOKEN: fake
```

---

## Fase 3 — Edge Cases e Robustez (1-1.5 horas)

### 3.1 Benchmark com projeto grande

Criar `src/__tests__/edge-cases.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateComplexityScore } from "../scorer.js";
import { analyseProject } from "../analyser.js";

describe("Edge Cases", () => {
  it("handles empty project gracefully", async () => {
    const analysis = analyseProject("/tmp/empty-project");
    expect(analysis.sourceFileCount).toBe(0);
    expect(analysis.packageCount).toBe(0);
  });

  it("handles non-existent shugo dir", async () => {
    const analysis = analyseProject("/tmp/nonexistent");
    const report = await calculateComplexityScore(
      "/tmp/nonexistent",
      "/tmp/nonexistent/shitenno",
      analysis
    );
    expect(report.score).toBe(0);
    expect(report.areaScores).toHaveLength(0);
  });

  it("handles project with 1000+ files", async () => {
    // Create temp dir with 1000 files
    const tmpDir = "/tmp/shitenno-bulk-test";
    // ... setup ...
    const analysis = analyseProject(tmpDir);
    const start = Date.now();
    await calculateComplexityScore(tmpDir, `${tmpDir}/shitenno`, analysis);
    expect(Date.now() - start).toBeLessThan(5000); // <5s
  });
});
```

### 3.2 Validar publish readiness

Adicionar script `validate-publish`:

```json
"validate-publish": "npm run build && npm pack --dry-run && echo 'Ready to publish'"
```

---

## Checklist de Validação

Após implementação:

```bash
npm run typecheck       # Tipos OK
npm run build           # Build OK
npm test                # 278+ testes passam
npm run test:coverage   # Coverage roda (novo)
npm run validate-publish # Pack OK (novo)
```

---

## Ordem de Execução

```
Fase 1 (JSDoc)         ~30 min
  ├── 1.1-1.6 Adicionar JSDoc aos 6 exports
Fase 2 (Config)        ~20 min
  ├── 2.1 test:coverage script
  ├── 2.2 .npmrc
  └── 2.3 publish-check no CI
Fase 3 (Edge Cases)    ~1-1.5h
  ├── 3.1 Testes de edge cases
  └── 3.2 validate-publish script
```

**Esforço total:** ~2-3 horas
**Impacto:** Cobre os últimos gaps para production-readiness
