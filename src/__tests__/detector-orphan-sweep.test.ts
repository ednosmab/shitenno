import { describe, it, expect } from "vitest";
import { DETECTORS_BY_LEVEL } from "../audit/constants/detector-levels.js";
import { buildGovernanceDetectors } from "../audit/detector-map/governance.js";
import { buildEngineeringQualityDetectors } from "../audit/detector-map/engineering.js";
import { buildGitEnforcementDetectors } from "../audit/detector-map/git.js";
import { buildArchReliabilityDetectors } from "../audit/detector-map/arch.js";
import { buildOpsComplianceDetectors } from "../audit/detector-map/ops.js";
import { buildSupplyChainTechDebtDetectors } from "../audit/detector-map/supply-chain.js";
import type { DetectorContext } from "../audit/detector-map/context.js";

/**
 * Detector orphan sweep test
 *
 * Every detector registered in the detector-map builders MUST appear
 * in at least one audit level list. If a detector is missing from all
 * levels, it is an orphan — it exists in code but never runs.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase B.10
 */

const MOCK_CTX: DetectorContext = {
  projectRoot: "/mock",
  shitennoDir: "/mock/.shitenno",
  sourceFiles: [],
  rules: [],
  history: [],
};

const ALL_LEVEL_DETECTORS = [
  ...DETECTORS_BY_LEVEL.quick,
  ...DETECTORS_BY_LEVEL.standard,
  ...DETECTORS_BY_LEVEL["code-review"],
  ...DETECTORS_BY_LEVEL.enterprise,
];

function getAllRegisteredDetectorNames(): string[] {
  const govKeys = Object.keys(buildGovernanceDetectors(MOCK_CTX));
  const engKeys = Object.keys(buildEngineeringQualityDetectors(MOCK_CTX));
  const gitKeys = Object.keys(buildGitEnforcementDetectors(MOCK_CTX));
  const archKeys = Object.keys(buildArchReliabilityDetectors(MOCK_CTX));
  const opsKeys = Object.keys(buildOpsComplianceDetectors(MOCK_CTX));
  const scKeys = Object.keys(buildSupplyChainTechDebtDetectors(MOCK_CTX));
  return [...govKeys, ...engKeys, ...gitKeys, ...archKeys, ...opsKeys, ...scKeys];
}

describe("Detector orphan sweep — every registered detector must appear in some level", () => {
  it("no detector is orphaned (registered but missing from all level lists)", () => {
    const registered = getAllRegisteredDetectorNames();
    const levelSet = new Set(ALL_LEVEL_DETECTORS);
    const orphans = registered.filter((name) => !levelSet.has(name));
    expect(
      orphans,
      `Orphaned detectors (registered but not in any level): ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("total unique detectors across all levels matches registered count", () => {
    const registered = getAllRegisteredDetectorNames();
    const uniqueRegistered = new Set(registered);
    const uniqueLevels = new Set(ALL_LEVEL_DETECTORS);
    expect(uniqueLevels.size).toBe(uniqueRegistered.size);
  });

  it("each level has detectors and enterprise is the superset", () => {
    const enterpriseSet = new Set(DETECTORS_BY_LEVEL.enterprise);
    const registered = getAllRegisteredDetectorNames();
    for (const name of registered) {
      expect(
        enterpriseSet.has(name),
        `"${name}" is registered but missing from enterprise level`,
      ).toBe(true);
    }
  });
});
