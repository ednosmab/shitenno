/**
 * issue-builder.ts — Taint Issue Builder
 *
 * Constructs TaintIssue objects from source-sink pairs in the data flow graph.
 * Handles sanitizer detection and issue formatting.
 */

import type { TaintNode, TaintIssue } from "./types.js";
import { cvssToSeverity } from "./types.js";
import { findTaintSink } from "./sinks.js";
import { isSanitizer } from "./sanitizers.js";
import { DataFlowGraph } from "./graph.js";

interface IssueBuilderOptions {
  maxDepth: number;
  minSeverity: 1 | 2 | 3;
  projectRoot: string;
}

function findSourceNodesReaching(
  sink: TaintNode,
  nodes: TaintNode[],
  graph: DataFlowGraph,
  maxDepth: number
): TaintNode[] {
  const reachers = graph.getReachers(sink.id, maxDepth);
  return nodes.filter((n) => n.kind === "source" && reachers.includes(n.id));
}

function checkPathHasSanitizer(
  sourceId: string,
  sinkId: string,
  graph: DataFlowGraph
): boolean {
  const pathNodes = graph.findPath(sourceId, sinkId);
  return pathNodes?.some((nodeId) => {
    const graphNode = graph.getNode(nodeId);
    return graphNode?.kind === "sanitizer" || (graphNode?.variableName ? isSanitizer(graphNode.variableName) !== undefined : false);
  }) ?? false;
}

function formatTaintDescription(
  sourceNodes: TaintNode[],
  sinkDef: ReturnType<typeof findTaintSink>,
  fallbackSinkText: string
): string {
  const sourceNames = sourceNodes.map((s) => s.variableName ?? s.text).join(", ");
  const sinkDescription = sinkDef?.description ?? fallbackSinkText;
  return `Tainted data from ${sourceNames} reaches ${sinkDescription} without sanitization`;
}

function looksLikeHtml(sinkNode: TaintNode): boolean {
  return /<[a-z][\s\S]*>/i.test(sinkNode.text);
}

function resolveSeverity(
  sinkDef: ReturnType<typeof findTaintSink>,
): 1 | 2 | 3 {
  const cvssSeverity = sinkDef?.cvss ? cvssToSeverity(sinkDef.cvss) : undefined;
  return cvssSeverity ?? sinkDef?.severity ?? 2;
}

function shouldSkipIssue(
  sink: TaintNode,
  sinkDef: ReturnType<typeof findTaintSink>,
): boolean {
  const isHttpResponseSink = ["res.send", "res.write", "res.end"].includes(sinkDef?.name ?? "");
  return isHttpResponseSink && !looksLikeHtml(sink);
}

function buildIssue(
  sink: TaintNode,
  sourceNodes: TaintNode[],
  graph: DataFlowGraph,
  options: IssueBuilderOptions
): TaintIssue | null {
  const sinkDef = findTaintSink(sink.variableName ?? "");
  if (shouldSkipIssue(sink, sinkDef)) return null;
  const hasSanitizer = checkPathHasSanitizer(sourceNodes[0]?.id ?? "", sink.id, graph);
  return {
    type: sinkDef?.issueType ?? "tainted_input",
    severity: resolveSeverity(sinkDef),
    description: formatTaintDescription(sourceNodes, sinkDef, sink.text),
    location: sink.sourceFile.replace(options.projectRoot + "/", "") + ":" + sink.line,
    sourceType: sourceNodes[0]?.variableName ?? "unknown",
    sinkType: sinkDef?.name ?? "unknown",
    isSanitized: hasSanitizer,
    recommendation: `Sanitize input before using in ${sinkDef?.name ?? "sink function"}`,
  };
}

/** Collect all taint issues from the data flow graph */
export function collectIssues(
  graph: DataFlowGraph,
  options: IssueBuilderOptions
): TaintIssue[] {
  const nodes = graph.getNodes();
  const issues: TaintIssue[] = [];
  for (const sink of nodes) {
    if (sink.kind !== "sink") continue;
    const sourceNodes = findSourceNodesReaching(sink, nodes, graph, options.maxDepth);
    if (sourceNodes.length === 0) continue;
    const issue = buildIssue(sink, sourceNodes, graph, options);
    if (issue && issue.severity >= options.minSeverity) {
      issues.push(issue);
    }
  }
  return issues;
}
