/**
 * index.ts — Taint Analysis Module
 *
 * Public API for taint analysis in the shugo audit system.
 * Detects untrusted data flowing from sources to sinks without sanitization.
 */

export { TaintAnalyzer, type TaintAnalyzerOptions } from "./analyzer.js";
export { DataFlowGraph } from "./graph.js";
export { ALL_SOURCES, isTaintSource, HTTP_SOURCES, PROCESS_SOURCES, DOM_SOURCES } from "./sources.js";
export { ALL_SINKS, findTaintSink, getSinkNames, CODE_EXECUTION_SINKS, COMMAND_EXECUTION_SINKS, SQL_SINKS, NOSQL_SINKS, SSTI_SINKS, XSS_SINKS } from "./sinks.js";
export { ALL_SANITIZERS, isSanitizer, getSanitizerNames } from "./sanitizers.js";
export { taintIssueToHealthIssue, groupByFile, getTaintSummary } from "./reporter.js";
export type { TaintNode, TaintEdge, TaintIssue, TaintIssueType, TaintSourceDef, TaintSinkDef, TaintSanitizerDef, CVSSVector } from "./types.js";
export { cvssToSeverity } from "./types.js";
