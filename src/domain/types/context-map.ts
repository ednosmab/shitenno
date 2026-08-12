/**
 * Bounded context registry — single source of truth for module→context mapping.
 *
 * Every source module in this repository belongs to exactly one bounded context.
 * The registry drives `context-boundary` analysis and the architecture score.
 * See docs/architecture/bounded-contexts.md for the context map.
 */

export type BoundedContext =
  | "governance"
  | "intelligence"
  | "planning"
  | "briefing"
  | "feedback"
  | "knowledge"
  | "ops"
  | "interface";

export type CoreContext = "domain" | "shared";

export type SourceContext = BoundedContext | CoreContext;

export const BOUNDED_CONTEXTS: readonly BoundedContext[] = [
  "governance",
  "intelligence",
  "planning",
  "briefing",
  "feedback",
  "knowledge",
  "ops",
  "interface",
];

/** Top-level src directories mapped to their context. */
const DIR_CONTEXTS: Record<string, BoundedContext> = {
  "action-engine": "planning",
  audit: "intelligence",
  "backlog-writer": "planning",
  "capability-engine": "governance",
  "challenge-responder": "feedback",
  commands: "interface",
  console: "interface",
  "context-buffer-writer": "briefing",
  "context-collector": "briefing",
  daemon: "ops",
  "daemon-client": "ops",
  "decision-core": "intelligence",
  "doc-engine": "knowledge",
  engine: "feedback",
  "engineering-state": "governance",
  "event-payloads": "ops",
  feedback: "feedback",
  governance: "governance",
  handbook: "knowledge",
  "help-data": "interface",
  "inference-engine": "intelligence",
  interface: "interface",
  "knowledge-debt": "intelligence",
  "knowledge-graph": "knowledge",
  "markdown-plan-engine": "planning",
  "maturity-profile": "governance",
  "mcp-handlers": "interface",
  "pattern-detector": "intelligence",
  "performance-reporter": "ops",
  pipeline: "planning",
  plan: "planning",
  "plan-backlog-sync": "planning",
  planning: "planning",
  prioritization: "intelligence",
  reporter: "ops",
  "rule-engine": "governance",
  scaffold: "ops",
  semantic: "intelligence",
  "state-manager": "governance",
};

/** Application-layer facades mapped to the context they expose. */
const APPLICATION_FACADES: Record<string, BoundedContext> = {
  "action-engine": "planning",
  "auto-briefing": "briefing",
  "auto-evolution": "intelligence",
  "backlog-core": "planning",
  "backlog-state-machine": "planning",
  "backlog-writer": "planning",
  briefing: "briefing",
  "briefing-injection": "briefing",
  "briefing-manifest": "briefing",
  "briefing-types": "briefing",
  "capability-engine": "governance",
  "challenge-generator": "feedback",
  "context-buffer-writer": "briefing",
  "context-collector": "briefing",
  "doc-lifecycle-auditor": "knowledge",
  "engineering-state": "governance",
  "feedback-engine": "feedback",
  "feedback-loops": "feedback",
  "health-auditor": "governance",
  "inference-engine": "intelligence",
  "knowledge-debt": "intelligence",
  "maturity-profile": "governance",
  "performance-reporter": "ops",
  pipeline: "planning",
  "plan-backlog-sync": "planning",
  "plan-lifecycle": "planning",
  "resource-claims": "planning",
  "rule-engine": "governance",
  scorer: "intelligence",
  "state-manager": "governance",
};

/** Infrastructure-layer flat files mapped to their context. */
const INFRASTRUCTURE_FILES: Record<string, BoundedContext> = {
  "advanced-infrastructure": "ops",
  analyser: "intelligence",
  "analyser-package": "intelligence",
  "analyser-stack": "intelligence",
  "analyser-structure": "intelligence",
  "analyser-tooling": "intelligence",
  "buffer-checkpoint": "ops",
  "context-boundary": "ops",
  "backlog-parser": "planning",
  "briefing-cache": "briefing",
  cache: "ops",
  "challenge-responder": "feedback",
  "complexity-detector": "intelligence",
  "daemon-circuit-breaker": "ops",
  "daemon-client": "ops",
  "dead-letter": "ops",
  "desktop-notifier": "ops",
  "doc-engine": "knowledge",
  "doc-semantic-sync": "knowledge",
  "doc-sync-hook": "knowledge",
  "dynamic-rules": "governance",
  "event-bus": "ops",
  "event-replayer": "ops",
  "events-data": "ops",
  "exec-async": "ops",
  "git-hooks-installer": "ops",
  "growth-profile": "ops",
  "knowledge-graph": "knowledge",
  "knowledge-loader": "knowledge",
  manifest: "ops",
  "markdown-plan-engine": "planning",
  "mcp-cache": "ops",
  "model-config": "ops",
  notify: "ops",
  "pattern-detector": "intelligence",
  "plan-backlog-sync-cooldown": "planning",
  "plan-backlog-sync-lock": "planning",
  "plugin-system": "ops",
  "policy": "ops",
  "proactive-digest": "briefing",
  "project-fingerprint": "intelligence",
  "pipeline-runner": "governance",
  "risk-map": "intelligence",
  "rule-loader": "governance",
  "rule-manifest": "governance",
  scaffolder: "ops",
  "semantic-drift-detector": "intelligence",
  "session-feedback": "feedback",
  "session-tracker": "briefing",
  "shitenno-state-machine": "governance",
  "skill-io": "knowledge",
  "skill-manifest": "knowledge",
  "usage-tracker": "ops",
  utils: "ops",
  "validation-pipeline": "governance",
  validation: "governance",
  "verification-lock": "planning",
  versioning: "ops",
};

function baseName(modulePath: string): string {
  const parts = modulePath.split("/");
  return parts[parts.length - 1]!.replace(/\.(ts|tsx|js|jsx)$/, "");
}

/** File-level context overrides for top-level modules that diverge from their directory.
 *  e.g. the proactive engine in prioritization/ generates challenges, so it belongs
 *  to the feedback context like challenge-generator. */
const FILE_CONTEXTS: Record<string, BoundedContext> = {
  "prioritization/triggers": "feedback",
};

/**
 * Resolves the context of a module path relative to the project root,
 * e.g. "src/rule-engine/engine.ts". Returns null when the module is not mapped.
 */
export function contextOfModule(modulePath: string): SourceContext | null {
  const parts = modulePath.split("/");
  const first = parts[0];
  if (first === "src") parts.shift();
  if (parts.length === 0) return null;

  const dir = parts[0]!.replace(/\.tsx?$/, "");
  if (dir === "domain") return "domain";
  if (dir === "shared") return "shared";

  if (dir === "application") {
    if (parts.length === 2) return APPLICATION_FACADES[baseName(modulePath)] ?? null;
    return "ops";
  }
  if (dir === "infrastructure") {
    if (parts.length === 2) return INFRASTRUCTURE_FILES[baseName(modulePath)] ?? null;
    return "ops";
  }
  if (parts.length === 2) {
    const fileOverride = FILE_CONTEXTS[`${dir}/${baseName(modulePath)}`];
    if (fileOverride) return fileOverride;
  }
  return DIR_CONTEXTS[dir] ?? null;
}
