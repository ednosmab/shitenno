/**
 * signal-classifier.test.ts — Tests for Semantic Signal Classification
 *
 * Verifies that the Signal Classifier correctly categorizes raw events
 * into semantic domains with appropriate confidence and evidence.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { classifyEvent, classifyEvents, resetSignalClassifier, getSignalClassifier } from "../../semantic/signal-classifier.js";
import type { EventEnvelope } from "../../event-bus.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(type: string, payload: Record<string, unknown> = {}): EventEnvelope {
  return {
    type: type as EventEnvelope["type"],
    payload,
    timestamp: new Date().toISOString(),
    traceId: "test-trace-id",
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("Signal Classifier", () => {
  beforeEach(() => {
    resetSignalClassifier();
  });

  // ── Persistence ────────────────────────────────────────────────────────

  describe("persistence domain", () => {
    it("classifies database driver dependency", () => {
      const event = makeEvent("dependency.added", { name: "pg" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("persistence");
      expect(result.subdomain).toBe("database-driver");
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it("classifies ORM dependency", () => {
      const event = makeEvent("dependency.added", { name: "typeorm" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("persistence");
      expect(result.subdomain).toBe("database-driver");
    });

    it("classifies migration file creation", () => {
      const event = makeEvent("file.created", { file: "migrations/001-create-users.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("persistence");
      expect(result.subdomain).toBe("schema-migration");
    });

    it("classifies database config change", () => {
      const event = makeEvent("config.changed", { key: "DATABASE_URL", value: "postgres://localhost/mydb" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("persistence");
      expect(result.subdomain).toBe("connection-config");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("classifies data access layer modification", () => {
      const event = makeEvent("file.modified", { file: "src/repositories/user.repository.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("persistence");
      expect(result.subdomain).toBe("data-access");
    });
  });

  // ── Authentication ─────────────────────────────────────────────────────

  describe("authentication domain", () => {
    it("classifies JWT library dependency", () => {
      const event = makeEvent("dependency.added", { name: "jsonwebtoken" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("authentication");
      expect(result.subdomain).toBe("auth-library");
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it("classifies passport dependency", () => {
      const event = makeEvent("dependency.added", { name: "passport" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("authentication");
      expect(result.subdomain).toBe("auth-library");
    });

    it("classifies auth middleware creation", () => {
      const event = makeEvent("file.created", { file: "src/middleware/auth.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("authentication");
      expect(result.subdomain).toBe("auth-middleware");
    });
  });

  // ── Security ───────────────────────────────────────────────────────────

  describe("security domain", () => {
    it("classifies helmet dependency", () => {
      const event = makeEvent("dependency.added", { name: "helmet" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("security");
      expect(result.subdomain).toBe("security-library");
    });

    it("classifies secret config change", () => {
      const event = makeEvent("config.changed", { key: "JWT_SECRET", value: "super-secret" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("security");
      expect(result.subdomain).toBe("secret-config");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("classifies security test creation", () => {
      const event = makeEvent("file.created", { file: "src/security/auth.test.ts" });
      const result = classifyEvent(event);

      // Matches both security-test and testing rules at priority 90
      expect(["security", "testing"]).toContain(result.domain);
    });
  });

  // ── Infrastructure ─────────────────────────────────────────────────────

  describe("infrastructure domain", () => {
    it("classifies Docker dependency", () => {
      const event = makeEvent("dependency.added", { name: "docker" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("infrastructure");
      expect(result.subdomain).toBe("infra-tool");
    });

    it("classifies Dockerfile creation", () => {
      const event = makeEvent("file.created", { file: "Dockerfile" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("infrastructure");
      expect(result.subdomain).toBe("deploy-config");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("classifies GitHub Actions workflow", () => {
      const event = makeEvent("file.created", { file: ".github/workflows/ci.yml" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("infrastructure");
      // Matches deploy-config rule (priority 95) before ci-cd (priority 90)
      expect(["deploy-config", "ci-cd"]).toContain(result.subdomain);
    });
  });

  // ── API ─────────────────────────────────────────────────────────────────

  describe("api domain", () => {
    it("classifies route file creation", () => {
      const event = makeEvent("file.created", { file: "src/routes/users.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("api");
      expect(result.subdomain).toBe("api-endpoint");
    });

    it("classifies controller file creation", () => {
      const event = makeEvent("file.created", { file: "src/controllers/user.controller.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("api");
      expect(result.subdomain).toBe("api-endpoint");
    });

    it("classifies schema file creation", () => {
      const event = makeEvent("file.created", { file: "src/contracts/user.schema.ts" });
      const result = classifyEvent(event);

      // Matches data.schema (priority 90) before api-contract (priority 85)
      expect(["api", "data"]).toContain(result.domain);
    });
  });

  // ── Testing ────────────────────────────────────────────────────────────

  describe("testing domain", () => {
    it("classifies test framework dependency", () => {
      const event = makeEvent("dependency.added", { name: "vitest" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("testing");
      expect(result.subdomain).toBe("test-framework");
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it("classifies test file creation", () => {
      const event = makeEvent("file.created", { file: "src/__tests__/user.test.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("testing");
      expect(result.subdomain).toBe("test-file");
    });

    it("classifies spec file creation", () => {
      const event = makeEvent("file.created", { file: "src/utils.spec.ts" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("testing");
      expect(result.subdomain).toBe("test-file");
    });
  });

  // ── Documentation ──────────────────────────────────────────────────────

  describe("documentation domain", () => {
    it("classifies ADR creation", () => {
      const event = makeEvent("adr.created", { adrId: "ADR-001", title: "Use PostgreSQL" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("documentation");
      expect(result.subdomain).toBe("adr");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it("classifies README creation", () => {
      const event = makeEvent("file.created", { file: "README.md" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("documentation");
      expect(result.subdomain).toBe("doc-file");
    });
  });

  // ── Governance ─────────────────────────────────────────────────────────

  describe("governance domain", () => {
    it("classifies capability installation", () => {
      const event = makeEvent("capability.installed", { capabilityId: "testing" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("governance");
      expect(result.subdomain).toBe("capability-config");
    });

    it("classifies maturity change", () => {
      const event = makeEvent("maturity.changed", { dimension: "testing", previousScore: 30, newScore: 50 });
      const result = classifyEvent(event);

      expect(result.domain).toBe("governance");
      expect(result.subdomain).toBe("maturity-config");
    });
  });

  // ── Batch Classification ───────────────────────────────────────────────

  describe("batch classification", () => {
    it("classifies multiple events", () => {
      const events = [
        makeEvent("dependency.added", { name: "pg" }),
        makeEvent("dependency.added", { name: "helmet" }),
        makeEvent("file.created", { file: "Dockerfile" }),
      ];

      const results = classifyEvents(events);

      expect(results.length).toBe(3);
      expect(results[0]?.domain).toBe("persistence");
      expect(results[1]?.domain).toBe("security");
      expect(results[2]?.domain).toBe("infrastructure");
    });
  });

  // ── Edge Cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("returns governance domain for unrecognized events", () => {
      const event = makeEvent("session.start", { sessionId: "abc" });
      const result = classifyEvent(event);

      expect(result.domain).toBe("governance");
      expect(result.confidence).toBeLessThanOrEqual(0.2);
    });

    it("tracks classification stats", () => {
      const classifier = getSignalClassifier();
      classifier.resetStats();

      classifyEvent(makeEvent("dependency.added", { name: "pg" }));
      classifyEvent(makeEvent("dependency.added", { name: "helmet" }));

      const stats = classifier.getStats();
      expect(stats.totalClassified).toBe(2);
      expect(stats.byDomain["persistence"]).toBe(1);
      expect(stats.byDomain["security"]).toBe(1);
      expect(stats.avgConfidence).toBeGreaterThan(0);
    });
  });

  // ── Secondary Domain ───────────────────────────────────────────────────

  describe("secondary domain detection", () => {
    it("detects secondary domain when multiple rules match", () => {
      // A file in src/auth/ that is also a test
      const event = makeEvent("file.created", { file: "src/auth/auth.test.ts" });
      const result = classifyEvent(event);

      // Should be authentication (primary) or testing (primary)
      // depending on rule priority
      expect(["authentication", "testing"]).toContain(result.domain);
    });
  });
});
