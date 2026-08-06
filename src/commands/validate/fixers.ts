/**
 * commands/validate/fixers.ts — Validation fix functions
 *
 * Extracted from commands/validate.ts to keep modules focused.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SHITENNO_DIR_NAME } from "../../domain/types/constants.js";
import type { ValidationResult } from "./checks.js";

// ── Fix Functions ───────────────────────────────────────────────────────────

export function fixMissingOpencodeConfig(targetDir: string): string {
  const configPath = join(targetDir, "opencode.json");
  const defaultConfig = {
    $schema: "https://opencode.ai/config.json",
    model: "opencode/mimo-v2.5-free",
    default_agent: "plan",
    agent: {
      plan: { role: "planner", model: "opencode/mimo-v2.5-free" },
      build: { role: "executor", model: "opencode/deepseek-v4-flash-free" },
      review: { role: "auditor", model: "opencode/mimo-v2.5-free" },
    },
  };

  writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  return "Created default opencode.json";
}

export function fixMissingContextBuffer(shitennoDir: string): string {
  const bufferDir = join(shitennoDir, "governance", "context");
  mkdirSync(bufferDir, { recursive: true });

  const defaultBuffer = `# CONTEXT_BUFFER — Memória RAM do Sistema

quick_board_required: true

quick_board:
  em_curso: null
  parado: []
  proximo: []
  p1_paralelas: []

reminders: []

milestone:
  status: "NO_SESSION"
  closed_at: null
  adr_reference: null
  commits: []
  next_phase: null

session:
  id: null
  branch: null
  operation_type: null
  last_commit: null
  status: "idle"
  closed_at: null
  reminder: null

current_task:
  id: null
  type: null
  description: null
  status: "idle"
  plan_file: null
  current_step: null
  model_assignments: []
  adr: null

adr:
  last: null
  created: null

blockers: []

next_steps: []

last_decision:
  adr: null
  description: null

technical_debt: []

documents_loaded: []
`;

  writeFileSync(join(bufferDir, "context_buffer.yaml"), defaultBuffer);
  return "Created default context_buffer.yaml in shitenno/governance/context/";
}

export function attemptFixes(targetDir: string, results: ValidationResult[]): string[] {
  const fixes: string[] = [];
  const shitennoDir = join(targetDir, SHITENNO_DIR_NAME);

  for (const result of results) {
    if (result.status !== "fail") continue;

    if (result.name === "opencode.json" && result.message === "File not found") {
      fixes.push(fixMissingOpencodeConfig(targetDir));
    }

    if (result.name === "Context Buffer" && result.message.includes("not found")) {
      fixes.push(fixMissingContextBuffer(shitennoDir));
    }
  }

  return fixes;
}
