# Camada Semântica — Classificação, Raciocínio e Dual Path

**Status:** Done
**Updated_at:** 2026-07-24T15:08:59.990Z
**Date:** 2026-07-23
**Author:** Shitenno System
**Tags:** semantic, proactive, dual-path, classification, reasoning

## Checklist

- [ ] Classifica dependências em package.json (pg → persistence, helmet → security)
- [ ] Classifica arquivos criados (migrations/ → persistence, src/auth/ → authentication)
- [ ] Classifica config changes (DATABASE_URL → persistence, JWT_SECRET → security)
- [ ] Confiança calculada corretamente (0-1)
- [ ] Evidências rastreadas (quais sinais geraram a classificação)
- [ ] Todos os testes passam
- [ ] Change Journal grava classificações em JSONL
- [ ] Journal filtra por domínio e janela temporal
- [ ] Pattern Matcher detecta architectural_shift (3+ sinais em 5 sessões)
- [ ] Pattern Matcher detecta scope_drift (2+ domínios novos)
- [ ] Padrões publicam evento `semantic.pattern_detected`
- [ ] Daemon integra journal + matcher
- [ ] Todos os testes passam
- [ ] Growth Profile persiste por projecto
- [ ] Dual Path mostra Path A (confortável) e Path B (desafiador)
- [ ] Escolha é registada no Growth Profile
- [ ] Sistema adapta nível de desafio baseado no histórico
- [ ] Comandos evolve/audit/status/detect mostram dual path
- [ ] Briefing inclui padrões semânticos detectados
- [ ] Todos os testes passam
- [ ] README.md actualizado com seção Semantic Layer
- [ ] docs/semantic/ criado com 8 arquivos
- [ ] Referências CLI actualizadas
- [ ] Eventos documentados
- [ ] Templates actualizados (AGENTS.md, WORKFLOW.md)
- [ ] Conceptual model actualizado
- [ ] Nenhuma referência quebrada
- [ ] Linguagem acessível e clara

## Visão

O sistema passa de **sintático** (conta eventos) para **semi-semântico** (classifica sinais, detecta padrões, apresenta dual path). O humano corrige, o sistema aprende.

## Princípios

1. **Conhecimento estruturado, não LLM** — classificação via regras e taxonomias, determinística e auditável
2. **Dual path como mecanismo de correção** — sistema classifica, humano confirma/corrige, sistema aprende
3. **Incremental** — Fase 1 útil sem Fase 2, Fase 2 sem Fase 3
4. **Reutilizar infra existente** — event bus, knowledge graph, audit dimensions, maturity profile

---

## Arquitectura Geral

```
Eventos brutos (76 tipos)
       │
       ▼
┌─────────────────────┐
│  Signal Classifier   │ ← Taxonomia semântica + regras de classificação
│  (classifica sinais) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Change Journal      │ ← Time-series de sinais classificados
│  (histórico semântico)│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Pattern Matcher     │ ← Janela temporal + thresholds + correlação
│  (detecta padrões)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Dual Path Presenter │ ← Path A (confortável) + Path B (desafiador)
│  (apresenta opções)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Growth Profile      │ ← Registra escolhas, adapta nível de desafio
│  (aprende com humano)│
└─────────────────────┘
```

---

## Fase 1 — Taxonomia Semântica + Signal Classifier

**Objetivo:** Classificar cada evento em categorias semânticas significativas.

### 1.1 Taxonomia Semântica (`src/semantic/taxonomy.ts`)

Domínios semânticos unificados que conectam subsistemas existentes:

```typescript
type SemanticDomain =
  | "persistence"    // db, migrations, connection strings
  | "authentication" // auth, tokens, sessions
  | "api"            // endpoints, contracts, routes
  | "security"       // secrets, vulnerabilities, compliance
  | "infrastructure" // deploy, CI/CD, containers
  | "frontend"       // UI, components, styles
  | "testing"        // tests, coverage, mocks
  | "documentation"  // docs, ADRs, guides
  | "governance"     // rules, workflows, policies
  | "data"           // schemas, models, migrations
  | "performance"    // caching, optimization, profiling
  | "observability"  // logging, monitoring, tracing
```

Cada domínio tem subcategorias e sinais associados:

```typescript
interface SemanticClassification {
  domain: SemanticDomain;
  subdomain: string;
  confidence: number;    // 0-1
  evidence: string[];    // sinais que justificam a classificação
  signals: Signal[];     // sinais brutos que geraram esta classificação
}
```

### 1.2 Regras de Classificação (`src/semantic/rules.ts`)

Mapeamento de sinais brutos a domínios:

```typescript
const CLASSIFICATION_RULES: ClassificationRule[] = [
  // Persistência
  { signal: "dependency.added", match: /pg|mysql|sqlite|typeorm|prisma|drizzle/i, domain: "persistence", subdomain: "database-driver" },
  { signal: "file.created", match: /migrations?\//i, domain: "persistence", subdomain: "schema-migration" },
  { signal: "config.changed", match: /DATABASE_URL|DB_HOST|CONNECTION_STRING/i, domain: "persistence", subdomain: "connection-config" },
  { signal: "file.modified", match: /src\/db\/|src\/repositories\/|src\/models\//i, domain: "persistence", subdomain: "data-access" },

  // Autenticação
  { signal: "dependency.added", match: /passport|jsonwebtoken|bcrypt|oauth/i, domain: "authentication", subdomain: "auth-library" },
  { signal: "file.created", match: /src\/auth\/|src\/middleware\/auth/i, domain: "authentication", subdomain: "auth-middleware" },
  { signal: "config.changed", match: /JWT_SECRET|API_KEY|SECRET/i, domain: "security", subdomain: "secret-config" },

  // Segurança
  { signal: "dependency.added", match: /helmet|cors|rate-limit|csrf/i, domain: "security", subdomain: "security-library" },
  { signal: "file.created", match: /src\/security\/|.*\.test\.security\./i, domain: "security", subdomain: "security-test" },

  // Infraestrutura
  { signal: "dependency.added", match: /docker|kubernetes|terraform|aws-sdk/i, domain: "infrastructure", subdomain: "infra-tool" },
  { signal: "file.created", match: /Dockerfile|docker-compose|\.github\/workflows/i, domain: "infrastructure", subdomain: "deploy-config" },

  // API
  { signal: "file.created", match: /src\/routes\/|src\/controllers\/|src\/endpoints\//i, domain: "api", subdomain: "api-endpoint" },
  { signal: "file.created", match: /src\/contracts\/|.*\.schema\.ts/i, domain: "api", subdomain: "api-contract" },
];
```

### 1.3 Signal Classifier (`src/semantic/signal-classifier.ts`)

Motor de classificação que aplica regras:

```typescript
interface SignalClassifier {
  classify(event: EventEnvelope): SemanticClassification;
  classifyBatch(events: EventEnvelope[]): SemanticClassification[];
}

// Implementação:
// 1. Extrai metadados do evento (payload type, file paths, dependency names)
// 2. Aplica CLASSIFICATION_RULES em ordem de prioridade
// 3. Retorna classificação com confiança e evidências
// 4. Se nenhuma regra casar, classifica como "unknown"
```

### 1.4 Impacto no Event Bus

**Não modificar** o event bus existente. O classifier é um **consumer** que se subscreve a todos os 76 eventos e produz classificações semânticas.

Adicionar campo opcional de anotação semântica ao `EventEnvelope`:

```typescript
interface EventEnvelope<T = unknown> {
  type: ShitennoEventType;
  payload: T;
  timestamp: string;
  traceId: string;
  correlationId?: string;
  semantic?: SemanticClassification;  // NOVO — anotação opcional
}
```

### Arquivos

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/semantic/taxonomy.ts` | Tipos e taxonomia semântica |
| Criar | `src/semantic/rules.ts` | Regras de classificação |
| Criar | `src/semantic/signal-classifier.ts` | Motor de classificação |
| Criar | `src/semantic/index.ts` | Barrel export |
| Criar | `src/__tests__/semantic/signal-classifier.test.ts` | Testes |
| Modificar | `src/event-bus.ts` | Adicionar campo `semantic?` ao EventEnvelope |

### Critérios de Aceite

- [ ] Classifica dependências em package.json (pg → persistence, helmet → security)
- [ ] Classifica arquivos criados (migrations/ → persistence, src/auth/ → authentication)
- [ ] Classifica config changes (DATABASE_URL → persistence, JWT_SECRET → security)
- [ ] Confiança calculada corretamente (0-1)
- [ ] Evidências rastreadas (quais sinais geraram a classificação)
- [ ] Todos os testes passam

---

## Fase 2 — Change Journal + Pattern Matcher

**Objetivo:** Manter histórico de sinais classificados e detectar padrões temporais.

### 2.1 Change Journal (`src/semantic/change-journal.ts`)

Time-series de classificações semânticas:

```typescript
interface JournalEntry {
  id: string;
  timestamp: string;
  sessionId: string;
  classification: SemanticClassification;
  eventCount: number;
  files: string[];
}

interface ChangeJournal {
  entries: JournalEntry[];
  add(entry: JournalEntry): void;
  query(filter: JournalFilter): JournalEntry[];
  getWindow(domain: SemanticDomain, windowSessions: number): JournalEntry[];
}
```

Persistido em `.shitenno/governance/change-journal.jsonl`.

### 2.2 Pattern Matcher (`src/semantic/pattern-matcher.ts`)

Detecta padrões a partir do journal:

```typescript
interface SemanticPattern {
  id: string;
  type: PatternType;
  domain: SemanticDomain;
  signals: string[];
  confidence: number;
  windowSessions: number;
  detectedAt: string;
  suggestedActions: string[];
}

type PatternType =
  | "architectural_shift"    // mudança de infraestrutura dominante
  | "scope_drift"            // expansão além do domínio original
  | "security_degradation"   // acumulação de sinais de segurança
  | "tech_debt_accumulation" // crescente dívida técnica
  | "capability_gap"         // capacidade necessária mas ausente
  | "maturity_regression";   // queda de maturidade

// Regras de detecção:
const PATTERN_RULES: PatternRule[] = [
  {
    type: "architectural_shift",
    condition: (journal, domain) => {
      const entries = journal.getWindow(domain, 5);
      return entries.length >= 3; // 3+ sinais em 5 sessões
    },
    confidence: (entries) => Math.min(entries.length / 5, 1),
  },
  {
    type: "scope_drift",
    condition: (journal, fingerprint) => {
      const currentModules = new Set(journal.entries.map(e => e.classification.domain));
      const originalModules = new Set(fingerprint.stack.map(/* mapear para domains */));
      const newModules = [...currentModules].filter(m => !originalModules.has(m));
      return newModules.length >= 2; // 2+ domínios novos
    },
  },
  // ... mais regras
];
```

### 2.3 Integração com Daemon

- Change Journal grava a cada `session.end` e `engineering_state.consolidated`
- Pattern Matcher roda no timer de consolidação (15min)
- Padrões detectados publicam `semantic.pattern_detected` no event bus

### Arquivos

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/semantic/change-journal.ts` | Journal de sinais classificados |
| Criar | `src/semantic/pattern-matcher.ts` | Detecção de padrões |
| Criar | `src/semantic/pattern-rules.ts` | Regras de detecção |
| Criar | `src/__tests__/semantic/change-journal.test.ts` | Testes |
| Criar | `src/__tests__/semantic/pattern-matcher.test.ts` | Testes |
| Modificar | `src/event-bus.ts` | Adicionar `semantic.pattern_detected` ao ShitennoEventType |
| Modificar | `src/advanced-infrastructure.ts` | Registrar novo evento |
| Modificar | `src/daemon/index.ts` | Integrar journal + matcher ao timer de consolidação |

### Critérios de Aceite

- [ ] Change Journal grava classificações em JSONL
- [ ] Journal filtra por domínio e janela temporal
- [ ] Pattern Matcher detecta architectural_shift (3+ sinais em 5 sessões)
- [ ] Pattern Matcher detecta scope_drift (2+ domínios novos)
- [ ] Padrões publicam evento `semantic.pattern_detected`
- [ ] Daemon integra journal + matcher
- [ ] Todos os testes passam

---

## Fase 3 — Dual Path + Growth Profile

**Objetivo:** Apresentar dois caminhos para cada padrão detectado e aprender com as escolhas.

### 3.1 Growth Profile (`src/semantic/growth-profile.ts`)

```typescript
interface GrowthProfile {
  projectId: string;
  createdAt: string;
  updatedAt: string;
  growthCapacity: number;    // 0-1, calculado
  challengeLevel: number;    // 0-1, ajustado
  pathHistory: PathChoice[];
  patterns: GrowthPattern[];
}

interface PathChoice {
  id: string;
  timestamp: string;
  patternType: PatternType;
  pathChosen: "comfortable" | "challenging";
  domain: SemanticDomain;
}

interface GrowthPattern {
  type: "prefers_comfort" | "prefers_growth" | "balanced" | "sporadic_growth";
  confidence: number;
  description: string;
}
```

Persistido em `.shitenno/governance/growth-profile.json`.

### 3.2 Dual Path Presenter (`src/semantic/dual-path-presenter.ts`)

```typescript
interface DualPathPresentation {
  pattern: SemanticPattern;
  pathA: {
    label: "Confortável";
    description: string;
    action: string;
    effort: "none" | "low" | "medium";
  };
  pathB: {
    label: "Desafiador";
    description: string;
    action: string;
    effort: "medium" | "high";
    growthBenefit: string;
  };
}

// Exemplo de output:
// 📋 Padrão Detectado: Mudança Arquitetural (persistence)
// Sinais: pg adicionado, migrations/ criado, DATABASE_URL configurado
//
// Path A (Confortável): Registrar para revisão numa sessão futura
// Path B (Desafiador): Criar ADR documentando a migração de persistência agora
//
// Escolha: [A] ou [B]?
```

### 3.3 Integração com Comandos

- `shugo evolve` — mostra dual path para cada recomendação
- `shugo audit` — mostra dual path para achados de saúde
- `shugo status` — mostra dual path para estado actual
- `shugo detect` — mostra dual path para padrões detectados

### 3.4 Feedback Loop

Quando o utilizador escolhe um caminho:
1. Registra no Growth Profile
2. Recalcula growth capacity e challenge level
3. Ajusta nível de desafio para futuros reports
4. Se escolheu "confortável" 5+ vezes seguidas → sistema reduz desafio
5. Se escolheu "desafiador" 5+ vezes seguidas → sistema aumenta desafio

### Arquivos

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/semantic/growth-profile.ts` | Perfil de crescimento |
| Criar | `src/semantic/dual-path-presenter.ts` | Apresentador de dual path |
| Criar | `src/__tests__/semantic/growth-profile.test.ts` | Testes |
| Criar | `src/__tests__/semantic/dual-path-presenter.test.ts` | Testes |
| Modificar | `src/commands/evolve.ts` | Mostrar dual path |
| Modificar | `src/commands/audit.ts` | Mostrar dual path |
| Modificar | `src/commands/status.ts` | Mostrar dual path |
| Modificar | `src/commands/detect.ts` | Mostrar dual path |
| Modificar | `src/briefing.ts` | Incluir padrões semânticos no briefing |

### Critérios de Aceite

- [ ] Growth Profile persiste por projecto
- [ ] Dual Path mostra Path A (confortável) e Path B (desafiador)
- [ ] Escolha é registada no Growth Profile
- [ ] Sistema adapta nível de desafio baseado no histórico
- [ ] Comandos evolve/audit/status/detect mostram dual path
- [ ] Briefing inclui padrões semânticos detectados
- [ ] Todos os testes passam

---

## Fase 4 — Reasoning Engine + Cross-System Correlation

**Objetivo:** Raciocínio semântico que conecta sinais de múltiplos subsistemas.

### 4.1 Semantic Reasoner (`src/semantic/reasoner.ts`)

```typescript
interface SemanticInsight {
  id: string;
  type: InsightType;
  domains: SemanticDomain[];
  description: string;
  confidence: number;
  evidence: Evidence[];
  suggestedActions: string[];
  priority: "urgent" | "high" | "medium" | "low";
}

type InsightType =
  | "architecture_evolution"    // persistence + infrastructure changing together
  | "security_posture_change"   // security signals + auth changes
  | "scope_expansion"           // new domains appearing
  | "maturity_mismatch"         // capabilities vs actual code patterns
  | "debt_accumulation"         // health declining + patterns detected
  | "governance_gap";           // decisions made without documentation
```

### 4.2 Cross-System Correlation

Conecta sinais de:
- Event bus (76 tipos)
- Risk map (fatores de risco)
- Maturity profile (capacidades)
- Knowledge graph (artefatos e relações)
- Audit dimensions (120+ mapeamentos)

### Arquivos

| Ação | Arquivo | Descrição |
|------|---------|-----------|
| Criar | `src/semantic/reasoner.ts` | Motor de raciocínio |
| Criar | `src/semantic/correlator.ts` | Correlação cross-system |
| Criar | `src/__tests__/semantic/reasoner.test.ts` | Testes |
| Criar | `src/__tests__/semantic/correlator.test.ts` | Testes |

---

## Ordem de Implementação

| Fase | Escopo | Dependências | Esforço |
|------|--------|-------------|---------|
| **1** | Taxonomia + Signal Classifier | Nenhuma | 2-3 dias |
| **2** | Change Journal + Pattern Matcher | Fase 1 | 2-3 dias |
| **3** | Dual Path + Growth Profile | Fase 2 | 2-3 dias |
| **4** | Reasoner + Correlation | Fase 1-3 | 3-4 dias |
| **5** | Documentação Completa | Fases 1-4 | 2-3 dias |

**Total estimado:** 11-16 dias

## Infraestrutura Existente Reutilizada

| Componente | Reuso |
|---|---|
| Event Bus (76 eventos tipados) | Consumer que se subscreve |
| Audit Dimensions (120+ mapeamentos) | Base para taxonomia |
| Knowledge Graph (14 tipos de artefatos) | backbone semântico |
| Capability System (9 capacidades) | Classificação de maturidade |
| Maturity Profile (7 dimensões) | Sinais de evolução |
| Risk Map (fatores tipados) | Sinais de risco |
| Proactive Engine (triggers) | Padrão de event→action |
| Decision Engine (evaluators) | Padrão de weighted scoring |

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Falsos positivos na classificação | Dual path permite correção humana |
| Performance do journal (muitos dados) | Rotação + consolidação periódica |
| Complexidade demais | Fase 1 já é útil isoladamente |
| Regras de classificação ficam desactualizadas | Growth Profile adapta pesos |

---

## Fase 5 — Documentação Completa

**Objetivo:** Atualizar toda a documentação do sistema com a nova capacidade semântica.

### Princípios

1. **Documentação é produto** — não é overhead, é parte da entrega
2. **Atualizar tudo** — README, guides, comandos, referências, exemplos
3. **Explicar o "porquê"** — não só o "o que", mas o "por que existe" e "como funciona"
4. **Linguagem acessível** — explicar para quem não leu o código

### Documentos a Actualizar

| Documento | O que atualizar |
|---|---|
| **README.md** | Nova seção "Semantic Layer", comandos actualizados, diagrama de arquitectura |
| **docs/CONCEPTUAL_MODEL.md** | Novo conceito "Semântica" no ciclo de vida do conhecimento |
| **docs/Shitenno_GUIDE.md** | Secção sobre classificação semântica, dual path, growth profile |
| **docs/KNOWLEDGE_LIFECYCLE.md** | Como os sinais se transformam em conhecimento semântico |
| **docs/reference/cli.md** | Comandos actualizados (evolve, audit, status, detect) |
| **docs/reference/events.md** | Novos eventos (semantic.pattern_detected, etc.) |
| **docs/reference/configuration.md** | Configuração da taxonomia semântica |
| **docs/capabilities.md** | Nova capacidade "Semantic" no mapeamento |
| **docs/INDEX.md** | Referências à nova documentação |
| **docs/architecture/validation-matrix.md** | Novos componentes na matriz |
| **AGENTS.md (template)** | Regras sobre classificação semântica e dual path |
| **WORKFLOW.md (template)** | Integração do semantic layer no fluxo de sessão |
| **docs/evolution/domain/07-USE-CASES.md** | Casos de uso do semantic layer |

### Documentos a Criar

| Documento | Propósito |
|---|---|
| **docs/semantic/README.md** | Visão geral da camada semântica |
| **docs/semantic/taxonomy.md** | Referência completa da taxonomia semântica |
| **docs/semantic/classification.md** | Como a classificação funciona |
| **docs/semantic/patterns.md** | Padrões detectáveis e suas regras |
| **docs/semantic/dual-path.md** | O conceito de dual path e como o sistema aprende |
| **docs/semantic/growth-profile.md** | Perfil de crescimento e adaptação |
| **docs/semantic/configuration.md** | Como personalizar a taxonomia |
| **docs/semantic/architecture.md** | Diagramas e decisão arquitectural |

### Estrutura do README (seção Semantic Layer)

```markdown
## Semantic Layer

O Shitenno classifica eventos em categorias semânticas significativas
(persistence, security, auth, etc.) e detecta padrões ao longo do tempo.

### Como funciona

1. Eventos brutos → Signal Classifier → classifica em domínios semânticos
2. Classificações → Change Journal → histórico temporal
3. Journal → Pattern Matcher → detecta padrões (architectural shift, scope drift, etc.)
4. Padrões → Dual Path → apresenta Path A (confortável) + Path B (desafiador)
5. Escolha → Growth Profile → adapta nível de desafio

### Comandos

| Comando | O que faz |
|---------|-----------|
| `shugo semantic:classify` | Classifica um evento ou arquivo |
| `shugo semantic:patterns` | Mostra padrões detectados |
| `shugo semantic:growth` | Mostra perfil de crescimento |

### Configuração

A taxonomia semântica pode ser personalizada em
`.shitenno/governance/semantic-rules.yaml`.
```

### Ordem de Documentação

1. Criar `docs/semantic/` com todos os arquivos
2. Atualizar README.md
3. Atualizar docs de referência (cli, events, configuration)
4. Atualizar templates (AGENTS.md, WORKFLOW.md)
5. Atualizar conceptual model e knowledge lifecycle
6. Revisão final — verificar consistência

### Critérios de Aceite

- [ ] README.md actualizado com seção Semantic Layer
- [ ] docs/semantic/ criado com 8 arquivos
- [ ] Referências CLI actualizadas
- [ ] Eventos documentados
- [ ] Templates actualizados (AGENTS.md, WORKFLOW.md)
- [ ] Conceptual model actualizado
- [ ] Nenhuma referência quebrada
- [ ] Linguagem acessível e clara

---

## Perguntas em Aberto

1. O change journal deve ser JSONL (atual) ou SQLite para consultas complexas?
2. O dual path deve aparecer no briefing ou apenas nos comandos explícitos?
3. O reasoning engine deve ser contínuo (timer) ou sob demanda?
