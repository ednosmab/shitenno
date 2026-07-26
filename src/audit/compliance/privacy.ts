import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectLGPDCompliance(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const lgpdPatterns = [
    /lgpd|lgpdd|lei.*geral.*dados/i,
    /gdpr|general.*data.*protection/i,
    /consent|consentimento/i,
    /retention|retenção|retencao/i,
    /titular|data.*subject/i,
    /dpo|data.*protection.*officer/i,
  ];

  const hasLGPD = files.some((f) =>
    lgpdPatterns.some((p) => p.test(f.content)),
  );

  if (!hasLGPD && files.length > 10) {
    issues.push({
      type: "lgpd_gap",
      severity: 2,
      description: "Nenhuma referência a LGPD/GDPR detectada no projeto",
      location: "project root",
      recommendation: "Documentar conformidade com LGPD: consentimento, retenção, direitos do titular, DPO.",
      confidence: 0.65,
    });
  }

  return issues;
}

export function detectDataRetention(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const retentionPatterns = [
    /retention|retenção|retencao|data.*retention/i,
    /delete.*after|remover.*após|expirar/i,
    /ttl|time.*to.*live|max.*age/i,
  ];

  const hasRetention = files.some((f) =>
    retentionPatterns.some((p) => p.test(f.content)),
  );

  if (!hasRetention && files.length > 10) {
    issues.push({
      type: "missing_retention_policy",
      severity: 2,
      description: "Nenhuma política de retenção de dados detectada",
      location: "project root",
      recommendation: "Definir e documentar políticas de retenção de dados conforme LGPD/GDPR.",
      confidence: 0.65,
    });
  }

  return issues;
}

export function detectConsentTracking(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const consentPatterns = [
    /consent|consentimento|opt.*in|opt.*out/i,
    /cookie.*consent|privacy.*consent/i,
    /accept.*terms|aceitar.*termos/i,
  ];

  const hasConsent = files.some((f) =>
    consentPatterns.some((p) => p.test(f.content)),
  );

  if (!hasConsent && files.length > 10) {
    issues.push({
      type: "missing_consent",
      severity: 1,
      description: "Nenhum mecanismo de rastreamento de consentimento detectado",
      location: "project root",
      recommendation: "Implementar consent management para dados pessoais conforme LGPD/GDPR.",
      confidence: 0.65,
    });
  }

  return issues;
}
