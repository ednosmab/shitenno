import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { EngineeringState } from "./engineering-state.js";
import {
  generateSystemMap,
  generateAssetIndex,
  generateCapabilityReport,
  generateHealthReport,
  generateArchitectureOverview,
} from "./doc-engine/generators.js";

export type DocType =
  | "system-map"
  | "asset-index"
  | "capability-report"
  | "health-report"
  | "changelog"
  | "architecture-overview";

export interface DocMetadata {
  id: string;
  type: DocType;
  path: string;
  generatedAt: string;
  stateHash: string;
  stale: boolean;
}

export interface DocGenerationResult {
  generated: DocMetadata[];
  upToDate: string[];
  failed: Array<{ type: DocType; error: string }>;
}

function computeStateHash(state: EngineeringState): string {
  const payload = JSON.stringify({
    assets: state.assets.length,
    health: state.healthScores.overall,
    rules: state.activeRules,
    policies: state.activePolicies,
    consolidatedAt: state.consolidatedAt,
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}

const DOC_GENERATORS: Record<DocType, (state: EngineeringState) => string> = {
  "system-map": generateSystemMap,
  "asset-index": generateAssetIndex,
  "capability-report": generateCapabilityReport,
  "health-report": generateHealthReport,
  "architecture-overview": generateArchitectureOverview,
  "changelog": () => "# Changelog\n\n_No entries yet._",
};

const DOC_FILENAMES: Record<DocType, string> = {
  "system-map": "SYSTEM_MAP.md",
  "asset-index": "ASSET_INDEX.md",
  "capability-report": "CAPABILITY_REPORT.md",
  "health-report": "HEALTH_REPORT.md",
  "architecture-overview": "ARCHITECTURE.md",
  "changelog": "CHANGELOG.md",
};

export class DocEngine {
  private docsDir: string;
  private metadata: Map<DocType, DocMetadata> = new Map();

  constructor(shitennoDir: string) {
    this.docsDir = join(shitennoDir, "docs", "generated");
    if (!existsSync(this.docsDir)) {
      mkdirSync(this.docsDir, { recursive: true });
    }
    this.loadMetadata();
  }

  generateAll(state: EngineeringState, force = false): DocGenerationResult {
    const stateHash = computeStateHash(state);
    const result: DocGenerationResult = {
      generated: [],
      upToDate: [],
      failed: [],
    };

    const docTypes: DocType[] = [
      "system-map",
      "asset-index",
      "capability-report",
      "health-report",
      "architecture-overview",
    ];

    for (const type of docTypes) {
      const existing = this.metadata.get(type);
      if (!force && existing && existing.stateHash === stateHash && !existing.stale) {
        result.upToDate.push(type);
        continue;
      }

      try {
        const doc = this.generateDoc(type, state, stateHash);
        result.generated.push(doc);
      } catch (error) {
        result.failed.push({
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  generateDoc(type: DocType, state: EngineeringState, stateHash?: string): DocMetadata {
    const hash = stateHash ?? computeStateHash(state);
    const generator = DOC_GENERATORS[type];
    if (!generator) throw new Error(`Unknown doc type: ${type}`);

    const content = generator(state);
    const filename = DOC_FILENAMES[type];
    const filepath = join(this.docsDir, filename);
    writeFileSync(filepath, content, "utf-8");

    const metadata: DocMetadata = {
      id: `DOC-${randomUUID().slice(0, 8).toUpperCase()}`,
      type,
      path: `docs/generated/${filename}`,
      generatedAt: new Date().toISOString(),
      stateHash: hash,
      stale: false,
    };

    this.metadata.set(type, metadata);
    this.saveMetadata();

    return metadata;
  }

  getStaleDocs(state: EngineeringState): DocType[] {
    const stateHash = computeStateHash(state);
    const stale: DocType[] = [];

    for (const [type, meta] of this.metadata) {
      if (meta.stateHash !== stateHash) {
        stale.push(type);
      }
    }

    return stale;
  }

  getAllMetadata(): DocMetadata[] {
    return Array.from(this.metadata.values());
  }

  private loadMetadata(): void {
    const metaPath = join(this.docsDir, "_metadata.json");
    if (existsSync(metaPath)) {
      try {
        const data = JSON.parse(readFileSync(metaPath, "utf-8")) as DocMetadata[];
        for (const meta of data) {
          this.metadata.set(meta.type, meta);
        }
      } catch {
        // Ignore corrupt metadata
      }
    }
  }

  private saveMetadata(): void {
    const metaPath = join(this.docsDir, "_metadata.json");
    const data = Array.from(this.metadata.values());
    writeFileSync(metaPath, JSON.stringify(data, null, 2), "utf-8");
  }
}
