/**
 * Bounded context dependency matrix.
 *
 * Business contexts may only import each other through declared edges.
 * Core (domain/shared), platform (ops) and entry (interface) contexts are
 * importable from anywhere; interface and ops may import any context.
 *
 * The declared edge set reflects the couplings that exist today. New
 * cross-context imports that are not declared here are boundary violations.
 * See docs/architecture/bounded-contexts.md for the context map.
 */
import type { SourceContext } from "../types/context-map.js";

const ALLOWED_EDGES: readonly string[] = [
  "briefing->feedback",
  "briefing->governance",
  "briefing->intelligence",
  "briefing->knowledge",
  "governance->briefing",
  "governance->intelligence",
  "governance->knowledge",
  "governance->planning",
  "intelligence->feedback",
  "intelligence->knowledge",
  "intelligence->planning",
  "intelligence->briefing",
  "feedback->governance",
  "feedback->intelligence",
  "knowledge->briefing",
  "knowledge->governance",
  "knowledge->intelligence",
  "planning->briefing",
  "planning->governance",
  "planning->intelligence",
];

export function isAllowedContextEdge(from: SourceContext, to: SourceContext): boolean {
  if (from === to) return true;
  if (from === "domain" || from === "shared") return true;
  if (from === "interface" || from === "ops") return true;
  if (to === "domain" || to === "shared" || to === "ops" || to === "interface") return true;
  return ALLOWED_EDGES.includes(`${from}->${to}`);
}
