import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { logger } from "../../logger.js";
import { safeJsonParseValidated, isRecord } from "../../validation.js";
import { BLOCKED_LICENSES } from "../constants.js";
import type { HealthIssue } from "../types.js";

function parseNpmFormat(audit: Record<string, unknown>): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const vulns = (audit.vulnerabilities ?? {}) as Record<string, { severity?: string; via?: Array<{ title?: string }> }>;
  for (const [name, v] of Object.entries(vulns)) {
    if (!v.severity) continue;
    const severity = v.severity === "critical" || v.severity === "high" ? 3 : v.severity === "moderate" ? 2 : 1;
    const via = v.via?.filter((x) => x.title).map((x) => x.title).join(", ") ?? "";
    issues.push({ type: "dependency_vulnerability", severity: severity as 1 | 2 | 3,
      description: `Dependência "${name}" possui vulnerabilidade (${v.severity}): ${via}`,
      location: "package-lock.json", recommendation: `Rodar "npm audit fix" ou atualizar ${name} para versão segura`, confidence: 0.9 });
  }
  return issues;
}

function parseYarnFormat(output: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const seen = new Set<string>();
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "auditAdvisory" || !entry.data?.advisory) continue;
      const adv = entry.data.advisory;
      const name = adv.module_name ?? "unknown";
      if (seen.has(name)) continue;
      seen.add(name);
      const severity = adv.severity === "critical" || adv.severity === "high" ? 3 : adv.severity === "moderate" ? 2 : 1;
      issues.push({ type: "dependency_vulnerability", severity: severity as 1 | 2 | 3,
        description: `Dependência "${name}" possui vulnerabilidade (${adv.severity}): ${adv.title ?? ""}`,
        location: "yarn.lock", recommendation: `Rodar "yarn audit fix" ou atualizar ${name} para versão segura`, confidence: 0.9 });
    } catch { /* skip malformed lines */ }
  }
  return issues;
}

function parseNpmAuditOutput(output: string): HealthIssue[] {
  try { return parseNpmFormat(JSON.parse(output)); }
  catch { return parseYarnFormat(output); }
}

export function detectDependencyVulnerabilities(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];

  const lockFiles = [
    { file: "package-lock.json", cmd: "npm audit --json" },
    { file: "pnpm-lock.yaml", cmd: "pnpm audit --json" },
    { file: "yarn.lock", cmd: "yarn audit --json" },
  ];
  const found = lockFiles.find((l) => existsSync(join(projectRoot, l.file)));
  if (!found) return issues;

  try {
    const output = execSync(`${found.cmd} 2>/dev/null`, {
      cwd: projectRoot,
      encoding: "utf-8",
      timeout: 20000,
    });
    return parseNpmAuditOutput(output);
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout;
    if (stdout) {
      try { return parseNpmAuditOutput(stdout); } catch { /* JSON really malformed, ignore */ }
    }
    return [];
  }
}

export function detectIncompatibleLicenses(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const nodeModules = join(projectRoot, "node_modules");
  if (!existsSync(nodeModules)) return issues;

  try {
    const entries = readdirSync(nodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const pkgJsonPath = join(nodeModules, entry.name, "package.json");
      if (!existsSync(pkgJsonPath)) continue;
      try {
        const pkgRaw = safeJsonParseValidated(readFileSync(pkgJsonPath, "utf-8"), isRecord, `supply:license:${entry.name}`);
        if (!pkgRaw) continue;
        const pkg = pkgRaw as Record<string, unknown>;
        const licenseField = pkg.license;
        const license = typeof licenseField === "string" ? licenseField
          : typeof licenseField === "object" && licenseField !== null ? (licenseField as Record<string, unknown>).type as string : "";
        if (BLOCKED_LICENSES.some((bl) => license.includes(bl))) {
          issues.push({
            type: "incompatible_license",
            severity: 2,
            description: `Dependência "${entry.name}" usa licença ${license} — potencialmente incompatível com uso comercial`,
            location: `node_modules/${entry.name}/package.json`,
            recommendation: `Verificar compatibilidade da licença ${license} ou buscar alternativa`,
            confidence: 0.9,
          });
        }
      } catch (parseErr) { logger.debug("engineering-detectors", "Error reading package.json for license:", parseErr); }
    }
  } catch (err) { logger.debug("engineering-detectors", "Error in detectIncompatibleLicenses:", err); }
  return issues;
}

const SECRET_PATTERNS = [
  { regex: /(?:password|passwd|pwd)\s*[=:]\s*\S+/i, name: "password" },
  { regex: /(?:api[_-]?key|apikey)\s*[=:]\s*\S+/i, name: "API key" },
  { regex: /(?:secret|token)\s*[=:]\s*\S+/i, name: "secret/token" },
  { regex: /(?:private[_-]?key)\s*[=:]\s*\S+/i, name: "private key" },
];

function isFileGitignored(fileName: string, projectRoot: string): boolean {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) return false;
  const gitignore = readFileSync(gitignorePath, "utf-8");
  return gitignore.split("\n").some((line) => line.trim() === fileName || line.trim() === `/${fileName}`);
}

function scanFileForSecrets(content: string, fileName: string, issues: HealthIssue[]): void {
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.trim().startsWith("#") || !line.trim()) continue;
    for (const { regex, name } of SECRET_PATTERNS) {
      if (regex.test(line)) {
        issues.push({ type: "config_secret", severity: 3,
          description: `Possível ${name} em "${fileName}:${i + 1}" — arquivo de config versionado contém segredo`,
          location: `${fileName}:${i + 1}`,
          recommendation: `Mover segredo para variável de ambiente ou .env gitignored; adicionar ${fileName} ao .gitignore`, confidence: 0.75 });
        break;
      }
    }
  }
}

export function detectConfigSecrets(projectRoot: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const CONFIG_FILES = [".env", ".env.local", ".env.production", "credentials.json", "secrets.json", ".npmrc"];
  for (const fileName of CONFIG_FILES) {
    const filePath = join(projectRoot, fileName);
    if (!existsSync(filePath)) continue;
    if (isFileGitignored(fileName, projectRoot)) continue;
    try { scanFileForSecrets(readFileSync(filePath, "utf-8"), fileName, issues); }
    catch (readErr) { logger.debug("engineering-detectors", "Error reading config file:", readErr); }
  }
  return issues;
}
