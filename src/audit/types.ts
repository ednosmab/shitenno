/**
 * Audit module — Type definitions
 *
 * All shared types for the health audit system.
 *
 * @deprecated Import from specific sub-modules instead:
 *   - `./types/common.js`   → SourceFileInfo, HistoryEntry, AuditLevel
 *   - `./types/health-issue.js` → HealthIssueType, HealthIssue
 *   - `./types/governance.js` → GovernanceOptimization
 *   - `./types/audit-report.js` → HealthAuditReport
 */

export type { SourceFileInfo, HistoryEntry, AuditLevel } from "./types/common.js";
export type { HealthIssueType, HealthIssue } from "./types/health-issue.js";
export type { GovernanceOptimization } from "./types/governance.js";
export type { HealthAuditReport } from "./types/audit-report.js";
