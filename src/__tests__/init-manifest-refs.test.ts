import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { inventoryGovernance } from "../commands/init/discovery.js";
import { writeExternalIndex, EXTERNAL_INDEX_REL_PATH } from "../commands/init/manifest-refs.js";
import { detectBrokenManifestRefs } from "../audit/docs/refs.js";
import { STANDARD_DETECTORS } from "../audit/constants/detectors-standard.js";
import { buildGovernanceDetectors } from "../audit/detector-map/governance.js";
import { SHITENNO_DIR_NAME } from "../constants.js";
import type { DetectorContext } from "../audit/detector-map/context.js";
import type { HealthIssue } from "../audit/types.js";

function makeProject(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), `shitenno-manifest-${prefix}-`));
  execSync("git init -q", { cwd: dir });
  return dir;
}

function makeShitenno(projectRoot: string): string {
  const shitennoDir = join(projectRoot, SHITENNO_DIR_NAME);
  mkdirSync(join(shitennoDir, "docs"), { recursive: true });
  return shitennoDir;
}

function manifestPathFor(shitennoDir: string): string {
  return join(shitennoDir, EXTERNAL_INDEX_REL_PATH);
}

describe("writeExternalIndex", () => {
  it("references ADRs and plans by their real relative paths (no copying)", () => {
    const dir = makeProject("index");
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      mkdirSync(join(dir, "docs", "plans"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");
      writeFileSync(join(dir, "docs", "plans", "PLAN-A.md"), "# Plan", "utf-8");
      const shitennoDir = makeShitenno(dir);

      writeExternalIndex(dir, shitennoDir, inventoryGovernance(dir));

      const manifestPath = manifestPathFor(shitennoDir);
      expect(existsSync(manifestPath)).toBe(true);
      const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      const paths = raw.refs.map((r: { path: string }) => r.path);
      expect(paths).toContain(join("docs", "adr", "ADR-001.md"));
      expect(paths).toContain(join("docs", "plans", "PLAN-A.md"));
      // ADRs stay in docs/adr — nothing copied into the manifest
      expect(existsSync(join(shitennoDir, "docs", "adr"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("produces an empty refs list when no knowledge artifacts exist", () => {
    const dir = makeProject("empty");
    try {
      const shitennoDir = makeShitenno(dir);
      writeExternalIndex(dir, shitennoDir, inventoryGovernance(dir));
      const raw = JSON.parse(readFileSync(manifestPathFor(shitennoDir), "utf-8"));
      expect(raw.refs).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("detectBrokenManifestRefs", () => {
  it("flags a referenced ADR that was deleted (manifest rot)", () => {
    const dir = makeProject("rot");
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");
      const shitennoDir = makeShitenno(dir);
      writeExternalIndex(dir, shitennoDir, inventoryGovernance(dir));

      // Simulate the ADR being deleted from the real project
      rmSync(join(dir, "docs", "adr", "ADR-001.md"), { force: true });

      const issues = detectBrokenManifestRefs(shitennoDir);
      const broken = issues.filter((i) => i.type === "broken_manifest_ref");
      expect(broken).toHaveLength(1);
      expect(broken[0]).toMatchObject({
        type: "broken_manifest_ref",
        severity: 2,
        location: "shitenno/docs/external-index.json",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns no issues when all references resolve", () => {
    const dir = makeProject("intact");
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# ADR", "utf-8");
      const shitennoDir = makeShitenno(dir);
      writeExternalIndex(dir, shitennoDir, inventoryGovernance(dir));

      const issues = detectBrokenManifestRefs(shitennoDir);
      expect(issues.filter((i) => i.type === "broken_manifest_ref")).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tolerates a missing or malformed manifest", () => {
    const dir = makeProject("malformed");
    try {
      const shitennoDir = makeShitenno(dir);
      expect(detectBrokenManifestRefs(shitennoDir)).toEqual([]);

      writeFileSync(manifestPathFor(shitennoDir), "not-json{", "utf-8");
      expect(detectBrokenManifestRefs(shitennoDir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("detector registration (Fase 5 - three adjusting points)", () => {
  it("is registered in STANDARD_DETECTORS", () => {
    expect(STANDARD_DETECTORS).toContain("detectBrokenManifestRefs");
  });

  it("is registered in the governance detector map", () => {
    const ctx = { shitennoDir: "/tmp/none", projectRoot: "/tmp/none" } as Pick<
      DetectorContext,
      "shitennoDir" | "projectRoot"
    > as DetectorContext;
    const map = buildGovernanceDetectors(ctx);
    expect(typeof map.detectBrokenManifestRefs).toBe("function");
  });

  it("emits a broken_manifest_ref HealthIssue on a stale reference", () => {
    const dir = makeProject("type");
    try {
      mkdirSync(join(dir, "docs", "adr"), { recursive: true });
      writeFileSync(join(dir, "docs", "adr", "ADR-001.md"), "# A", "utf-8");
      const shitennoDir = makeShitenno(dir);
      writeExternalIndex(dir, shitennoDir, inventoryGovernance(dir));
      rmSync(join(dir, "docs", "adr", "ADR-001.md"), { force: true });
      const issues: HealthIssue[] = detectBrokenManifestRefs(shitennoDir);
      expect(issues.some((i) => i.type === "broken_manifest_ref")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});