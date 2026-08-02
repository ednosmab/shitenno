---
category: product
lifecycle: Active
---

# Semantic Taxonomy

Referência completa da taxonomia semântica do Shitenno.

## Domínios Semânticos

| Domínio | Label | Descrição | Risk Weight |
|---------|-------|-----------|-------------|
| `persistence` | Persistência | Banco de dados, migrations, ORM, connection strings | 0.9 |
| `authentication` | Autenticação | Auth, tokens, sessões, OAuth, JWT | 0.95 |
| `api` | API | Endpoints, contratos, middlewares, versionamento | 0.7 |
| `security` | Segurança | Segurança, vulnerabilities, compliance, secrets | 1.0 |
| `infrastructure` | Infraestrutura | Deploy, CI/CD, containers, cloud | 0.8 |
| `frontend` | Frontend | UI, componentes, estilos, state management | 0.5 |
| `testing` | Testes | Testes, coverage, mocks, e2e | 0.3 |
| `documentation` | Documentação | Docs, ADRs, guides, changelogs | 0.2 |
| `governance` | Governança | Regras, workflows, políticas, capacidades | 0.4 |
| `data` | Dados | Schemas, modelos, validação, transformação | 0.6 |
| `performance` | Performance | Caching, optimização, profiling, bundles | 0.5 |
| `observability` | Observabilidade | Logging, monitoring, tracing, métricas | 0.4 |

## Subdomínios

### Persistence
- `database-driver` — pg, mysql, sqlite, typeorm, prisma, drizzle
- `schema-migration` — migrations, schema changes
- `connection-config` — DATABASE_URL, DB_HOST, CONNECTION_STRING
- `data-access` — src/db/, src/repositories/, src/models/
- `orm` — ORM configuration and usage
- `cache-layer` — caching for persistence

### Authentication
- `auth-library` — passport, jsonwebtoken, bcrypt, oauth
- `auth-middleware` — src/auth/, src/middleware/auth
- `session-management` — session handling
- `token-handling` — JWT, token refresh
- `oauth` — OAuth flows

### API
- `api-endpoint` — src/routes/, src/controllers/
- `api-contract` — src/contracts/, schemas
- `api-middleware` — API middleware
- `api-versioning` — version management
- `graphql` — GraphQL endpoints
- `websocket` — WebSocket connections

### Security
- `security-library` — helmet, cors, rate-limit
- `security-test` — security tests
- `secret-config` — JWT_SECRET, API_KEY
- `vulnerability-scan` — vulnerability scanning
- `compliance` — compliance checks
- `encryption` — encryption/decryption

### Infrastructure
- `infra-tool` — docker, kubernetes, terraform
- `deploy-config` — Dockerfile, docker-compose
- `ci-cd` — .github/workflows, .gitlab-ci
- `container` — container configuration
- `cloud-service` — AWS, GCP, Azure
- `monitoring-setup` — monitoring configuration

### Frontend
- `ui-component` — React, Vue, Angular components
- `style-system` — CSS, SCSS, style modules
- `state-management` — Redux, Vuex, Zustand
- `routing` — routing configuration
- `animation` — animations and transitions
- `accessibility` — a11y improvements

### Testing
- `test-framework` — jest, vitest, mocha
- `test-file` — .test.ts, .spec.ts
- `mock` — mocking utilities
- `coverage-config` — coverage configuration
- `e2e-test` — end-to-end tests
- `snapshot` — snapshot tests

### Documentation
- `doc-file` — .md files, README
- `adr` — Architecture Decision Records
- `guide` — user/developer guides
- `api-doc` — API documentation
- `changelog` — changelog files
- `readme` — README files

### Governance
- `rule-file` — rule definitions
- `workflow-config` — workflow configuration
- `policy` — policy definitions
- `capability-config` — capability installation
- `maturity-config` — maturity configuration

### Data
- `schema` — schema definitions
- `model` — data models
- `migration` — data migrations
- `validation` — validation rules
- `transform` — data transformations
- `seed` — seed data

### Performance
- `caching` — Redis, memcached, LRU
- `optimization` — performance improvements
- `profiling` — profiling tools
- `lazy-loading` — lazy loading
- `bundle-optimization` — bundle size reduction

### Observability
- `logging` — winston, pino, bunyan
- `monitoring` — monitoring setup
- `tracing` — distributed tracing
- `metrics` — metrics collection
- `alerting` — alert configuration

## Tipos de Sinais

| Sinal | Descrição |
|-------|-----------|
| `dependency.added` | Nova dependência instalada |
| `dependency.removed` | Dependência removida |
| `file.created` | Novo ficheiro criado |
| `file.modified` | Ficheiro modificado |
| `file.deleted` | Ficheiro removido |
| `config.changed` | Configuração alterada |
| `test.created` | Teste criado |
| `test.passed` | Teste passou |
| `test.failed` | Teste falhou |
| `health.checked` | Health check executado |
| `health.degraded` | Saúde degradada |
| `git.branch_changed` | Branch alterada |
| `git.ref_updated` | Ref actualizada |
| `source.changed` | Código fonte alterado |
| `maturity.changed` | Maturidade alterada |
| `capability.installed` | Capacidade instalada |
| `knowledge_debt.detected` | Dívida de conhecimento detectada |
| `challenge.generated` | Challenge gerado |
| `plan.status_changed` | Estado do plano alterado |
| `adr.created` | ADR criado |
| `session.end` | Sessão terminada |
| `session.start` | Sessão iniciada |

## Estrutura de Classificação

```typescript
interface SemanticClassification {
  domain: SemanticDomain;      // Domínio primário
  subdomain: string;           // Subdomínio específico
  confidence: number;          // 0-1, confiança da classificação
  evidence: string[];          // Evidências que justificam
  signals: SignalType[];       // Sinais que contribuíram
  secondaryDomain?: SemanticDomain; // Domínio secundário (se ambíguo)
}
```
