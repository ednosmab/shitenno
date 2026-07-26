import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HealthIssue, SourceFileInfo } from "../types.js";

export function detectSecretsInConfig(projectRoot: string, _files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const configFiles = [
    ".env",
    ".env.local",
    ".env.production",
    "config.json",
    "config.yml",
    "docker-compose.yml",
  ];

  const secretPatterns = [
    /password\s*[:=]\s*["'][^"']+["']/i,
    /secret\s*[:=]\s*["'][^"']+["']/i,
    /api_key\s*[:=]\s*["'][^"']+["']/i,
    /token\s*[:=]\s*["'][^"']+["']/i,
  ];

  for (const configFile of configFiles) {
    const configPath = join(projectRoot, configFile);
    if (!existsSync(configPath)) continue;

    const content = readFileSync(configPath, "utf-8");
    const hasSecret = secretPatterns.some((p) => p.test(content));

    if (hasSecret) {
      issues.push({
        type: "config_secrets",
        severity: 3,
        description: `Possível segredo detectado em ${configFile}`,
        location: configFile,
        recommendation: "Mover segredos para variáveis de ambiente ou vault. Nunca committar segredos em config files.",
        confidence: 0.75,
      });
    }
  }

  return issues;
}

export function detectEncryptionAtRest(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const encryptionPatterns = [
    /encrypt|decrypt|cipher|crypto/i,
    /aes|rsa|bcrypt|scrypt|argon/i,
    /hashed?|hash.*password/i,
  ];

  const sensitivePatterns = [
    /password|senha|secret|token|api.*key/i,
    /credit.*card|cpf|cnpj|ssn/i,
  ];

  const hasSensitiveData = files.some((f) =>
    sensitivePatterns.some((p) => p.test(f.content)),
  );

  const hasEncryption = files.some((f) =>
    encryptionPatterns.some((p) => p.test(f.content)),
  );

  if (hasSensitiveData && !hasEncryption) {
    issues.push({
      type: "missing_encryption",
      severity: 3,
      description: "Dados sensíveis detectados sem padrões de criptografia",
      location: "source files",
      recommendation: "Implementar criptografia para dados sensíveis em repouso e trânsito.",
      confidence: 0.65,
    });
  }

  return issues;
}

export function detectAccessControls(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const authPatterns = [
    /@Auth|@UseGuards|@Roles|@Permissions/i,
    /authenticate|authorize|isAuthenticated/i,
    /middleware.*auth|auth.*middleware/i,
    /passport|jwt|bearer/i,
  ];

  const routePatterns = [
    /@(Get|Post|Put|Delete|Patch)\s*\(/i,
    /router\.(get|post|put|delete|patch)\s*\(/i,
    /app\.(get|post|put|delete|patch)\s*\(/i,
  ];

  const hasRoutes = files.some((f) =>
    routePatterns.some((p) => p.test(f.content)),
  );

  const hasAuth = files.some((f) =>
    authPatterns.some((p) => p.test(f.content)),
  );

  if (hasRoutes && !hasAuth) {
    issues.push({
      type: "weak_access_controls",
      severity: 3,
      description: "Rotas detectadas sem middleware de autORIZAÇÃO/autENTICAÇÃO",
      location: "source files",
      recommendation: "Implementar middleware de auth para todas as rotas sensíveis.",
      confidence: 0.65,
    });
  }

  return issues;
}

export function detectAuditLogging(_projectRoot: string, files: SourceFileInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const auditPatterns = [
    /audit.*log|log.*audit/i,
    /activity.*log|log.*activity/i,
    /security.*event|event.*security/i,
    /createLog|logEvent|recordEvent/i,
  ];

  const hasAuditLog = files.some((f) =>
    auditPatterns.some((p) => p.test(f.content)),
  );

  if (!hasAuditLog && files.length > 10) {
    issues.push({
      type: "missing_audit_log",
      severity: 2,
      description: "Nenhum padrão de audit logging detectado",
      location: "source files",
      recommendation: "Implementar audit logging para ações sensíveis: create, update, delete, login.",
      confidence: 0.65,
    });
  }

  return issues;
}
