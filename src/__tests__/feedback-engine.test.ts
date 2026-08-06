/**
 * feedback-engine.test.ts — Tests for the Personalized Feedback Engine
 *
 * Validates tone calibration, profile-based feedback generation,
 * and output formatting.
 */

import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  loadUserProfile,
  saveUserProfile,
  calibrateTone,
  generatePersonalizedFeedback,
  formatFeedbackAsMarkdown,
  type UserProfile,
} from "../application/feedback-engine.js";
import type { SessionFeedbackRecord } from "../infrastructure/session-feedback.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function createTmpDir(): string {
  const dir = join(tmpdir(), `shitenno-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createMockRecord(overrides: Partial<SessionFeedbackRecord> = {}): SessionFeedbackRecord {
  return {
    id: "SF-001",
    timestamp: "2026-07-01T10:30:00.000Z",
    outcome: "success",
    briefingHash: "abc123",
    briefingTimestamp: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

function createSeniorProfile(): UserProfile {
  return {
    name: "Edson",
    role: "Tech Lead em Formação",
    architecture: "senior",
    coding: "pleno",
    leadership: "senior",
    tone: "mentor",
    language: "pt",
    codeFreePercent: 95,
    focusAreas: ["visão", "leadership"],
  };
}

function createJuniorProfile(): UserProfile {
  return {
    name: "Developer",
    role: "Junior Developer",
    architecture: "junior",
    coding: "junior",
    leadership: "junior",
    tone: "peer",
    language: "pt",
    codeFreePercent: 30,
    focusAreas: ["código"],
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("feedback-engine", () => {
  describe("loadUserProfile", () => {
    it("returns default profile when file does not exist", () => {
      const dir = createTmpDir();
      const profile = loadUserProfile(dir);
      expect(profile.name).toBe("Developer");
      expect(profile.tone).toBe("peer");
    });

    it("loads profile from file", () => {
      const dir = createTmpDir();
      const profilePath = join(dir, "user-profile.json");
      writeFileSync(profilePath, JSON.stringify(createSeniorProfile()), "utf-8");

      const profile = loadUserProfile(dir);
      expect(profile.name).toBe("Edson");
      expect(profile.role).toBe("Tech Lead em Formação");
      expect(profile.architecture).toBe("senior");
    });

    it("returns default profile on invalid JSON", () => {
      const dir = createTmpDir();
      const profilePath = join(dir, "user-profile.json");
      writeFileSync(profilePath, "invalid json", "utf-8");

      const profile = loadUserProfile(dir);
      expect(profile.name).toBe("Developer");
    });
  });

  describe("saveUserProfile", () => {
    it("saves profile to file", () => {
      const dir = createTmpDir();
      const profile = createSeniorProfile();
      saveUserProfile(dir, profile);

      const saved = JSON.parse(readFileSync(join(dir, "user-profile.json"), "utf-8"));
      expect(saved.name).toBe("Edson");
      expect(saved.architecture).toBe("senior");
    });
  });

  describe("calibrateTone", () => {
    it("uses profile tone when set to mentor", () => {
      const profile = createSeniorProfile();
      const tone = calibrateTone(profile, "success", "senior");
      expect(tone).toBe("mentor");
    });

    it("auto-calibrates to mentor for junior on failure", () => {
      const profile = createJuniorProfile();
      profile.tone = "peer"; // force peer to test auto-calibration
      const tone = calibrateTone(profile, "failure", "junior");
      expect(tone).toBe("mentor");
    });

    it("auto-calibrates to peer for senior on success", () => {
      const profile = createSeniorProfile();
      profile.tone = "peer"; // force peer to test auto-calibration
      const tone = calibrateTone(profile, "success", "senior");
      expect(tone).toBe("peer");
    });

    it("auto-calibrates to peer for senior on failure", () => {
      const profile = createSeniorProfile();
      profile.tone = "peer"; // force peer to test auto-calibration
      const tone = calibrateTone(profile, "failure", "senior");
      expect(tone).toBe("peer");
    });
  });

  describe("generatePersonalizedFeedback", () => {
    it("generates feedback for success outcome", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();

      const feedback = generatePersonalizedFeedback(record, profile);

      expect(feedback.date).toBe("2026-07-01");
      expect(feedback.profile).toBe(profile);
      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.improvements.length).toBe(0);
      expect(feedback.metrics.length).toBeGreaterThan(0);
    });

    it("generates feedback for failure outcome", () => {
      const record = createMockRecord({ outcome: "failure" });
      const profile = createSeniorProfile();

      const feedback = generatePersonalizedFeedback(record, profile);

      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.improvements.length).toBeGreaterThan(0);
      expect(feedback.improvements[0]?.whatHappened).toBeDefined();
      expect(feedback.improvements[0]?.techLeadPerspective).toBeDefined();
    });

    it("generates feedback for partial outcome", () => {
      const record = createMockRecord({ outcome: "partial" });
      const profile = createJuniorProfile();

      const feedback = generatePersonalizedFeedback(record, profile);

      expect(feedback.strengths.length).toBeGreaterThan(0);
      expect(feedback.improvements.length).toBeGreaterThan(0);
    });

    it("includes agent performance when provided", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      const agentActions = {
        whatAgentDid: ["Provided good context", "Identified risk early"],
        whatAgentMissed: [],
      };

      const feedback = generatePersonalizedFeedback(record, profile, agentActions);

      expect(feedback.agentPerformance.strengths).toEqual(agentActions.whatAgentDid);
      expect(feedback.agentPerformance.improvements).toEqual([]);
    });

    it("calibrates tone to mentor for junior on failure", () => {
      const record = createMockRecord({ outcome: "failure" });
      const profile = createJuniorProfile();

      const feedback = generatePersonalizedFeedback(record, profile);

      // Should have mentor-style improvements
      expect(feedback.improvements[0]?.techLeadPerspective).toBeDefined();
    });

    it("calibrates tone to peer for senior", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      profile.tone = "peer";

      const feedback = generatePersonalizedFeedback(record, profile);

      // Should have peer-style strengths
      expect(feedback.strengths[0]?.description).toContain("Boa sessão");
    });
  });

  describe("formatFeedbackAsMarkdown", () => {
    it("formats feedback as markdown", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      const feedback = generatePersonalizedFeedback(record, profile);
      const markdown = formatFeedbackAsMarkdown(feedback);

      expect(markdown).toContain("# Feedback Personalizado");
      expect(markdown).toContain("## Perfil: Tech Lead em Formação");
      expect(markdown).toContain("### O que fizeste bem");
      expect(markdown).toContain("### Métricas de leadership");
      expect(markdown).toContain("| Indicador | Nota |");
    });

    it("includes improvements section when present", () => {
      const record = createMockRecord({ outcome: "failure" });
      const profile = createSeniorProfile();
      const feedback = generatePersonalizedFeedback(record, profile);
      const markdown = formatFeedbackAsMarkdown(feedback);

      expect(markdown).toContain("### O que podes melhorar");
      expect(markdown).toContain("**O que aconteceu:**");
      expect(markdown).toContain("**Como tech lead:**");
      expect(markdown).toContain("**Regra prática:**");
    });

    it("includes agent performance when present", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      const agentActions = {
        whatAgentDid: ["Provided context"],
        whatAgentMissed: ["Missed a risk"],
      };
      const feedback = generatePersonalizedFeedback(record, profile, agentActions);
      const markdown = formatFeedbackAsMarkdown(feedback);

      expect(markdown).toContain("### Performance do Agente");
      expect(markdown).toContain("Provided context");
      expect(markdown).toContain("Missed a risk");
    });

    it("includes profile information", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      const feedback = generatePersonalizedFeedback(record, profile);
      const markdown = formatFeedbackAsMarkdown(feedback);

      expect(markdown).toContain("Arquitectura: senior");
      expect(markdown).toContain("Código: pleno");
      expect(markdown).toContain("visão, leadership");
    });

    it("includes next level guidance", () => {
      const record = createMockRecord({ outcome: "success" });
      const profile = createSeniorProfile();
      const feedback = generatePersonalizedFeedback(record, profile);
      const markdown = formatFeedbackAsMarkdown(feedback);

      expect(markdown).toContain("### Próximo nível");
      expect(markdown).toContain("Continua neste ritmo");
    });
  });
});
