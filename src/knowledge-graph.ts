/**
 * knowledge-graph.ts — Pilar 6: Knowledge Graph
 *
 * Thin facade — all logic split into knowledge-graph/ modules.
 */

export type {
  ArtifactType,
  RelationType,
  Artifact,
  Relation,
  GraphAnalysis,
} from "./knowledge-graph/types.js";

export {
  loadArtifacts,
  loadRelations,
  saveArtifacts,
  saveRelations,
} from "./knowledge-graph/storage.js";

export { discoverArtifacts, discoverRelations } from "./knowledge-graph/discovery.js";
export { analyzeGraph } from "./knowledge-graph/analysis.js";
export { graphToText } from "./knowledge-graph/visualization.js";

import { discoverArtifacts, discoverRelations } from "./knowledge-graph/discovery.js";
import { saveArtifacts, saveRelations } from "./knowledge-graph/storage.js";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getEventBus, type ShitennoEventType } from "./event-bus.js";
import { logger } from "./logger.js";

function rebuildGraph(shitennoDir: string): void {
  const artifacts = discoverArtifacts(shitennoDir);
  const relations = discoverRelations(artifacts);
  saveArtifacts(shitennoDir, artifacts);
  saveRelations(shitennoDir, relations);
}

/** Ensure the knowledge graph directory exists. */
function ensureGraphDir(shitennoDir: string): void {
  const dir = join(shitennoDir, "governance", "knowledge-graph");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/** Perform initial graph persistence (call once at startup). */
export function initializeKnowledgeGraph(shitennoDir: string): void {
  ensureGraphDir(shitennoDir);
  rebuildGraph(shitennoDir);
  logger.info("knowledge-graph", "Initial graph persistence completed");

  const bus = getEventBus();
  const eventTypes: ShitennoEventType[] = [
    "adr.created",
    "skill.created",
    "capability.installed",
  ];
  for (const eventType of eventTypes) {
    bus.subscribe(eventType, () => {
      rebuildGraph(shitennoDir);
    });
  }
}
