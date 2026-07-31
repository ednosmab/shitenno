# Plano — Correção MCP + Daemon (achados da validação ao vivo)

**Status:** Done
**Updated_at:** 2026-07-31T05:11:16.594Z
**Date:** 2026-07-30

**Base:** commit `92f000a32391d155034f7dac34b0efbd22bc73cf`. Os dois achados abaixo vieram de execução real — servidor MCP conversando por JSON-RPC de verdade sobre stdio, daemon consultado direto via socket Unix — não de leitura de código isolada.

---

# P0 — MCP: stdout contaminado quebra o protocolo com qualquer cliente real

**Evidência, reproduzida 100% das vezes, com e sem daemon rodando:** antes da primeira resposta JSON-RPC, o stdout recebe texto solto (banner de Quick Board). Qualquer cliente MCP real (Claude Desktop, Claude Code) que espera só JSON-RPC no stdio quebra nisso.

**Causa raiz — já existe o mecanismo certo pra isso, só não é usado pro comando `mcp`:**

```ts
// bin/shugo.ts:284-286 — código atual
.hook("preAction", () => {
  const globalOpts = cmd.opts();
  if (globalOpts.quiet) process.env.SHITENNO_QUIET = "1";
  if (globalOpts.color === false) chalk.level = 0;
  // Set global JSON mode early — suppresses output() for all modules
  setGlobalJsonMode(process.argv.includes("--json"));
});
```

`setGlobalJsonMode()` (`src/output.ts`) já existe, documentado exatamente pra este cenário — *"prevent human-readable text from polluting JSON streams"*. Mas só é ativado quando a flag `--json` está presente. `shugo mcp` não passa `--json` (é stdio JSON-RPC, não um comando com flag de saída), então o modo fica desligado e qualquer `output()` chamado durante o bootstrap "pesado" compartilhado (`mcp` está em `HEAVY_COMMANDS`, mesmo caminho de `doctor`/`status`/`audit`) vaza pro stdout.

**Correção — uma linha, no mesmo hook que já existe:**

```ts
// bin/shugo.ts:284-286
.hook("preAction", () => {
  const globalOpts = cmd.opts();
  if (globalOpts.quiet) process.env.SHITENNO_QUIET = "1";
  if (globalOpts.color === false) chalk.level = 0;
  // Set global JSON mode early — suppresses output() for all modules.
  // Também ativa pro comando `mcp`: stdio é protocolo JSON-RPC, texto solto quebra o cliente.
  const commandName = process.argv[2];
  setGlobalJsonMode(process.argv.includes("--json") || commandName === "mcp");
});
```

Usei `process.argv[2]` (nome do comando) em vez de `.includes("mcp")` pra não capturar falso positivo se `"mcp"` aparecer como valor de outra flag em outro comando.

**Teste de regressão — a forma mais confiável de travar isso é testar o processo de verdade, não só a função isolada:**

```ts
// src/__tests__/mcp-stdio-protocol.test.ts (novo)
import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import { join } from "node:path";

describe("mcp stdio protocol", () => {
  it("stdout deve conter só JSON-RPC — nenhuma linha não-JSON antes da primeira resposta", async () => {
    const binPath = join(process.cwd(), "dist/bin/shugo.js");
    const proc = spawn("node", [binPath, "mcp"], { cwd: process.cwd() });

    let stdout = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });

    await new Promise((resolve) => setTimeout(resolve, 300));
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } } }) + "\n");
    await new Promise((resolve) => setTimeout(resolve, 500));

    proc.kill();

    const lines = stdout.split("\n").filter((l) => l.trim());
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow(); // toda linha não-vazia no stdout precisa ser JSON válido
    }
  }, 10_000);
});
```

Esse teste roda o binário de verdade (`dist/bin/shugo.js`), então precisa de `npm run build` antes de `npm run test` pra esse arquivo específico não falhar por `MODULE_NOT_FOUND` — mesmo cuidado que já vimos com os testes de `cli-integration`.

---

# P1 — `risk-map.ts`: arquivos de teste contados como "sem teste" (self-referencial)

**Evidência, achada consultando o daemon ao vivo via `query_briefing`:**

```json
"areasWithoutTests": [
  "No test file for src/__tests__/action-engine.test.ts",
  "No test file for src/__tests__/advanced-infrastructure.test.ts", ...
]
```

**Causa raiz:** `getSourceFiles()` varre `.ts`/`.tsx`/`.js`/`.jsx` recursivamente sem excluir `__tests__/` nem `*.test.ts`/`*.spec.ts`. Esses arquivos entram no mesmo pool que `evaluateFileRisk()` avalia, e `hasTestFile()` tenta achar `action-engine.test.test.ts` (não existe, ninguém escreve teste de teste) — conclui "sem teste" pra um arquivo que já É o teste.

```ts
// src/risk-map.ts — evaluateFileRisk(), código atual
if (!hasTestFile(file)) {
  factors.push({ type: "no-tests", description: `No test file for ${relPath}`, weight: 0.3 });
  score += 15;
}
```

**Correção:**

```ts
// src/risk-map.ts — evaluateFileRisk()
function isTestFile(filePath: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath) || filePath.includes(`${sep}__tests__${sep}`) || filePath.includes("__tests__/");
}

function evaluateFileRisk(
  file: string,
  projectRoot: string,
  churnData: Map<string, number>
): { factors: RiskFactor[]; score: number } {
  const relPath = relative(projectRoot, file);
  const factors: RiskFactor[] = [];
  let score = 0;

  if (!isTestFile(file) && !hasTestFile(file)) {
    factors.push({ type: "no-tests", description: `No test file for ${relPath}`, weight: 0.3 });
    score += 15;
  }
  // ...resto igual
}
```

(Import `sep` de `node:path` se ainda não estiver importado no arquivo; o check duplo com `/` e `sep` é só para não depender de rodar em Windows vs. Unix.)

**Impacto do fix, pra saber se funcionou:** isso afeta `getRiskMap` do MCP, `shugo status`, `shugo briefing` — qualquer lugar que reporte "áreas sem teste" hoje conta os próprios arquivos de teste como não testados, inflando o número. Depois do fix, `areasWithoutTests` deve cair pra só arquivos de produção sem teste correspondente — nesse projeto, provavelmente próximo de zero na área `src/__tests__/` (óbvio, já que ela é toda teste) e deve manter só os casos reais em `src/*.ts` fora dessa pasta.

**Teste de regressão:**

```ts
// src/__tests__/risk-map-test-detection.test.ts (novo)
import { describe, it, expect } from "vitest";
import { generateRiskMap } from "../risk-map.js";

describe("generateRiskMap — detecção de teste ausente", () => {
  it("NÃO deve sinalizar um arquivo *.test.ts como 'sem teste'", () => {
    // usar um projectRoot fixture com src/__tests__/example.test.ts e nenhum outro arquivo
    const riskMap = generateRiskMap(FIXTURE_ROOT, FIXTURE_ROOT);
    const noTestFactors = riskMap.areas.flatMap((a) => a.factors).filter((f) => f.type === "no-tests");
    const flaggedTestFiles = noTestFactors.filter((f) => f.description.includes(".test.ts") || f.description.includes(".spec.ts"));
    expect(flaggedTestFiles).toHaveLength(0);
  });
});
```

(Ajustar `FIXTURE_ROOT` pro padrão de fixture já usado nos outros testes de `risk-map` do projeto, se existir um `__fixtures__/` — caso não exista, criar um diretório mínimo em `os.tmpdir()` dentro do próprio teste.)

---

# Ordem de execução

1. **P0 (MCP)** — uma linha, maior impacto (quebra a integração primária com agentes reais). Fazer primeiro, sozinho, é rápido de validar: depois do fix, rodar o mesmo teste manual — `node dist/bin/shugo.js mcp` com uma requisição `initialize` via stdin — e confirmar que a primeira linha do stdout já é `{"result":...`, sem nada antes.
2. **P1 (risk-map)** — independente do P0, pode ir na mesma PR ou separado. Depois de aplicar, rodar `shugo status` ou consultar o daemon (`query_briefing`) de novo e conferir que `areasWithoutTests` não lista mais nada dentro de `__tests__/`.

Ambos são pequenos — dá pra fazer os dois numa sessão só.
