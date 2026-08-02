/**
 * sources.ts — Taint Source Definitions
 *
 * Sources are entry points where untrusted data enters the application.
 * These are the starting points for taint propagation.
 */

import type { TaintSourceDef } from "./types.js";

/** Express/Koa/Fastify HTTP request properties */
export const HTTP_SOURCES: TaintSourceDef[] = [
  { pattern: /^req\.body$/, kind: "property", description: "req.body — HTTP request body" },
  { pattern: /^req\.query$/, kind: "property", description: "req.query — URL query parameters" },
  { pattern: /^req\.params$/, kind: "property", description: "req.params — URL path parameters" },
  { pattern: /^req\.headers$/, kind: "property", description: "req.headers — HTTP request headers" },
  { pattern: /^req\.cookies$/, kind: "property", description: "req.cookies — HTTP cookies" },
  { pattern: /^req\.files$/, kind: "property", description: "req.files — Uploaded files" },
  { pattern: /^req\.file$/, kind: "property", description: "req.file — Single uploaded file" },
];

/** Node.js process and global sources */
export const PROCESS_SOURCES: TaintSourceDef[] = [
  { pattern: /^process\.argv$/, kind: "global", description: "process.argv — Command line arguments" },
  { pattern: /^process\.env$/, kind: "global", description: "process.env — Environment variables" },
  { pattern: /^process\.env\.\w+$/, kind: "global", description: "process.env.X — Environment variable" },
];

/** DOM/browser sources */
export const DOM_SOURCES: TaintSourceDef[] = [
  { pattern: /^window\.location$/, kind: "property", description: "window.location — Browser URL" },
  { pattern: /^document\.URL$/, kind: "property", description: "document.URL — Document URL" },
  { pattern: /^document\.referrer$/, kind: "property", description: "document.referrer — Referrer URL" },
  { pattern: /^location\.href$/, kind: "property", description: "location.href — Current URL" },
];

/** WebSocket sources */
export const WS_SOURCES: TaintSourceDef[] = [
  { pattern: /^socket\.data$/, kind: "property", description: "socket.data — WebSocket message data" },
  { pattern: /^message$/, kind: "property", description: "message — Event message data" },
];

/** Database query results (indirect sources) */
export const DB_SOURCES: TaintSourceDef[] = [
  { pattern: /^result\.rows$/, kind: "property", description: "result.rows — Database query result" },
  { pattern: /^row$/, kind: "property", description: "row — Database row" },
];

/** File system sources */
export const FS_SOURCES: TaintSourceDef[] = [
  { pattern: /^readFileSync$/, kind: "call", description: "readFileSync() — File content" },
  { pattern: /^readFile$/, kind: "call", description: "readFile() — File content (async)" },
];

/** Commander.js CLI sources */
export const CLI_SOURCES: TaintSourceDef[] = [
  { pattern: /^opts$/, kind: "parameter", description: "opts — Commander.js parsed CLI options" },
  { pattern: /^options$/, kind: "parameter", description: "options — Commander.js parsed CLI options" },
];

/** GraphQL resolver sources (args, context, info) */
export const GRAPHQL_SOURCES: TaintSourceDef[] = [
  { pattern: /^args$/, kind: "parameter", description: "args — GraphQL resolver arguments (user-controlled input)" },
  { pattern: /^args\.\w+$/, kind: "parameter", description: "args.X — GraphQL resolver argument property" },
  { pattern: /^context$/, kind: "parameter", description: "context — GraphQL resolver context (may contain user data)" },
  { pattern: /^info$/, kind: "parameter", description: "info — GraphQL resolver info object" },
  { pattern: /^parent$/, kind: "parameter", description: "parent — GraphQL resolver parent object (contains DB data)" },
  { pattern: /^root$/, kind: "parameter", description: "root — GraphQL resolver root value" },
];

/** File upload sources (multer, formidable, busboy, etc.) */
export const UPLOAD_SOURCES: TaintSourceDef[] = [
  { pattern: /^file\.originalname$/, kind: "property", description: "file.originalname — Uploaded file original name" },
  { pattern: /^file\.filename$/, kind: "property", description: "file.filename — Uploaded file stored filename" },
  { pattern: /^file\.path$/, kind: "property", description: "file.path — Uploaded file path on disk" },
  { pattern: /^file\.mimetype$/, kind: "property", description: "file.mimetype — Uploaded file MIME type" },
  { pattern: /^uploadedFile$/, kind: "property", description: "uploadedFile — Upload object (generic)" },
];

/** All sources combined */
export const ALL_SOURCES: TaintSourceDef[] = [
  ...HTTP_SOURCES,
  ...PROCESS_SOURCES,
  ...DOM_SOURCES,
  ...WS_SOURCES,
  ...DB_SOURCES,
  ...FS_SOURCES,
  ...CLI_SOURCES,
  ...GRAPHQL_SOURCES,
  ...UPLOAD_SOURCES,
];

/** Check if a variable/expression matches any taint source */
export function isTaintSource(name: string): TaintSourceDef | undefined {
  return ALL_SOURCES.find((s) => {
    if (s.pattern instanceof RegExp) {
      // Accept both the full object (req.query) and subproperty access (req.query.cmd)
      const base = s.pattern.source.replace(/^\^/, "").replace(/\$$/, "");
      return new RegExp(`^${base}(\\.\\w+)*$`).test(name);
    }
    return s.pattern === name;
  });
}
