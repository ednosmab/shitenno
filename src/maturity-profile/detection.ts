import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Capability } from "../domain/entities/engineering-state.js";

function anyPathExists(...paths: string[]): boolean {
  return paths.some((p) => existsSync(p));
}

type SignalDetector = [Capability, string[]];

function detectSignals(shitennoDir: string, detectors: SignalDetector[]): Capability[] {
  const installed: Capability[] = ["core"];
  if (!existsSync(shitennoDir)) return installed;
  for (const [capability, relativePaths] of detectors) {
    if (anyPathExists(...relativePaths.map((rp) => join(shitennoDir, rp)))) {
      installed.push(capability);
    }
  }
  return installed;
}

const SIGNAL_DETECTORS: SignalDetector[] = [
  ["knowledge", ["docs/skills", "docs/AGENTS.md"]],
  ["architecture", ["docs/adrs", "docs/sdr", "docs/plans"]],
  ["governance", ["governance/WORKFLOW.md", "governance/context"]],
  ["ai", ["governance/agents", "cognition"]],
  ["quality", ["scripts/validate-session.ts"]],
  ["metrics", ["reports"]],
  ["operations", ["scripts/close-session.ts", "docs/runbooks"]],
  ["compliance", ["docs/FORBIDDEN_OPERATIONS.md", "docs/DESDO.md", "governance/premortem"]],
];

export function detectCapabilitySignalsFromFilesystem(shitennoDir: string): Capability[] {
  return detectSignals(shitennoDir, SIGNAL_DETECTORS);
}
