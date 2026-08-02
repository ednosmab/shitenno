---
category: engineering
lifecycle: Active
---

# Enterprise Audit Plan V2 — Shitenno

> **Objetivo:** Nível `enterprise` com ~180 detectores (99 atuais + 22 Fase 1 + 59 novos)
> **Metodologia:** Domínios → Controles → Verificações → Evidências → Métricas → Pontuação
> **Backward Compat:** `full` mantém 99 detectores, `enterprise` é opt-in
> **Restrições:** Zero LLM, zero loops infinitos, decisão do usuário obrigatória

---

## Hierarquia de Níveis

```
quick (6)        →  Governança básica
standard (27)    →  + Engenharia
full (99)        →  + Segurança, git, código, arquitetura
enterprise (180) →  + Produto, dados, performance, resiliência, observabilidade, operação, compliance, custos, supply chain, sugestões
```

---

## Fase 1: Fundação (Detectores P1 — 4 módulos, ~22 detectores) ✅ CONCLUÍDA

### 1.1 product-detectors.ts — Estratégia, Visão e Requisitos

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectVisionAlignment` | #1 | Verifica se README/BACKLOG refletem a visão do produto | Analisa BRIEFING.md, BACKLOG.md, README.md para coerência |
| `detectRoadmapConsistency` | #1 | Detecta roadmap desatualizado ou contraditório | Verifica existência, datas, alinhamento com BACKLOG |
| `detectKPICoverage` | #1 | Verifica existência de métricas de produto | Procura por KPIs, métricas, dashboards documentados |
| `detectOrphanRequirements` | #2 | Requisitos sem rastreabilidade para código/teste | Cruza referências em docs com imports/exports |
| `detectRequirementTraceability` | #2 | Verifica traceabilidade requisito→código→teste | Analisa se cada feature doc tem correspondente no código |
| `detectAmbiguityPatterns` | #2 | Detecta linguagem ambígua em documentação | Procura por "deve talvez", "possivelmente", "quando possível" |

### 1.2 data-architecture-detectors.ts — Arquitetura de Dados e Persistência

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectSchemaConsistency` | #5 | Verifica consistência entre schemas doc e código | Compara schema definitions com type definitions |
| `detectDataOwnership` | #5 | Detecta dados sem ownership definido | Verifica se schemas têm campos de responsabilidade |
| `detectMissingMigrations` | #11 | Detecta alterações de schema sem migration | Compara migrations com alterações em schemas |
| `detectIndexCoverage` | #11 | Verifica se queries frequentes têm índices | Analisa queries no código vs índices definidos |

### 1.3 reliability-detectors.ts — Resiliência, Confiabilidade, Concorrência

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectCircuitBreaker` | #17 | Verifica uso de circuit breaker em chamadas externas | Procura por padrões de circuit breaker |
| `detectRetryPolicy` | #17 | Detecta chamadas externas sem retry | Analisa chamadas HTTP/DB sem retry |
| `detectTimeoutConfig` | #17 | Verifica se chamadas externas têm timeout | Procura por timeout em fetch, HTTP, DB |
| `detectHealthChecks` | #18 | Verifica existência de health check endpoints | Procura por /health, /ready, /alive |
| `detectGracefulDegradation` | #18 | Detecta falhas sem degradação graciosa | Analisa catch blocks para fallback patterns |
| `detectRaceConditions` | #19 | Detecta padrões suscetíveis a race conditions | Procura por shared state sem sincronização |
| `detectDeadlockRisk` | #19 | Identifica padrões de deadlock potencial | Analisa locks aninhados, transações concorrentes |

### 1.4 performance-detectors.ts — Performance e Escalabilidade

| Detector | Domínio | Descrição | Verificação |
|---|---|---|---|
| `detectNPlusOne` | #15 | Detecta padrões N+1 em queries | Procura por loops com queries internas |
| `detectMissingCaching` | #15 | Verifica se endpoints pesados têm cache | Analisa endpoints sem headers de cache |
| `detectStatefulServices` | #16 | Identifica serviços stateful que impedem scaling | Procura por estado em memória compartilhada |
| `detectMissingRateLimiting` | #16 | Verifica rate limiting em endpoints públicos | Procura por rate limit middleware |
| `detectMissingTimeouts` | #15 | Detecta chamadas HTTP sem timeout configurado | Verifica fetch/axios sem timeout |

---

## Fase 2: Observabilidade e Operação (Detectores P1/P2 — 2 módulos, ~16 detectores) 📋 PLANEADA

### 2.1 observability-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectMissingTracing` | `missing_tracing` | Procura por padrões `trace`, `span`, `opentelemetry`, `jaeger` em código. Se ausente → issue |
| `detectLogStructure` | `unstructured_logs` | Verifica se logs usam `console.log` puro vs `winston`/`pino`/`bunyan` estruturado |
| `detectAlertCoverage` | `missing_alerts` | Verifica se existe config de alertas (prometheus rules, grafana alerts) |
| `detectMetricEndpoints` | `missing_metrics` | Procura por `/metrics`, `prometheus`, `collectDefaultMetrics` |
| `detectMissingDashboard` | `missing_dashboard` | Verifica existência de arquivos de dashboard (grafana JSON, etc.) |
| `detectLogRetention` | `missing_log_retention` | Verifica política de retenção de logs em configs |
| `detectDistributedLogging` | `missing_correlation_id` | Procura por `correlationId`, `requestId`, `traceId` em logs |
| `detectSLODefinitions` | `missing_slo` | Verifica existência de SLOs/SLIs documentados |

### 2.2 operations-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectPipelineGaps` | `incomplete_pipeline` | Verifica CI/CD: `.github/workflows`, `.gitlab-ci.yml`, `Jenkinsfile` |
| `detectRollbackCapability` | `missing_rollback` | Procura por scripts de rollback, versionamento de deploys |
| `detectMissingRunbooks` | `missing_runbooks` | Verifica pasta `runbooks/` ou documentação operacional |
| `detectMonitoringGaps` | `missing_monitoring` | Verifica config de monitoring (datadog, newrelic, prometheus) |
| `detectIncidentResponse` | `missing_incident_plan` | Verifica existência de plano de resposta a incidentes |
| `detectDisasterRecovery` | `missing_dr_plan` | Verifica documentação de disaster recovery |
| `detectCapacityPlanning` | `missing_capacity_plan` | Verifica documentação de capacidade e scaling |
| `detectChangeManagement` | `missing_change_mgmt` | Verifica processo de change management documentado |

---

## Fase 3: Compliance e Segurança Avançada (Detectores P2 — 2 módulos, ~18 detectores) 📋 PLANEADA

### 3.1 compliance-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectOWASPTop10` | `owasp_gap` | Mapeia issues existentes para categorias OWASP Top 10 2025 via lookup table |
| `detectCWEMapping` | `cwe_gap` | Associa `HealthIssue.type` a IDs CWE conhecidos (HashMap estático) |
| `detectSOC2Controls` | `soc2_gap` | Verifica controles SOC2: acesso, criptografia, logging, monitoring |
| `detectNISTAlignment` | `nist_gap` | Mapeia para NIST SP 800-53: AC, AU, CA, CM, IA, RA, SC |
| `detectLGPDCompliance` | `lgpd_gap` | Verifica elementos LGPD: consentimento, retenção, direitos do titular |
| `detectDataRetention` | `missing_retention_policy` | Verifica políticas de retenção de dados documentadas |
| `detectConsentTracking` | `missing_consent` | Procura padrões de consent management no código |
| `detectSecretsInConfig` | `config_secrets` | Verifica arquivos de config por padrões de secrets |
| `detectEncryptionAtRest` | `missing_encryption` | Verifica uso de criptografia em dados sensíveis |
| `detectAccessControls` | `weak_access_controls` | Verifica RBAC, middleware de autorização |
| `detectAuditLogging` | `missing_audit_log` | Verifica logging de ações sensíveis (create, delete, update) |
| `detectComplianceReport` | `missing_compliance_report` | Verifica relatórios de compliance existentes |

### 3.2 security-advanced-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectSBOMCoverage` | `missing_sbom` | Verifica se SBOM existe e cobre dependências |
| `detectDependencyProvenance` | `unverified_provenance` | Verifica assinaturas de pacotes npm |
| `detectTyposquatting` | `typosquatting_risk` | Verifica nomes similares a pacotes populares (distância de edição) |
| `detectLicenseConflicts` | `license_conflict` | Mapeia licenças proibidas (GPL em projetos proprietários) |
| `detectTransitiveVulns` | `transitive_vuln` | Analisa dependências transitivas para CVEs conhecidos |
| `detectMalwarePatterns` | `malware_pattern` | Procura padrões suspeitos em package.json |

---

## Fase 4: Quantificação de Dívida Técnica (Detectores P2 — 1 módulo, ~8 detectores) 📋 PLANEADA

### 4.1 tech-debt-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectTechDebtCost` | `tech_debt_cost` | Calcula: `Σ(severity × hours × developerCost)` baseado em issues |
| `detectTDR` | `high_tdr` | Technical Debt Ratio: `(costToFix / projectValue) × 100` |
| `detectRemediationEffort` | `high_remediation_effort` | Estima horas por categoria de issue (tabela fixa) |
| `detectDebtTrend` | `debt_increasing` | Compara issues entre snapshots de auditoria |
| `detectHotspotFiles` | `debt_hotspot` | Arquivos com > 5 issues = hotspot de dívida |
| `detectDebtByDomain` | `debt_domain_imbalance` | Distribuição de dívida por domínio (desbalanceada = risco) |
| `detectROIRefactoring` | `low_roi_refactoring` | Calcula ROI: `(reduction in maintenance cost / refactoring cost)` |
| `detectDebtAccumulationRate` | `debt_accelerating` | Taxa de acumulação: `issues_now / issues_30_days_ago` |

---

## Fase 5: SBOM e Supply Chain (Detectores P2 — 1 módulo, ~8 detectores) 📋 PLANEADA

### 5.1 supply-chain-detectors.ts

| Detector | Tipo HealthIssue | Lógica (determinística) |
|----------|------------------|-------------------------|
| `detectSBOMExists` | `missing_sbom` | Verifica existência de SBOM (CycloneDX/SPDX) |
| `detectSBOMCompleteness` | `incomplete_sbom` | Compara deps do package.json com SBOM |
| `detectOutdatedDeps` | `outdated_dependencies` | Verifica dependências com versões desatualizadas |
| `detectUnusedDeps` | `unused_dependencies` | Detecta deps em package.json sem imports no código |
| `detectMissingLockFile` | `missing_lock` | Verifica existência de pnpm-lock.yaml |
| `detectLockFileSync` | `lock_file_drift` | Verifica se lock file está sincronizado com package.json |
| `detectDuplicateDeps` | `duplicate_dependencies` | Detecta mesmas dependências em deps e devDeps |
| `detectDepAuditStatus` | `unaudited_dependencies` | Verifica se deps passaram por security audit |

---

## Fase 6: Engine de Sugestões (Detectores P1 — 1 módulo, ~3 detectores) 📋 PLANEADA

### 6.1 suggestion-engine.ts

**Interface:**

```typescript
interface Suggestion {
  id: string;
  issueType: string;
  description: string;
  file: string;
  line: number;
  currentCode: string;
  suggestedCode: string;
  confidence: number; // 0-1, baseado em padrões determinísticos
  requiresConfirmation: true; // SEMPRE true
  reasoning: string; // Por que esta sugestão
}
```

**Detector associado:**

| Detector | Lógica |
|----------|--------|
| `generateFixSuggestions` | Para cada issue com `confidence > 0.7`, gera `Suggestion` com código sugerido |
| `prioritizeSuggestions` | Ordena por impacto × confiança |
| `estimateFixEffort` | Estima horas para cada sugestão |

---

## Resumo Final

| Fase | Módulos | Detectores | Status |
|------|---------|------------|--------|
| Fase 1 | 4 | 22 | ✅ Concluída |
| Fase 2 | 2 | 16 | 📋 Planeada |
| Fase 3 | 2 | 18 | 📋 Planeada |
| Fase 4 | 1 | 8 | 📋 Planeada |
| Fase 5 | 1 | 8 | 📋 Planeada |
| Fase 6 | 1 | 3 | 📋 Planeada |
| **Total** | **11** | **75 novos** | **~180 total** |

---

## Ordem de Implementação

1. **Fase 2** (Observabilidade + Operação) — Mais simples, alto impacto
2. **Fase 3** (Compliance OWASP/CWE) — Alto valor para empresas
3. **Fase 4** (Quantificação Dívida Técnica) — Visão de negócio
4. **Fase 5** (SBOM Supply Chain) — Tendência de mercado
5. **Fase 6** (Engine de Sugestões) — Diferencial competitivo

---

## Restrições Arquiteturais

| Restrição | Como é garantido |
|-----------|------------------|
| **Sem tokens LLM** | Todos os detectores são regex/AST puros. Zero chamadas a APIs externas |
| **Sem loops infinitos** | Cada detector é função pura com terminação garantida. Sem recursão. Sem I/O externo |
| **Decisão do usuário** | Interface `Suggestion` com `requiresConfirmation: true`. Nunca auto-aplica |
| **Transparência** | Cada sugestão inclui: código atual, código sugerido, confiança, localização |
