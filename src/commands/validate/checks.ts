/**
 * commands/validate/checks.ts — Validation check functions
 *
 * Extracted from commands/validate.ts to keep modules focused.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { SHITENNO_DIR_NAME } from "../../constants.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ValidationResult {
  name: string;
  status: "pass" | "warn" | "fail";
  message: string;
}

// ── Check Functions ─────────────────────────────────────────────────────────

export function checkContextBuffer(shitennoDir: string): ValidationResult {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return {
      name: "Context Buffer",
      status: "warn",
      message: "shitenno/governance/context/context_buffer.yaml not found",
    };
  }

  try {
    const content = readFileSync(bufferPath, "utf-8");

    if (!content.includes("session:")) {
      return {
        name: "Context Buffer",
        status: "warn",
        message: "Missing 'session' section",
      };
    }

    if (!content.includes("current_task:")) {
      return {
        name: "Context Buffer",
        status: "warn",
        message: "Missing 'current_task' section",
      };
    }

    return {
      name: "Context Buffer",
      status: "pass",
      message: "Valid structure",
    };
  } catch {
    return {
      name: "Context Buffer",
      status: "fail",
      message: "Error reading file",
    };
  }
}

export function checkAdrDirectory(shitennoDir: string): ValidationResult {
  const adrDir = join(shitennoDir, "docs", "adrs");

  if (!existsSync(adrDir)) {
    return {
      name: "ADR Directory",
      status: "warn",
      message: "shitenno/docs/adrs/ not found",
    };
  }

  const adrFiles = readdirSync(adrDir).filter((f: string) =>
    f.endsWith(".md")
  );

  if (adrFiles.length === 0) {
    return {
      name: "ADR Directory",
      status: "warn",
      message: "No ADRs found",
    };
  }

  return {
    name: "ADR Directory",
    status: "pass",
    message: `${adrFiles.length} ADRs exist`,
  };
}

export function checkOpencodeConsistency(targetDir: string): ValidationResult {
  const configPath = join(targetDir, "opencode.json");

  if (!existsSync(configPath)) {
    return {
      name: "opencode.json",
      status: "fail",
      message: "File not found",
    };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    const issues: string[] = [];

    if (!config.model) {
      issues.push("missing 'model'");
    }

    if (!config.agent) {
      issues.push("missing 'agent'");
    } else {
      const agents = Object.keys(config.agent);
      if (agents.length === 0) {
        issues.push("no agents configured");
      }

      const requiredRoles = ["plan", "build", "review"];
      for (const role of requiredRoles) {
        if (!agents.includes(role)) {
          issues.push(`missing '${role}' agent`);
        }
      }
    }

    if (issues.length > 0) {
      return {
        name: "opencode.json",
        status: "warn",
        message: `Issues: ${issues.join(", ")}`,
      };
    }

    return {
      name: "opencode.json",
      status: "pass",
      message: "Consistent configuration",
    };
  } catch {
    return {
      name: "opencode.json",
      status: "fail",
      message: "Invalid JSON",
    };
  }
}

export function checkAgentContracts(shitennoDir: string): ValidationResult {
  const contractsDir = join(shitennoDir, "governance", "agents");

  if (!existsSync(contractsDir)) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: "shitenno/governance/agents/ not found",
    };
  }

  const yamlFiles = readdirSync(contractsDir).filter((f: string) =>
    f.endsWith(".yaml") || f.endsWith(".yml")
  );

  if (yamlFiles.length === 0) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: "No contracts found",
    };
  }

  const invalidContracts: string[] = [];
  for (const file of yamlFiles) {
    const content = readFileSync(join(contractsDir, file), "utf-8");
    if (!content.includes("agent:") || !content.includes("name:")) {
      invalidContracts.push(file);
    }
  }

  if (invalidContracts.length > 0) {
    return {
      name: "Agent Contracts",
      status: "warn",
      message: `Invalid contracts: ${invalidContracts.join(", ")}`,
    };
  }

  return {
    name: "Agent Contracts",
    status: "pass",
    message: `${yamlFiles.length} valid contracts`,
  };
}

export function checkSessionStatus(shitennoDir: string): ValidationResult {
  const bufferPath = join(shitennoDir, "governance", "context", "context_buffer.yaml");

  if (!existsSync(bufferPath)) {
    return {
      name: "Session Status",
      status: "warn",
      message: "No context buffer",
    };
  }

  const content = readFileSync(bufferPath, "utf-8");

  if (content.includes("in_progress")) {
    return {
      name: "Session Status",
      status: "pass",
      message: "Session in progress",
    };
  }

  if (content.includes("completed")) {
    return {
      name: "Session Status",
      status: "pass",
      message: "Session completed",
    };
  }

  return {
    name: "Session Status",
    status: "warn",
    message: "Unknown session status",
  };
}

export function checkGitStatus(targetDir: string): ValidationResult {
  try {
    const gitDir = join(targetDir, ".git");
    if (!existsSync(gitDir)) {
      return {
        name: "Git Status",
        status: "warn",
        message: "Not a git repository",
      };
    }

    const gitOutput = execSync("git status --porcelain", {
      cwd: targetDir,
      encoding: "utf-8",
      timeout: 5000,
    });

    const lines = gitOutput.trim().split("\n").filter((l) => l.length > 0);

    if (lines.length === 0) {
      return {
        name: "Git Status",
        status: "pass",
        message: "Working tree clean",
      };
    }

    return {
      name: "Git Status",
      status: "warn",
      message: `${lines.length} uncommitted changes`,
    };
  } catch {
    return {
      name: "Git Status",
      status: "warn",
      message: "Could not check git status",
    };
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────

export function runValidationChecks(targetDir: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const shitennoDir = join(targetDir, SHITENNO_DIR_NAME);

  results.push(checkContextBuffer(shitennoDir));
  results.push(checkAdrDirectory(shitennoDir));
  results.push(checkOpencodeConsistency(targetDir));
  results.push(checkAgentContracts(shitennoDir));
  results.push(checkSessionStatus(shitennoDir));
  results.push(checkGitStatus(targetDir));

  return results;
}
