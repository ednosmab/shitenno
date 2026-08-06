/**
 * engine/feedback/items/items.ts — Feedback Item Generators
 *
 * Generates strengths and improvements based on session outcome and tone.
 */

import type { SessionFeedbackRecord } from "../../../infrastructure/session-feedback.js";
import type { UserProfile, FeedbackTone, FeedbackItem } from "../profile.js";

export function generateSuccessStrengths(
  record: SessionFeedbackRecord,
  profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Correct outcome achieved",
      description: `Excelente! Completaste a sessão com sucesso. ${profile.architecture === "senior" ? "A tua capacidade de orientar o time é evidente." : "Estás no caminho certo."}`,
    });
  } else if (tone === "peer") {
    items.push({
      category: "strength",
      title: "Session successful",
      description: `Boa sessão. ${record.modifiedAreas && record.modifiedAreas.length > 0 ? `Áreas trabalhadas: ${record.modifiedAreas.join(", ")}.` : ""}`,
    });
  } else {
    items.push({
      category: "strength",
      title: "Outcome: success",
      description: `Sessão concluída com sucesso. ${record.durationMinutes ? `Duração: ${record.durationMinutes}min.` : ""}`,
    });
  }

  if (record.followedRecommendations) {
    items.push({
      category: "strength",
      title: "Followed recommendations",
      description: tone === "mentor"
        ? "Seguiste as recomendações do briefing — isso demonstra disciplina técnica."
        : "Briefing recommendations followed.",
    });
  }

  return items;
}

export function generateFailureStrengths(
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Identified the problem",
      description: "O facto de identificares que algo correu mal já é um passo importante. Muitos desenvolvedores ignoram os sinais.",
    });
  } else if (tone === "peer") {
    items.push({
      category: "strength",
      title: "Problem identification",
      description: "Good catch on identifying the failure point.",
    });
  } else {
    items.push({
      category: "strength",
      title: "Failure acknowledged",
      description: "Session outcome: failure. Problem identified.",
    });
  }

  return items;
}

export function generatePartialStrengths(
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "strength",
      title: "Partial progress made",
      description: "Mesmo com dificuldades, avançaste. Isso mostra resiliência.",
    });
  } else {
    items.push({
      category: "strength",
      title: "Partial progress",
      description: "Session completed with partial success.",
    });
  }

  return items;
}

export function generateFailureImprovements(
  record: SessionFeedbackRecord,
  _profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "improvement",
      title: "Verify before diagnosing",
      description: "Às vezes diagnosticamos sem verificar o estado actual.",
      whatHappened: `Sessão com outcome failure. ${record.modifiedAreas ? `Áreas afectadas: ${record.modifiedAreas.join(", ")}.` : ""}`,
      techLeadPerspective: "Antes de investigar o código, verifica: Este run está a correr o commit mais recente?",
      practicalRule: "`git log --oneline -1` + comparar com o estado actual.",
    });
  } else if (tone === "peer") {
    items.push({
      category: "improvement",
      title: "Root cause analysis",
      description: "Consider checking the current state before deep-diving into code.",
      whatHappened: `Session failed. ${record.modifiedAreas ? `Areas: ${record.modifiedAreas.join(", ")}.` : ""}`,
      practicalRule: "Check git log before debugging.",
    });
  } else {
    items.push({
      category: "improvement",
      title: "Failure analysis needed",
      description: "Session failed. Root cause analysis recommended.",
      whatHappened: `Areas affected: ${record.modifiedAreas?.join(", ") || "unknown"}.`,
    });
  }

  if (record.notes) {
    items.push({
      category: "improvement",
      title: "Notes recorded",
      description: `Nota: "${record.notes}".`,
    });
  }

  return items;
}

export function generatePartialImprovements(
  _record: SessionFeedbackRecord,
  _profile: UserProfile,
  tone: FeedbackTone
): FeedbackItem[] {
  const items: FeedbackItem[] = [];

  if (tone === "mentor") {
    items.push({
      category: "improvement",
      title: "Scope management",
      description: "O escopo pode ter crescido durante a sessão.",
      whatHappened: "Sessão parcialmente concluída.",
      techLeadPerspective: "Define limites claros antes de começar. Pergunta: 'O que é que precisa de ficar pronto hoje?'",
      practicalRule: "Timebox: define 2-3 objectivos máximos por sessão.",
    });
  } else {
    items.push({
      category: "improvement",
      title: "Scope control",
      description: "Consider setting clearer boundaries for the session.",
      practicalRule: "Set 2-3 max objectives per session.",
    });
  }

  return items;
}

export function formatAgentStrengths(
  actions: string[],
  tone: FeedbackTone,
  language: "pt" | "en"
): string {
  if (language === "en") {
    return `Agent performed well: ${actions.join("; ")}.`;
  }
  if (tone === "mentor") {
    return `O agente executou bem: ${actions.join("; ")}.`;
  }
  return `Agente: ${actions.join("; ")}.`;
}

export function formatAgentImprovements(
  missed: string[],
  tone: FeedbackTone,
  language: "pt" | "en"
): string {
  if (language === "en") {
    return `Agent could improve: ${missed.join("; ")}.`;
  }
  if (tone === "mentor") {
    return `O agente poderia melhorar: ${missed.join("; ")}.`;
  }
  return `Agente (a melhorar): ${missed.join("; ")}.`;
}
