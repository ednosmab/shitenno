/**
 * auto-briefing.ts — Auto-generate BRIEFING.md on session start
 *
 * Subscribes to session.start and generates a fresh briefing
 * if the existing one is stale (> 30 min) or missing.
 *
 * PRINCIPLE: The briefing should always be fresh when an agent starts working.
 */

import { existsSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getEventBus } from "./event-bus.js";
import { collectContext } from "./context-collector.js";
import { briefingToMarkdown } from "./briefing.js";
import { logger } from "./logger.js";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

function isBriefingStale(briefingPath: string): boolean {
  if (!existsSync(briefingPath)) return true;
  try {
    const stat = statSync(briefingPath);
    return Date.now() - stat.mtimeMs > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}

function writeBriefing(projectRoot: string, shitennoDir: string): boolean {
  const briefingPath = join(shitennoDir, "BRIEFING.md");

  if (!isBriefingStale(briefingPath)) {
    logger.debug("auto-briefing", "Briefing is fresh, skipping generation");
    return false;
  }

  try {
    const snapshot = collectContext(projectRoot, shitennoDir);
    const markdown = briefingToMarkdown(snapshot.briefing);
    writeFileSync(briefingPath, markdown, "utf-8");
    logger.info("auto-briefing", `Briefing generated: ${briefingPath}`);
    getEventBus().publish("briefing.generated", {
      path: briefingPath,
      risk: snapshot.briefing.risks.overall,
      cacheHit: false,
    });
    return true;
  } catch (err) {
    logger.error("auto-briefing", `Failed to generate briefing: ${err}`);
    return false;
  }
}

/**
 * Initialize auto-briefing. Subscribes to session.start and
 * generates BRIEFING.md if stale or missing.
 * Returns an unsubscribe function for cleanup.
 */
export function initAutoBriefing(
  projectRoot: string,
  shitennoDir: string
): () => void {
  const bus = getEventBus();

  const unsubscribe = bus.subscribe("session.start", () => {
    try {
      writeBriefing(projectRoot, shitennoDir);
    } catch (err) {
      logger.debug("auto-briefing", `session.start handler failed: ${err}`);
    }
  });

  logger.info("auto-briefing", "Initialized — subscribed to session.start");

  return unsubscribe;
}
