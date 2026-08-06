import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../shared/logger.js";
import type { Artifact, Relation } from "./types.js";

const GRAPH_DIR = "governance/knowledge-graph";
const ARTIFACTS_FILE = "artifacts.jsonl";
const RELATIONS_FILE = "relations.jsonl";

function loadJsonLines<T>(filepath: string): T[] {
  if (!existsSync(filepath)) return [];

  try {
    const content = readFileSync(filepath, "utf-8").trim();
    if (!content) return [];
    
    return content.split("\n").map((line) => JSON.parse(line) as T);
  } catch (err) {
    logger.debug("knowledge-graph", `Cannot load JSON Lines: ${err}`);
    return [];
  }
}

function appendJsonLine<T>(filepath: string, entry: T): void {
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(filepath, line, "utf-8");
}

export function loadArtifacts(shitennoDir: string): Artifact[] {
  const filepath = join(shitennoDir, GRAPH_DIR, ARTIFACTS_FILE);
  return loadJsonLines<Artifact>(filepath);
}

export function loadRelations(shitennoDir: string): Relation[] {
  const filepath = join(shitennoDir, GRAPH_DIR, RELATIONS_FILE);
  return loadJsonLines<Relation>(filepath);
}

export function saveArtifacts(shitennoDir: string, artifacts: Artifact[]): void {
  const dir = join(shitennoDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, ARTIFACTS_FILE);
  writeFileSync(filepath, artifacts.map((a) => JSON.stringify(a)).join("\n") + "\n", "utf-8");
}

export function saveRelations(shitennoDir: string, relations: Relation[]): void {
  const dir = join(shitennoDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, RELATIONS_FILE);
  writeFileSync(filepath, relations.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
}

export function appendArtifact(shitennoDir: string, artifact: Artifact): void {
  const dir = join(shitennoDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, ARTIFACTS_FILE);
  appendJsonLine(filepath, artifact);
}

export function appendRelation(shitennoDir: string, relation: Relation): void {
  const dir = join(shitennoDir, GRAPH_DIR);
  if (!existsSync(dir)) return;

  const filepath = join(dir, RELATIONS_FILE);
  appendJsonLine(filepath, relation);
}
