/**
 * signal-classifier.ts — Semantic Signal Classification Engine
 *
 * Classifies raw event signals into semantic domains using pattern matching
 * rules defined in rules.ts. Each event is classified with a domain,
 * subdomain, confidence score, and evidence trail.
 *
 * PRINCIPLE: Deterministic classification — same input always produces
 * the same output. No randomness, no LLMs, no ambiguity.
 */

import type { EventEnvelope } from "../event-bus.js";
import type {
  SemanticClassification,
  SemanticDomain,
  SignalType,
} from "./taxonomy.js";
import { SORTED_RULES } from "./rules.js";
import type { ClassificationRule } from "./taxonomy.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface SignalClassifier {
  /** Classify a single event envelope into a semantic classification. */
  classify(event: EventEnvelope): SemanticClassification;
  /** Classify a batch of event envelopes. */
  classifyBatch(events: EventEnvelope[]): SemanticClassification[];
}

export interface ClassifierStats {
  totalClassified: number;
  byDomain: Record<SemanticDomain, number>;
  avgConfidence: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Extract searchable text from event payload for regex matching. */
function extractSearchText(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      parts.push(key, value);
    } else if (typeof value === "number" || typeof value === "boolean") {
      parts.push(String(value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          parts.push(item);
        } else if (item && typeof item === "object") {
          parts.push(JSON.stringify(item));
        }
      }
    } else if (value && typeof value === "object") {
      parts.push(JSON.stringify(value));
    }
  }
  return parts.join(" ");
}

/** Extract file paths from payload for pattern matching. */
function extractFilePaths(payload: Record<string, unknown>): string[] {
  const paths: string[] = [];
  const pathKeys = ["file", "filePath", "path", "affectedFiles", "files", "filename"];

  for (const key of pathKeys) {
    const value = payload[key];
    if (typeof value === "string") {
      paths.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          paths.push(item);
        }
      }
    }
  }

  return paths;
}

/** Extract dependency names from payload. */
function extractDependencyName(payload: Record<string, unknown>): string {
  const nameKeys = ["name", "dependency", "packageName", "package", "dependencyName"];
  for (const key of nameKeys) {
    const value = payload[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

// ── Default Classifier ──────────────────────────────────────────────────────

class DefaultSignalClassifier implements SignalClassifier {
  private stats: ClassifierStats = {
    totalClassified: 0,
    byDomain: {} as Record<SemanticDomain, number>,
    avgConfidence: 0,
  };

  classify(event: EventEnvelope): SemanticClassification {
    const signal = this.eventTypeToSignal(event.type);
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    const searchText = extractSearchText(payload);
    const filePaths = extractFilePaths(payload);
    const depName = extractDependencyName(payload);

    // Combine all searchable text
    const allText = [searchText, ...filePaths, depName].join(" ");

    // Find matching rules
    const matchingRules = this.findMatchingRules(signal, allText);

    if (matchingRules.length === 0) {
      return this.unknownClassification(signal);
    }

    // Pick the best match (highest priority + confidence)
    const best = matchingRules[0]!;
    const confidence = this.calculateConfidence(best, matchingRules.length);
    const evidence = this.buildEvidence(best, allText, filePaths, depName);

    // Check for secondary domain (second-best match from different domain)
    let secondaryDomain: SemanticDomain | undefined;
    for (const rule of matchingRules.slice(1)) {
      if (rule.domain !== best.domain) {
        secondaryDomain = rule.domain;
        break;
      }
    }

    const classification: SemanticClassification = {
      domain: best.domain,
      subdomain: best.subdomain,
      confidence,
      evidence,
      signals: [signal],
      secondaryDomain,
    };

    this.updateStats(classification);
    return classification;
  }

  classifyBatch(events: EventEnvelope[]): SemanticClassification[] {
    return events.map((e) => this.classify(e));
  }

  getStats(): ClassifierStats {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      totalClassified: 0,
      byDomain: {} as Record<SemanticDomain, number>,
      avgConfidence: 0,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private eventTypeToSignal(eventType: string): SignalType {
    // Map event types to our signal types
    const mapping: Record<string, SignalType> = {
      "dependency.added": "dependency.added",
      "dependency.removed": "dependency.removed",
      "file.created": "file.created",
      "file.modified": "file.modified",
      "file.deleted": "file.deleted",
      "config.changed": "config.changed",
      "test.created": "test.created",
      "test.passed": "test.passed",
      "test.failed": "test.failed",
      "health.checked": "health.checked",
      "health.degraded": "health.degraded",
      "git.branch_changed": "git.branch_changed",
      "git.ref_updated": "git.ref_updated",
      "source.changed": "source.changed",
      "maturity.changed": "maturity.changed",
      "capability.installed": "capability.installed",
      "knowledge_debt.detected": "knowledge_debt.detected",
      "challenge.generated": "challenge.generated",
      "plan.status_changed": "plan.status_changed",
      "adr.created": "adr.created",
      "session.end": "session.end",
      "session.start": "session.start",
    };

    return mapping[eventType] ?? "source.changed";
  }

  private findMatchingRules(signal: SignalType, searchText: string): ClassificationRule[] {
    const matches: Array<{ rule: ClassificationRule; priority: number }> = [];

    for (const rule of SORTED_RULES) {
      // Check if rule applies to this signal type
      if (rule.signal !== "*" && rule.signal !== signal) continue;

      // Test regex against combined text
      if (rule.match.test(searchText)) {
        matches.push({ rule, priority: rule.priority + rule.confidenceBoost });
      }
    }

    // Sort by computed priority (highest first)
    matches.sort((a, b) => b.priority - a.priority);
    return matches.map((m) => m.rule);
  }

  private calculateConfidence(rule: ClassificationRule, matchCount: number): number {
    // Base confidence from rule's confidence boost
    let confidence = rule.confidenceBoost;

    // Boost if multiple rules agree on the same domain
    if (matchCount > 1) {
      confidence = Math.min(confidence + 0.1 * (matchCount - 1), 1);
    }

    return Math.round(confidence * 100) / 100;
  }

  private buildEvidence(
    rule: ClassificationRule,
    allText: string,
    filePaths: string[],
    depName: string
  ): string[] {
    const evidence: string[] = [rule.description];

    if (depName) {
      evidence.push(`Dependency: ${depName}`);
    }

    if (filePaths.length > 0) {
      evidence.push(`Files: ${filePaths.join(", ")}`);
    }

    // Extract the specific match from the text
    const match = allText.match(rule.match);
    if (match) {
      evidence.push(`Pattern match: "${match[0]}"`);
    }

    return evidence;
  }

  private unknownClassification(signal: SignalType): SemanticClassification {
    return {
      domain: "governance",
      subdomain: "workflow-config",
      confidence: 0.1,
      evidence: [`No classification rule matched for signal: ${signal}`],
      signals: [signal],
    };
  }

  private updateStats(classification: SemanticClassification): void {
    this.stats.totalClassified++;
    this.stats.byDomain[classification.domain] =
      (this.stats.byDomain[classification.domain] ?? 0) + 1;
    const prev = this.stats.avgConfidence;
    const n = this.stats.totalClassified;
    this.stats.avgConfidence = prev + (classification.confidence - prev) / n;
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let defaultClassifier: DefaultSignalClassifier | null = null;

/** Get or create the default SignalClassifier singleton. */
export function getSignalClassifier(): DefaultSignalClassifier {
  if (!defaultClassifier) {
    defaultClassifier = new DefaultSignalClassifier();
  }
  return defaultClassifier;
}

/** Reset the singleton (useful for tests). */
export function resetSignalClassifier(): void {
  defaultClassifier = null;
}

/** Convenience: classify a single event. */
export function classifyEvent(event: EventEnvelope): SemanticClassification {
  return getSignalClassifier().classify(event);
}

/** Convenience: classify a batch of events. */
export function classifyEvents(events: EventEnvelope[]): SemanticClassification[] {
  return getSignalClassifier().classifyBatch(events);
}
