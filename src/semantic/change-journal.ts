/**
 * change-journal.ts — Temporal History of Semantic Classifications
 *
 * Maintains a time-series journal of semantic classifications,
 * persisted as JSONL for efficient append and query.
 * Used by the Pattern Matcher to detect temporal patterns.
 *
 * PRINCIPLE: The journal is append-only — entries are never modified,
 * only added. Rotation happens at the consolidation timer.
 */

import { existsSync, appendFileSync, readFileSync, mkdirSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../logger.js";
import type { SemanticClassification, SemanticDomain, SignalType } from "./taxonomy.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface JournalEntry {
  /** Unique entry identifier */
  id: string;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Session ID that generated this entry */
  sessionId: string;
  /** Semantic classification */
  classification: SemanticClassification;
  /** Number of raw events that contributed */
  eventCount: number;
  /** File paths involved */
  files: string[];
  /** Signal types that contributed */
  signals: SignalType[];
}

export interface JournalFilter {
  /** Filter by domain */
  domain?: SemanticDomain;
  /** Filter by subdomain */
  subdomain?: string;
  /** Filter by minimum confidence */
  minConfidence?: number;
  /** Filter by signal type */
  signal?: SignalType;
  /** Filter by start time (ISO-8601) */
  since?: string;
  /** Filter by end time (ISO-8601) */
  until?: string;
  /** Maximum entries to return */
  limit?: number;
}

export interface JournalStats {
  totalEntries: number;
  byDomain: Record<string, number>;
  bySignal: Record<string, number>;
  oldestEntry: string | null;
  newestEntry: string | null;
  avgConfidence: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const MAX_JOURNAL_BYTES = 2_000_000; // 2MB
const JOURNAL_FILE = "change-journal.jsonl";

// ── Journal Implementation ──────────────────────────────────────────────────

export class ChangeJournal {
  private entries: JournalEntry[] = [];
  private journalPath: string;
  private sessionId: string;

  constructor(shitennoDir: string, sessionId: string) {
    this.journalPath = join(shitennoDir, "governance", JOURNAL_FILE);
    this.sessionId = sessionId;
    this.load();
  }

  /** Add a new entry to the journal. */
  add(classification: SemanticClassification, eventCount: number, files: string[], signals: SignalType[]): JournalEntry {
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      classification,
      eventCount,
      files,
      signals,
    };

    this.entries.push(entry);
    this.persist(entry);
    this.rotateIfNeeded();

    return entry;
  }

  /** Query entries with filters. */
  query(filter: JournalFilter): JournalEntry[] {
    let results = [...this.entries];

    if (filter.domain) {
      results = results.filter((e) => e.classification.domain === filter.domain);
    }
    if (filter.subdomain) {
      results = results.filter((e) => e.classification.subdomain === filter.subdomain);
    }
    if (filter.minConfidence !== undefined) {
      results = results.filter((e) => e.classification.confidence >= filter.minConfidence!);
    }
    if (filter.signal) {
      results = results.filter((e) => e.signals.includes(filter.signal!));
    }
    if (filter.since) {
      const since = new Date(filter.since).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() >= since);
    }
    if (filter.until) {
      const until = new Date(filter.until).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() <= until);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter.limit) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /** Get entries from the last N sessions. */
  getWindow(domain: SemanticDomain, windowSessions: number): JournalEntry[] {
    // Get unique session IDs in chronological order
    const sessionIds = [...new Set(this.entries.map((e) => e.sessionId))];
    const recentSessions = sessionIds.slice(-windowSessions);

    return this.entries.filter(
      (e) => recentSessions.includes(e.sessionId) && e.classification.domain === domain
    );
  }

  /** Get all entries. */
  getAll(): JournalEntry[] {
    return [...this.entries];
  }

  /** Get journal statistics. */
  getStats(): JournalStats {
    const byDomain: Record<string, number> = {};
    const bySignal: Record<string, number> = {};
    let totalConfidence = 0;

    for (const entry of this.entries) {
      byDomain[entry.classification.domain] = (byDomain[entry.classification.domain] ?? 0) + 1;
      for (const signal of entry.signals) {
        bySignal[signal] = (bySignal[signal] ?? 0) + 1;
      }
      totalConfidence += entry.classification.confidence;
    }

    return {
      totalEntries: this.entries.length,
      byDomain,
      bySignal,
      oldestEntry: this.entries[0]?.timestamp ?? null,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp ?? null,
      avgConfidence: this.entries.length > 0 ? totalConfidence / this.entries.length : 0,
    };
  }

  /** Clear the journal. */
  clear(): void {
    this.entries = [];
    try {
      unlinkSync(this.journalPath);
    } catch {
      // File may not exist
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private load(): void {
    if (!existsSync(this.journalPath)) return;

    try {
      const content = readFileSync(this.journalPath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as JournalEntry;
          if (entry.id && entry.timestamp && entry.classification) {
            this.entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }
    } catch (err) {
      logger.warn("change-journal", `Failed to load journal: ${err}`);
    }
  }

  private persist(entry: JournalEntry): void {
    try {
      const dir = join(this.journalPath, "..");
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      appendFileSync(this.journalPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch (err) {
      logger.warn("change-journal", `Failed to persist entry: ${err}`);
    }
  }

  private rotateIfNeeded(): void {
    try {
      if (!existsSync(this.journalPath)) return;
      const stat = statSync(this.journalPath);
      if (stat.size < MAX_JOURNAL_BYTES) return;

      // Keep only the last 50% of entries
      const halfIndex = Math.floor(this.entries.length / 2);
      this.entries = this.entries.slice(halfIndex);

      // Rewrite the file
      const content = this.entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      writeFileSync(this.journalPath, content, "utf-8");

      logger.debug("change-journal", `Rotated journal: kept ${this.entries.length} entries`);
    } catch (err) {
      logger.warn("change-journal", `Failed to rotate journal: ${err}`);
    }
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────

let defaultJournal: ChangeJournal | null = null;

export function getChangeJournal(shitennoDir: string, sessionId?: string): ChangeJournal {
  if (!defaultJournal) {
    defaultJournal = new ChangeJournal(shitennoDir, sessionId ?? "default");
  }
  return defaultJournal;
}

export function resetChangeJournal(): void {
  defaultJournal = null;
}
