/**
 * types.ts — Type definitions for Taint Analysis
 *
 * Taint analysis tracks untrusted data from sources to sinks,
 * detecting security vulnerabilities in the data flow.
 */

/** A node in the data flow graph */
export interface TaintNode {
  id: string;
  kind: "source" | "sink" | "sanitizer" | "assignment" | "parameter" | "return" | "property";
  variableName?: string;
  sourceFile: string;
  line: number;
  column: number;
  text: string;
}

/** An edge in the data flow graph */
export interface TaintEdge {
  from: string;
  to: string;
  kind: "assignment" | "parameter" | "return" | "property" | "spread";
}

/** A path from source to sink through the data flow graph */
export interface TaintPath {
  source: TaintNode;
  sink: TaintNode;
  sanitizers: TaintNode[];
  path: TaintNode[];
  isSanitized: boolean;
}

/** A detected taint issue */
export interface TaintIssue {
  type: TaintIssueType;
  severity: 1 | 2 | 3;
  description: string;
  location: string;
  sourceType: string;
  sinkType: string;
  isSanitized: boolean;
  recommendation: string;
}

/** Types of taint issues */
export type TaintIssueType =
  | "tainted_input"
  | "open_redirect"
  | "ssrf"
  | "log_injection"
  | "code_injection"
  | "command_injection"
  | "path_traversal"
  | "sql_injection"
  | "nosql_injection"
  | "xss_risk"
  | "ssti";

/** Source definition */
export interface TaintSourceDef {
  pattern: string | RegExp;
  kind: "property" | "global" | "call" | "parameter";
  description: string;
}

/** CVSS v3.1 vector components for severity calculation */
export interface CVSSVector {
  /** Attack Vector: Network/Adjacent/Physical/Local */
  AV?: "N" | "A" | "P" | "L";
  /** Attack Complexity: Low/High */
  AC?: "L" | "H";
  /** Privileges Required: None/Low/High */
  PR?: "N" | "L" | "H";
  /** User Interaction: None/Required */
  UI?: "N" | "R";
  /** Impact: Confidentiality/Integrity/Availability */
  C?: "N" | "L" | "H";
  I?: "N" | "L" | "H";
  A?: "N" | "L" | "H";
}

function lookupWeight(weights: Record<string, number>, key: string | undefined, fallback: string): number {
  return weights[key ?? fallback] ?? 0;
}

/** Derive numeric severity (1–3) from CVSS v3.1 vector */
export function cvssToSeverity(vector: CVSSVector): 1 | 2 | 3 {
  const avWeights: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
  const acWeights: Record<string, number> = { L: 0.77, H: 0.44 };
  const prWeights: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 };
  const uiWeights: Record<string, number> = { N: 0.85, R: 0.62 };
  const impactWeights: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

  const score =
    lookupWeight(avWeights, vector.AV, "N") +
    lookupWeight(acWeights, vector.AC, "L") +
    lookupWeight(prWeights, vector.PR, "N") +
    lookupWeight(uiWeights, vector.UI, "N") +
    lookupWeight(impactWeights, vector.C, "N") +
    lookupWeight(impactWeights, vector.I, "N") +
    lookupWeight(impactWeights, vector.A, "N");

  if (score >= 5) return 3;
  if (score >= 3) return 2;
  return 1;
}

/** Sink definition */
export interface TaintSinkDef {
  name: string;
  kind: "call" | "property" | "tag";
  severity: 1 | 2 | 3;
  issueType: TaintIssueType;
  description: string;
  /** Optional CVSS v3.1 vector for precise severity calculation */
  cvss?: CVSSVector;
}

/** Sanitizer definition */
export interface TaintSanitizerDef {
  name: string;
  kind: "call" | "type";
  description: string;
}
