---
category: engineering
lifecycle: Active
---

# ADR-009: Núcleo Único de Execução para Engines com Autoridade de Efeito Colateral

**Status:** Proposed
**Date:** 2026-07-16
**Deciders:** Tech Lead (via auditoria de código assistida)

## Context

O sistema tem 23 módulos com "engine" no nome. A maioria (`trend-engine`, `goal-engine`, `capability-engine`, `inference-engine`, `doc-engine`, `plan-engine`, `markdown-plan-engine`, `knowledge-debt/engine`, etc.) são bibliotecas de cálculo — computam e devolvem dado, sem autoridade de causar efeito colateral sozinhas. Não precisam de governança porque não têm o que arbitrar.

Um subconjunto pequeno, porém, tem autoridade real de mutar estado ou executar comandos, e essa autoridade está fragmentada em quatro implementações independentes, sem overlap de código entre si:

| Módulo | Capacidade real | Lacuna |
|---|---|---|
| `action-engine.ts` (CLI, `shugo act`) | Registro de execução real (hash, `ExecutionRecord`, rollback via `FileExecutionRepository`) | Os executores (`ScriptExecutor`, `CreateReminderExecutor`) são **stubs** — `run_script` tem comentário `"In real implementation, would exec the script"` e nunca executa nada de fato |
| `rule-engine/actions.ts` (daemon) | Execução real (`execSync` com allowlist via `isScriptAllowed`, mutação real de `context_buffer.yaml`) | Nenhum registro de execução — falha vira uma linha de log, sem rastro auditável |
| `audit/autofix-engine.ts` | Execução real com verificação e rollback automático (backup + `execSync` de verificação + revert se falhar, threshold de confiança 0.85) | Terceira implementação independente de "aplicar mudança e verificar", sem relação com as outras duas |
| `policy-engine.ts` | Autoridade de **veto** (`mode: "enforce"` bloqueia; `mode: "advisory"` avisa) | Não é consultado por nenhum dos três executores acima antes de agir |

Isso não é só duplicação estética. É uma lacuna de confiabilidade concreta: dependendo de qual dos três caminhos de execução dispara uma ação, o usuário tem execução real sem auditoria, execução simulada com auditoria de algo que não aconteceu, ou uma terceira lógica de verificação que as outras duas não conhecem — e nenhuma delas consulta a camada de política antes de agir.

## Decision

Consolidar as três engines executoras (`action-engine`, `rule-engine/actions`, `autofix-engine`) em um núcleo único de execução (`src/decision-core/`), com `policy-engine` atuando como gate de veto pré-execução, não como um quarto executor.

```
src/decision-core/
├── tiers.ts            ← ACTION_TIER (ADR-008)
├── precedence.ts        ← claim de recurso (ADR-008)
├── policy-gate.ts        ← consulta PolicyEngine.evaluate() antes de qualquer execução
├── executors/
│   ├── types.ts
│   ├── run-script.ts       ← real, migrado de rule-engine/actions.ts
│   ├── create-reminder.ts   ← real, migrado de rule-engine/actions.ts
│   ├── apply-autofix.ts     ← real, migrado de audit/autofix-engine.ts (mantém backup+revert)
│   └── ... (demais tipos de RuleAction)
├── execution-log.ts       ← ExecutionRecord + FileExecutionRepository, migrado de action-engine.ts
└── invoke.ts              ← ponto de entrada único, dois modos (autonomous | deliberate)
```

Regra de migração por módulo: manter a implementação que **já funciona de verdade** hoje (majoritariamente `rule-engine/actions.ts` para scripts/mutação de arquivo, `autofix-engine.ts` para correções verificadas de audit), envolvida pelo envelope de auditoria que já funciona (`action-engine.ts`), com uma checagem de política (`policy-engine.ts`) rodando antes de qualquer execução — não reescrever lógica que já é boa, só realocar e conectar.

```typescript
// decision-core/policy-gate.ts
export function checkPolicyGate(action: RuleAction, context: RuleContext, policyEngine: PolicyEngine): { allowed: boolean; reason?: string } {
  const evaluation = policyEngine.evaluate({ actionType: action.type, ...action.params });
  const enforced = evaluation.results.find((r) => r.violated && r.mode === "enforce");
  if (enforced) {
    return { allowed: false, reason: enforced.message };
  }
  return { allowed: true };
}
```

`invoke.ts` (já esboçado em conversa anterior) passa a chamar `checkPolicyGate` como primeiro passo, antes da checagem de tier/precedência do ADR-008.

## Consequences

### Positive

- `shugo act` passa a executar scripts de verdade (com allowlist de segurança), corrigindo um comportamento que hoje é apenas simulado — não é só refactor, é correção de bug real.
- Toda ação — venha do daemon ou do CLI — passa a ter registro de execução auditável e reversível, o que hoje só existia parcialmente e só do lado do CLI.
- Correções automáticas de audit (`autofix-engine`) passam a respeitar as mesmas políticas de veto que qualquer outra ação, em vez de rodar numa quarta lógica isolada.
- Reduz de quatro superfícies de manutenção para uma — bugs de segurança (ex.: escape do allowlist de scripts) só precisam ser corrigidos uma vez, não em até três lugares.

### Negative

- É um refactor com risco real de regressão em três módulos que hoje funcionam (ainda que incompletos) — exige suíte de testes de regressão robusta antes de remover o código antigo (ver critérios de aceite no plano de execução).
- `autofix-engine.ts` tem uma característica própria (threshold de confiança 0.85, verificação via `tsc --noEmit`) que não existe nos outros dois — a migração precisa preservar isso explicitamente, não generalizar de forma que perca essa garantia específica.
- Aumenta o acoplamento entre audit e execução de ações — antes eram sistemas independentes; depois de convergir, uma mudança no núcleo de execução pode, em tese, afetar autofix de audit também. Precisa de testes de isolamento para garantir que um não quebra o outro por engano.

## Alternatives Considered

### Option A: Manter os quatro módulos separados, só documentar quem faz o quê
- Pros: zero risco de regressão, esforço mínimo.
- Cons: não resolve a lacuna real (execução sem auditoria de um lado, auditoria de execução falsa do outro) — documentar um bug não é o mesmo que corrigi-lo.

### Option B: Fundir também `decision-engine.ts` e `proactive-engine.ts` no mesmo núcleo
- Pros: "um núcleo pra tudo", conceitualmente mais simples de explicar.
- Cons: rejeitado — essas duas engines são camada de **julgamento**, não de execução (ver ADR-008: avaliação de risco/recomendação deve continuar isolada por design, para não dar ao daemon autoridade de julgamento que o princípio de precedência humana nega a ele).

### Option C: Escolher um dos quatro módulos existentes como canônico e depreciar os outros três sem reestruturar
- Pros: menos código novo.
- Cons: nenhum dos quatro sozinho tem todas as propriedades necessárias (execução real + auditoria + verificação + veto de política) — escolher um significaria perder pelo menos uma dessas garantias.

## References

- `src/action-engine.ts`, `src/rule-engine/actions.ts`, `src/audit/autofix-engine.ts`, `src/policy-engine.ts`
- ADR-008-human-over-autonomous-precedence.md (tiers e mecanismo de claim, reaproveitados aqui)
- PLAN-2026-07-16-decision-core-convergence.md (versão inicial, dois executores)
- PLAN-2026-07-16-four-engine-execution-core.md (versão expandida, quatro engines, este ADR)
