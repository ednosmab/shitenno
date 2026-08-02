/**
 * sinks.ts — Taint Sink Definitions
 *
 * Sinks are dangerous execution points where tainted data can cause
 * security vulnerabilities (code injection, command injection, etc.).
 */

import type { TaintSinkDef, TaintIssueType } from "./types.js";
import type * as ts from "typescript";

/** Code execution sinks */
export const CODE_EXECUTION_SINKS: TaintSinkDef[] = [
  { name: "eval", kind: "call", severity: 3, issueType: "code_injection", description: "eval() — Code execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "Function", kind: "call", severity: 3, issueType: "code_injection", description: "Function() — Dynamic function creation", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "new Function", kind: "call", severity: 3, issueType: "code_injection", description: "new Function() — Dynamic function creation", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "setTimeout", kind: "call", severity: 2, issueType: "code_injection", description: "setTimeout(string) — Delayed code execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "R", C: "H", I: "H", A: "N" } },
  { name: "setInterval", kind: "call", severity: 2, issueType: "code_injection", description: "setInterval(string) — Repeated code execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "R", C: "H", I: "H", A: "N" } },
];

/** Command execution sinks */
export const COMMAND_EXECUTION_SINKS: TaintSinkDef[] = [
  { name: "exec", kind: "call", severity: 3, issueType: "command_injection", description: "exec() — Shell command execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "execSync", kind: "call", severity: 3, issueType: "command_injection", description: "execSync() — Synchronous shell execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "spawn", kind: "call", severity: 2, issueType: "command_injection", description: "spawn() — Process spawning", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "spawnSync", kind: "call", severity: 2, issueType: "command_injection", description: "spawnSync() — Synchronous process spawning", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "execFile", kind: "call", severity: 2, issueType: "command_injection", description: "execFile() — File execution", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "child_process.exec", kind: "call", severity: 3, issueType: "command_injection", description: "child_process.exec() — Shell execution", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
];

/** Path traversal sinks */
export const PATH_SINKS: TaintSinkDef[] = [
  { name: "readFile", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.readFile() — File read with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "L", A: "N" } },
  { name: "readFileSync", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.readFileSync() — File read with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "L", A: "N" } },
  { name: "writeFile", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.writeFile() — File write with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "writeFileSync", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.writeFileSync() — File write with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "unlink", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.unlink() — File deletion with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "H", A: "L" } },
  { name: "createReadStream", kind: "call", severity: 2, issueType: "path_traversal", description: "fs.createReadStream() — Stream with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "L", A: "N" } },
];

/** SQL injection sinks */
export const SQL_SINKS: TaintSinkDef[] = [
  { name: "query", kind: "call", severity: 3, issueType: "sql_injection", description: "db.query() — SQL query with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "execute", kind: "call", severity: 3, issueType: "sql_injection", description: "db.execute() — SQL execution with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "raw", kind: "call", severity: 3, issueType: "sql_injection", description: "knex.raw() — Raw SQL query", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
];

/** NoSQL injection sinks (MongoDB, Mongoose, etc.)
 *  Uses bare names (find, findOne, etc.) so findTaintSink's suffix matching
 *  catches pool.find(), collection.find(), db.find(), Model.findOne(), etc.
 *  Library-prefixed variants (ejs.render, pug.render, etc.) are added for
 *  non-destructured imports. */
export const NOSQL_SINKS: TaintSinkDef[] = [
  // MongoDB native driver — bare names match via suffix
  { name: "find", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.find() — MongoDB query with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "findOne", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.findOne() — MongoDB query with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "findOneAndUpdate", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.findOneAndUpdate() — MongoDB update with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "findOneAndDelete", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.findOneAndDelete() — MongoDB delete with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "updateOne", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.updateOne() — MongoDB update with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "updateMany", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.updateMany() — MongoDB bulk update with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "deleteOne", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.deleteOne() — MongoDB delete with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "deleteMany", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.deleteMany() — MongoDB bulk delete with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "aggregate", kind: "call", severity: 3, issueType: "nosql_injection", description: "collection.aggregate() — MongoDB aggregation with dynamic pipeline", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "countDocuments", kind: "call", severity: 2, issueType: "nosql_injection", description: "collection.countDocuments() — MongoDB count with dynamic filter", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "L", A: "N" } },
  { name: "distinct", kind: "call", severity: 2, issueType: "nosql_injection", description: "collection.distinct() — MongoDB distinct with dynamic field", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "L", A: "N" } },
  // Mongoose-specific
  { name: "where", kind: "call", severity: 3, issueType: "nosql_injection", description: "Model.where() — Mongoose query with dynamic condition", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "$where", kind: "call", severity: 3, issueType: "nosql_injection", description: "$where — Mongoose JavaScript evaluation in query (RCE risk)", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
];

/** Server-Side Template Injection (SSTI) sinks
 *  Uses bare names (render, compile, renderFile) for destructured imports,
 *  plus library-prefixed names (ejs.render, pug.compile, etc.) for direct calls. */
export const SSTI_SINKS: TaintSinkDef[] = [
  // Handlebars
  { name: "handlebars.compile", kind: "call", severity: 3, issueType: "ssti", description: "handlebars.compile() — Handlebars template compilation with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  // EJS
  { name: "ejs.render", kind: "call", severity: 3, issueType: "ssti", description: "ejs.render() — EJS template rendering with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "ejs.renderFile", kind: "call", severity: 3, issueType: "ssti", description: "ejs.renderFile() — EJS file rendering with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  // Pug/Jade
  { name: "pug.render", kind: "call", severity: 3, issueType: "ssti", description: "pug.render() — Pug template rendering with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "pug.compile", kind: "call", severity: 3, issueType: "ssti", description: "pug.compile() — Pug template compilation with dynamic input", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "pug.renderFile", kind: "call", severity: 3, issueType: "ssti", description: "pug.renderFile() — Pug file rendering with dynamic path", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  // Nunjucks
  { name: "nunjucks.renderString", kind: "call", severity: 3, issueType: "ssti", description: "nunjucks.renderString() — Nunjucks rendering with dynamic template", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  // Mustache
  { name: "mustache.render", kind: "call", severity: 2, issueType: "ssti", description: "mustache.render() — Mustache template rendering", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "N", A: "N" } },
  // doT.js
  { name: "dot.template", kind: "call", severity: 2, issueType: "ssti", description: "doT.template() — doT.js template compilation", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "N", A: "N" } },
  // Bare names for destructured imports (e.g. import { render } from 'ejs')
  // NOTE: These collide with React.render(), Angular.compile(), etc.
  // Mitigated by GENERIC_SINK_PATTERNS in detector-map (confidence 0.55 instead of 0.95).
  { name: "render", kind: "call", severity: 2, issueType: "ssti", description: "render() — Generic template rendering (destructured import)", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "N", A: "N" } },
  { name: "compile", kind: "call", severity: 2, issueType: "ssti", description: "compile() — Generic template compilation (destructured import)", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "L", I: "N", A: "N" } },
  { name: "renderFile", kind: "call", severity: 3, issueType: "ssti", description: "renderFile() — File-based template rendering", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
];

/** XSS sinks */
export const XSS_SINKS: TaintSinkDef[] = [
  { name: "innerHTML", kind: "property", severity: 3, issueType: "xss_risk", description: "innerHTML — Direct HTML insertion", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "dangerouslySetInnerHTML", kind: "property", severity: 3, issueType: "xss_risk", description: "dangerouslySetInnerHTML — React HTML insertion", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "document.write", kind: "call", severity: 3, issueType: "xss_risk", description: "document.write() — Direct document write", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "outerHTML", kind: "property", severity: 3, issueType: "xss_risk", description: "outerHTML — Direct HTML replacement", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "res.send", kind: "call", severity: 2, issueType: "xss_risk", description: "res.send() — HTTP response body", cvss: { AV: "N", AC: "H", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
  { name: "res.write", kind: "call", severity: 2, issueType: "xss_risk", description: "res.write() — HTTP response chunk", cvss: { AV: "N", AC: "H", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
  { name: "res.end", kind: "call", severity: 2, issueType: "xss_risk", description: "res.end() — HTTP response end", cvss: { AV: "N", AC: "H", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
];

/** Redirect sinks */
export const REDIRECT_SINKS: TaintSinkDef[] = [
  { name: "redirect", kind: "call", severity: 2, issueType: "open_redirect", description: "res.redirect() — HTTP redirect with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
  { name: "location.href", kind: "property", severity: 2, issueType: "open_redirect", description: "location.href — Browser redirect", cvss: { AV: "N", AC: "L", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
  { name: "window.open", kind: "call", severity: 2, issueType: "open_redirect", description: "window.open() — Window open with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "R", C: "L", I: "L", A: "N" } },
];

/** Log injection sinks */
export const LOG_SINKS: TaintSinkDef[] = [
  { name: "logger.info", kind: "call", severity: 1, issueType: "log_injection", description: "logger.info() — Log with dynamic input" },
  { name: "logger.warn", kind: "call", severity: 1, issueType: "log_injection", description: "logger.warn() — Log with dynamic input" },
  { name: "logger.error", kind: "call", severity: 1, issueType: "log_injection", description: "logger.error() — Log with dynamic input" },
  { name: "console.log", kind: "call", severity: 1, issueType: "log_injection", description: "console.log() — Log with dynamic input" },
];

/** SSRF sinks (OWASP A01 — Server-Side Request Forgery) */
export const SSRF_SINKS: TaintSinkDef[] = [
  { name: "fetch", kind: "call", severity: 3, issueType: "ssrf", description: "fetch() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "axios", kind: "call", severity: 3, issueType: "ssrf", description: "axios() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "axios.get", kind: "call", severity: 3, issueType: "ssrf", description: "axios.get() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "axios.post", kind: "call", severity: 3, issueType: "ssrf", description: "axios.post() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "request", kind: "call", severity: 2, issueType: "ssrf", description: "request() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "http.get", kind: "call", severity: 2, issueType: "ssrf", description: "http.get() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "https.get", kind: "call", severity: 2, issueType: "ssrf", description: "https.get() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "http.request", kind: "call", severity: 2, issueType: "ssrf", description: "http.request() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "https.request", kind: "call", severity: 2, issueType: "ssrf", description: "https.request() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "got", kind: "call", severity: 2, issueType: "ssrf", description: "got() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "node-fetch", kind: "call", severity: 2, issueType: "ssrf", description: "node-fetch() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "undici", kind: "call", severity: 3, issueType: "ssrf", description: "undici.fetch() — HTTP request with dynamic URL (Node 18+)", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "undici.fetch", kind: "call", severity: 3, issueType: "ssrf", description: "undici.fetch() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "L", PR: "N", UI: "N", C: "H", I: "H", A: "H" } },
  { name: "undici.request", kind: "call", severity: 2, issueType: "ssrf", description: "undici.request() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "undici.get", kind: "call", severity: 2, issueType: "ssrf", description: "undici.get() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
  { name: "undici.post", kind: "call", severity: 2, issueType: "ssrf", description: "undici.post() — HTTP request with dynamic URL", cvss: { AV: "N", AC: "H", PR: "N", UI: "N", C: "H", I: "H", A: "N" } },
];

/** All sinks combined */
export const ALL_SINKS: TaintSinkDef[] = [
  ...CODE_EXECUTION_SINKS,
  ...COMMAND_EXECUTION_SINKS,
  ...PATH_SINKS,
  ...SQL_SINKS,
  ...NOSQL_SINKS,
  ...SSTI_SINKS,
  ...XSS_SINKS,
  ...REDIRECT_SINKS,
  ...LOG_SINKS,
  ...SSRF_SINKS,
];

/** Check if a function/property name matches any taint sink.
 *  Matches by exact name OR by dotted suffix (e.g. "pool.query" matches "query").
 *  When a receiver type and checker are provided, incompatible candidates are
 *  discarded (e.g. Array.prototype.find() is never a NoSQL injection sink). */
export function findTaintSink(
  name: string,
  receiverType?: ts.Type,
  checker?: ts.TypeChecker
): TaintSinkDef | undefined {
  const candidates = ALL_SINKS.filter((s) => s.name === name || name.endsWith("." + s.name));
  if (candidates.length === 0) return undefined;
  if (!receiverType || !checker) return candidates[0];
  const compatible = candidates.filter((s) => isReceiverTypeCompatible(receiverType, s, checker));
  return compatible[0] ?? undefined;
}

/**
 * Heuristic: if a receiver type is known, only accept candidates the receiver
 * could plausibly belong to. Currently only NoSQL sinks are type-sensitive —
 * Array/ReadonlyArray receivers (arr.find, list.findOne) are never NoSQL sinks.
 */
function isReceiverTypeCompatible(
  receiverType: ts.Type,
  sink: TaintSinkDef,
  checker: ts.TypeChecker
): boolean {
  if (sink.issueType !== "nosql_injection") return true;
  if (checker.isArrayType(receiverType) || checker.isTupleType(receiverType)) return false;
  const typeName = checker.typeToString(receiverType);
  return !/^(Array|ReadonlyArray)</.test(typeName) && !/\[\]$/.test(typeName);
}

/** Check if a property access name matches any property-kind taint sink.
 *  Matches the last property segment (e.g. "document.getElementById("x").innerHTML" matches "innerHTML"). */
export function findTaintPropertySink(name: string): TaintSinkDef | undefined {
  return ALL_SINKS.find((s) => {
    if (s.kind !== "property") return false;
    return name === s.name || name.endsWith("." + s.name);
  });
}

/** Get all sink names for quick lookup */
export function getSinkNames(): Set<string> {
  return new Set(ALL_SINKS.map((s) => s.name));
}

/** Get sinks by issue type */
export function getSinksByType(issueType: TaintIssueType): TaintSinkDef[] {
  return ALL_SINKS.filter((s) => s.issueType === issueType);
}
