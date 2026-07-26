import { existsSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../constants.js";
import type { HealthIssue, HealthIssueType, SourceFileInfo } from "../types.js";

const OWASP_CATEGORIES: Record<string, HealthIssueType[]> = {
  "A01:BrokenAccessControl": [
    "missing_auth",
    "weak_access_controls",
    "missing_rate_limit",
  ],
  "A02:CryptographicFailures": [
    "weak_crypto",
    "missing_encryption",
    "hardcoded_secret",
  ],
  "A03:Injection": [
    "sql_injection",
    "xss_risk",
    "command_injection",
    "code_injection",
    "log_injection",
  ],
  "A04:InsecureDesign": [
    "missing_circuit_breaker",
    "missing_retry_policy",
    "missing_timeout",
  ],
  "A05:SecurityMisconfiguration": [
    "config_secrets",
    "insecure_http",
    "missing_health_check",
  ],
  "A06:VulnerableComponents": [
    "dependency_vulnerability",
    "deprecated_package",
    "transitive_vuln",
  ],
  "A07:AuthFailures": [
    "missing_auth",
    "weak_access_controls",
  ],
  "A08:DataIntegrityFailures": [
    "unsafe_deserialize",
    "missing_migration",
  ],
  "A09:LoggingFailures": [
    "missing_audit_log",
    "unstructured_logs",
    "missing_correlation_id",
  ],
  "A10:SSRF": [
    "ssrf",
    "open_redirect",
  ],
};

export function detectOWASPTop10(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const detectedTypes = new Set(existingIssues.map((i) => i.type));

  for (const [category, requiredTypes] of Object.entries(OWASP_CATEGORIES)) {
    const coveredCount = requiredTypes.filter((t) => detectedTypes.has(t)).length;
    const coverage = coveredCount / requiredTypes.length;

    if (coverage < 0.5 && existingIssues.length > 0) {
      issues.push({
        type: "owasp_gap",
        severity: 2,
        description: `OWASP ${category} com cobertura insuficiente (${Math.round(coverage * 100)}%)`,
        location: "compliance mapping",
        recommendation: `Rever controles de segurança para ${category}: ${requiredTypes.join(", ")}`,
        confidence: 0.85,
      });
    }
  }

  return issues;
}

const CWE_MAP: Record<string, string> = {
  "hardcoded_secret": "CWE-798",
  "sql_injection": "CWE-89",
  "xss_risk": "CWE-79",
  "command_injection": "CWE-78",
  "path_traversal": "CWE-22",
  "ssrf": "CWE-918",
  "open_redirect": "CWE-601",
  "weak_crypto": "CWE-327",
  "unsafe_eval": "CWE-95",
  "proto_pollution": "CWE-1321",
  "unsafe_deserialize": "CWE-502",
  "dependency_vulnerability": "CWE-1035",
  "regex_dos": "CWE-1333",
};

export function detectCWEMapping(
  _projectRoot: string,
  _files: SourceFileInfo[],
  existingIssues: HealthIssue[] = [],
): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const detectedTypes = new Set(existingIssues.map((i) => i.type));

  const unmappedTypes = Array.from(detectedTypes).filter(
    (t) => !CWE_MAP[t] && t.includes("injection") || t.includes("secret") || t.includes("crypto"),
  );

  if (unmappedTypes.length > 0) {
    issues.push({
      type: "cwe_gap",
      severity: 1,
      description: `${unmappedTypes.length} tipos de issue sem mapeamento CWE`,
      location: "compliance mapping",
      recommendation: `Adicionar mapeamento CWE para: ${unmappedTypes.join(", ")}`,
      confidence: 0.85,
    });
  }

  return issues;
}

const SOC2_CONTROL_FILES = [
  "ACCESS_CONTROL.md",
  "ENCRYPTION_POLICY.md",
  "LOGGING_POLICY.md",
  "MONITORING_POLICY.md",
  "INCIDENT_RESPONSE.md",
  "DATA_RETENTION.md",
];

export function detectSOC2Controls(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const docsDir = join(projectRoot, SHITENNO_DIR_NAME, "docs");

  const missingControls = SOC2_CONTROL_FILES.filter(
    (f) => !existsSync(join(docsDir, f)) && !existsSync(join(projectRoot, "docs", f)),
  );

  if (missingControls.length > 0) {
    issues.push({
      type: "soc2_gap",
      severity: 2,
      description: `SOC2: ${missingControls.length} documentos de controle em falta`,
      location: "compliance docs",
      recommendation: `Criar documentos de controle: ${missingControls.join(", ")}`,
      confidence: 0.95,
    });
  }

  return issues;
}

export function detectNISTAlignment(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);

  const hasGovernance = existsSync(join(shitennoDir, "governance"));
  const hasPolicies = existsSync(join(shitennoDir, "governance", "policies"));
  const hasRules = existsSync(join(shitennoDir, "governance", "rules"));

  if (!hasGovernance || !hasPolicies || !hasRules) {
    issues.push({
      type: "nist_gap",
      severity: 2,
      description: "NIST: Estrutura de governança incompleta",
      location: "shitenno/governance",
      recommendation: "Implementar estrutura completa de governança conforme NIST SP 800-53",
      confidence: 0.95,
    });
  }

  return issues;
}
