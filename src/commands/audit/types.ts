/**
 * commands/audit/types.ts — Shared types for audit modules
 *
 * Breaks circular dependency between audit.ts, display.ts, and handlers.ts.
 */

export interface AuditActionCtx {
  projectRoot: string;
  shitennoDir: string;
}
