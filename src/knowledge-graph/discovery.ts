import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Artifact, ArtifactType, Relation, RelationType } from "./types.js";

type ScanConfig = {
  dirParts: string[];
  fileFilter: (f: string) => boolean;
  idPrefix: string;
  extractBase: (f: string) => string;
  cleanName: (s: string) => string;
  type: ArtifactType;
  descPrefix: string;
  tags: string[];
};

function scanDir(shitennoDir: string, now: string, cfg: ScanConfig): Artifact[] {
  const dir = join(shitennoDir, ...cfg.dirParts);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(cfg.fileFilter).map((file) => {
    const base = cfg.extractBase(file);
    return {
      id: `${cfg.idPrefix}${base}`,
      type: cfg.type,
      name: cfg.cleanName(base),
      path: `${cfg.dirParts.join("/")}/${file}`,
      description: `${cfg.descPrefix}${file}`,
      tags: cfg.tags,
      createdAt: now,
      updatedAt: now,
      status: "active",
    };
  });
}

const dashToSpace = (s: string) => s.replace(/-/g, " ");
const underscoreToSpace = (s: string) => s.replace(/_/g, " ");
const stripMd = (f: string) => f.replace(".md", "");
const stripYaml = (f: string) => f.replace(/\.(yaml|yml)$/, "");
const stripScript = (f: string) => f.replace(/\.(ts|js)$/, "");
const isMd = (f: string) => f.endsWith(".md");
const isYaml = (f: string) => f.endsWith(".yaml") || f.endsWith(".yml");
const isScript = (f: string) => f.endsWith(".ts") || f.endsWith(".js");

function scanAdrs(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["docs", "adrs"],
    fileFilter: (f) => isMd(f) && !f.startsWith("ADR-TEMPLATE"),
    idPrefix: "adr-",
    extractBase: stripMd,
    cleanName: dashToSpace,
    type: "adr",
    descPrefix: "Architecture Decision Record: ",
    tags: ["adr", "decision"],
  });
}

function scanSkills(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["docs", "skills"],
    fileFilter: isMd,
    idPrefix: "skill-",
    extractBase: stripMd,
    cleanName: underscoreToSpace,
    type: "skill",
    descPrefix: "Engineering skill: ",
    tags: ["skill", "engineering"],
  });
}

function scanContracts(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["governance", "agents"],
    fileFilter: isYaml,
    idPrefix: "contract-",
    extractBase: stripYaml,
    cleanName: dashToSpace,
    type: "contract",
    descPrefix: "AI agent contract: ",
    tags: ["contract", "agent"],
  });
}

function scanWorkflow(shitennoDir: string, now: string): Artifact[] {
  const workflowPath = join(shitennoDir, "governance", "WORKFLOW.md");
  if (!existsSync(workflowPath)) return [];
  return [{
    id: "workflow-main",
    type: "workflow",
    name: "Main Workflow",
    path: "governance/WORKFLOW.md",
    description: "Main session workflow",
    tags: ["workflow", "session"],
    createdAt: now,
    updatedAt: now,
    status: "active",
  }];
}

function scanRunbooks(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["docs", "runbooks"],
    fileFilter: isMd,
    idPrefix: "runbook-",
    extractBase: stripMd,
    cleanName: dashToSpace,
    type: "runbook",
    descPrefix: "Operational runbook: ",
    tags: ["runbook", "operations"],
  });
}

function scanPlans(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["governance", "plans"],
    fileFilter: (f) => isMd(f) && !f.startsWith("TEMPLATE"),
    idPrefix: "plan-",
    extractBase: stripMd,
    cleanName: dashToSpace,
    type: "plan",
    descPrefix: "Execution plan: ",
    tags: ["plan", "execution"],
  });
}

function scanScripts(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["scripts"],
    fileFilter: isScript,
    idPrefix: "script-",
    extractBase: stripScript,
    cleanName: dashToSpace,
    type: "script",
    descPrefix: "Automation script: ",
    tags: ["script", "automation"],
  });
}

function scanDocs(shitennoDir: string, now: string) {
  return scanDir(shitennoDir, now, {
    dirParts: ["docs"],
    fileFilter: (f) => isMd(f) && !f.startsWith("README"),
    idPrefix: "doc-",
    extractBase: stripMd,
    cleanName: underscoreToSpace,
    type: "doc",
    descPrefix: "Documentation: ",
    tags: ["doc", "documentation"],
  });
}

export function discoverArtifacts(shitennoDir: string): Artifact[] {
  const now = new Date().toISOString();
  return [
    ...scanAdrs(shitennoDir, now),
    ...scanSkills(shitennoDir, now),
    ...scanContracts(shitennoDir, now),
    ...scanWorkflow(shitennoDir, now),
    ...scanRunbooks(shitennoDir, now),
    ...scanPlans(shitennoDir, now),
    ...scanScripts(shitennoDir, now),
    ...scanDocs(shitennoDir, now),
  ];
}

type RelationRule = {
  sourceType: ArtifactType;
  targetFilter: (a: Artifact) => boolean;
  relationType: RelationType;
  description: string;
};

const RELATION_RULES: RelationRule[] = [
  {
    sourceType: "adr",
    targetFilter: (a) => a.type === "skill",
    relationType: "generates",
    description: "ADR generates skill",
  },
  {
    sourceType: "skill",
    targetFilter: (a) => a.type === "contract",
    relationType: "uses",
    description: "Skill uses contract",
  },
  {
    sourceType: "contract",
    targetFilter: (a) => a.type === "script",
    relationType: "executes",
    description: "Contract executes script",
  },
  {
    sourceType: "workflow",
    targetFilter: (a) => a.type === "adr",
    relationType: "references",
    description: "Workflow references ADR",
  },
  {
    sourceType: "doc",
    targetFilter: (a) => a.type === "code" || a.type === "script",
    relationType: "documents",
    description: "Doc documents code",
  },
];

function matchesAdrToSkill(artifact: Artifact, target: Artifact): boolean {
  return target.name.toLowerCase().includes(
    artifact.name.split(" ").slice(0, 2).join(" ").toLowerCase()
  );
}

function applyRules(
  artifact: Artifact,
  artifacts: Artifact[],
  rules: RelationRule[],
  now: string,
): Relation[] {
  const relations: Relation[] = [];
  for (const rule of rules) {
    if (artifact.type !== rule.sourceType) continue;
    const targets = artifacts.filter(rule.targetFilter);
    const filtered = rule.sourceType === "adr"
      ? targets.filter((t) => matchesAdrToSkill(artifact, t))
      : targets;
    for (const target of filtered) {
      relations.push({
        source: artifact.id,
        target: target.id,
        type: rule.relationType,
        description: rule.description,
        createdAt: now,
      });
    }
  }
  return relations;
}

export function discoverRelations(artifacts: Artifact[]): Relation[] {
  const now = new Date().toISOString();
  return artifacts.flatMap((artifact) =>
    applyRules(artifact, artifacts, RELATION_RULES, now)
  );
}
