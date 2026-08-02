import type { SemanticDomain } from "./taxonomy.js";
import type { JournalEntry, ChangeJournal } from "./change-journal.js";

export type PatternType =
  | "architectural_shift"
  | "scope_drift"
  | "security_degradation"
  | "tech_debt_accumulation"
  | "capability_gap"
  | "maturity_regression";

export interface DetectedPattern {
  id: string;
  type: PatternType;
  domain: SemanticDomain;
  domains: SemanticDomain[];
  confidence: number;
  description: string;
  signals: string[];
  suggestedActions: string[];
  detectedAt: string;
  windowSessions: number;
  evidence: JournalEntry[];
}

export interface PatternRule {
  type: PatternType;
  name: string;
  description: string;
  condition: (journal: ChangeJournal, windowSessions: number) => DetectedPattern | null;
}

function generatePatternId(type: PatternType, domain: string): string {
  return `${type}-${domain}-${Date.now()}`;
}

function countSignals(entries: JournalEntry[]): string[] {
  const signals = new Set<string>();
  for (const entry of entries) {
    for (const signal of entry.signals) {
      signals.add(signal);
    }
  }
  return [...signals];
}

function countDomains(entries: JournalEntry[]): SemanticDomain[] {
  return [...new Set(entries.map((e) => e.classification.domain))];
}

export const PATTERN_RULES_DATA: PatternRule[] = [
  // ── Architectural Shift ────────────────────────────────────────────────
  {
    type: "architectural_shift",
    name: "Mudança Arquitetural",
    description: "Múltiplos sinais no mesmo domínio indicam mudança arquitetural significativa",
    condition: (journal, windowSessions) => {
      const domains: SemanticDomain[] = ["persistence", "authentication", "api", "infrastructure", "frontend"];

      for (const domain of domains) {
        const entries = journal.getWindow(domain, windowSessions);
        if (entries.length >= 3) {
          const confidence = Math.min(entries.length / (windowSessions * 2), 1);
          return {
            id: generatePatternId("architectural_shift", domain),
            type: "architectural_shift",
            domain,
            domains: [domain],
            confidence,
            description: `${entries.length} sinais de "${domain}" detectados nas últimas ${windowSessions} sessões`,
            signals: countSignals(entries),
            suggestedActions: [
              `Rever decisões arquiteturais em ${domain}`,
              "Considerar criar ADR se a mudança for permanente",
              "Verificar se testes cobrem as alterações",
            ],
            detectedAt: new Date().toISOString(),
            windowSessions,
            evidence: entries.slice(0, 10),
          };
        }
      }
      return null;
    },
  },

  // ── Scope Drift ────────────────────────────────────────────────────────
  {
    type: "scope_drift",
    name: "Drift de Escopo",
    description: "Novos domínios semânticos aparecem além do escopo original do projecto",
    condition: (journal, windowSessions) => {
      const recentEntries = journal.query({ limit: 50 });
      if (recentEntries.length < 5) return null;

      const currentDomains = countDomains(recentEntries);
      const lowConfidenceDomains = recentEntries.filter(
        (e) => e.classification.confidence < 0.5
      );
      const lowConfDomains = countDomains(lowConfidenceDomains);

      if (lowConfDomains.length >= 3 && currentDomains.length >= 4) {
        return {
          id: generatePatternId("scope_drift", "multi"),
          type: "scope_drift",
          domain: lowConfDomains[0] ?? "governance",
          domains: lowConfDomains,
          confidence: Math.min(lowConfDomains.length / 5, 0.8),
          description: `${lowConfDomains.length} domínios com classificação incerta — possível drift de escopo`,
          signals: countSignals(recentEntries),
          suggestedActions: [
            "Rever o escopo original do projecto",
            "Verificar se novos módulos estão alinhados com o objectivo",
            "Considerar definir limites de domínio",
          ],
          detectedAt: new Date().toISOString(),
          windowSessions,
          evidence: lowConfidenceDomains.slice(0, 10),
        };
      }
      return null;
    },
  },

  // ── Security Degradation ───────────────────────────────────────────────
  {
    type: "security_degradation",
    name: "Degradação de Segurança",
    description: "Acumulação de sinais de segurança sem testes correspondentes",
    condition: (journal, windowSessions) => {
      const securityEntries = journal.getWindow("security", windowSessions);
      const testingEntries = journal.getWindow("testing", windowSessions);

      if (securityEntries.length >= 2 && testingEntries.length === 0) {
        return {
          id: generatePatternId("security_degradation", "security"),
          type: "security_degradation",
          domain: "security",
          domains: ["security", "testing"],
          confidence: Math.min(securityEntries.length / 4, 0.9),
          description: `${securityEntries.length} mudanças de segurança sem testes correspondentes`,
          signals: countSignals(securityEntries),
          suggestedActions: [
            "Adicionar testes de segurança",
            "Rever vulnerabilidades potenciais",
            "Considerar security audit",
          ],
          detectedAt: new Date().toISOString(),
          windowSessions,
          evidence: securityEntries.slice(0, 10),
        };
      }
      return null;
    },
  },

  // ── Tech Debt Accumulation ─────────────────────────────────────────────
  {
    type: "tech_debt_accumulation",
    name: "Acumulação de Dívida Técnica",
    description: "Múltiplas alterações sem melhorias de testes ou documentação",
    condition: (journal, windowSessions) => {
      const allEntries = journal.query({ limit: 30 });
      if (allEntries.length < 5) return null;

      const testingDocs = allEntries.filter(
        (e) => e.classification.domain === "testing" || e.classification.domain === "documentation"
      );
      const otherEntries = allEntries.filter(
        (e) => e.classification.domain !== "testing" && e.classification.domain !== "documentation"
      );

      if (otherEntries.length >= 5 && testingDocs.length <= 1) {
        return {
          id: generatePatternId("tech_debt_accumulation", "multi"),
          type: "tech_debt_accumulation",
          domain: "governance",
          domains: ["testing", "documentation"],
          confidence: Math.min(otherEntries.length / (testingDocs.length + 1) / 5, 0.85),
          description: `${otherEntries.length} alterações vs ${testingDocs.length} melhorias de qualidade`,
          signals: countSignals(allEntries),
          suggestedActions: [
            "Dedicar tempo a testes e documentação",
            "Rever dívida técnica acumulada",
            "Considerar sprint de qualidade",
          ],
          detectedAt: new Date().toISOString(),
          windowSessions,
          evidence: allEntries.slice(0, 10),
        };
      }
      return null;
    },
  },

  // ── Capability Gap ─────────────────────────────────────────────────────
  {
    type: "capability_gap",
    name: "Gap de Capacidade",
    description: "Actividade num domínio sem a capacidade governance correspondente",
    condition: (journal, windowSessions) => {
      const domains: SemanticDomain[] = ["persistence", "authentication", "security", "infrastructure"];

      for (const domain of domains) {
        const entries = journal.getWindow(domain, windowSessions);
        const governanceEntries = journal.getWindow("governance", windowSessions);

        if (entries.length >= 2 && governanceEntries.length === 0) {
          return {
            id: generatePatternId("capability_gap", domain),
            type: "capability_gap",
            domain,
            domains: [domain, "governance"],
            confidence: Math.min(entries.length / 3, 0.8),
            description: `Actividade em "${domain}" sem governança correspondente`,
            signals: countSignals(entries),
            suggestedActions: [
              `Instalar capacidade de ${domain} se necessário`,
              "Rever maturidade do domínio",
              "Considerar ADR para decisões em aberto",
            ],
            detectedAt: new Date().toISOString(),
            windowSessions,
            evidence: entries.slice(0, 10),
          };
        }
      }
      return null;
    },
  },

  // ── Maturity Regression ────────────────────────────────────────────────
  {
    type: "maturity_regression",
    name: "Regressão de Maturidade",
    description: "Actividade sugere diminuição de maturidade",
    condition: (journal, windowSessions) => {
      const allEntries = journal.query({ limit: 20 });
      if (allEntries.length < 3) return null;

      const highSeverity = allEntries.filter(
        (e) => e.classification.confidence > 0.8 && e.classification.domain !== "governance"
      );
      const governance = allEntries.filter((e) => e.classification.domain === "governance");

      if (highSeverity.length >= 3 && governance.length === 0) {
        return {
          id: generatePatternId("maturity_regression", "multi"),
          type: "maturity_regression",
          domain: "governance",
          domains: [...new Set(highSeverity.map((e) => e.classification.domain))],
          confidence: Math.min(highSeverity.length / 5, 0.85),
          description: `${highSeverity.length} alterações de alta confiança sem governance`,
          signals: countSignals(allEntries),
          suggestedActions: [
            "Rever nível de maturidade actual",
            "Verificar se capabilities estão instaladas",
            "Considerar executar shugo audit",
          ],
          detectedAt: new Date().toISOString(),
          windowSessions,
          evidence: highSeverity.slice(0, 10),
        };
      }
      return null;
    },
  },
];
