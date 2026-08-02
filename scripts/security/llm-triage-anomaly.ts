/**
 * llm-triage-anomaly.ts — LLM-assisted triage for audit count anomalies
 *
 * Only runs when baseline-diff.ts flags anomalies. Uses a delimited LLM call
 * to assess whether a count drop is a legitimate fix or a regression.
 * Output is structured JSON for human review — never auto-approves or blocks.
 *
 * See: PLANO-UNICO-CONSOLIDADO-2026-08-01-v2.md — Phase D.22
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

interface Anomaly {
  type: string;
  before: number;
  after: number;
}

interface Verdict {
  category: string;
  assessment: "correção_provável" | "regressão_provável" | "inconclusivo";
  reasoning: string;
}

async function triage(): Promise<void> {
  const anomaliesRaw = readFileSync("/tmp/audit-anomalies.json", "utf-8");
  const anomalies: Anomaly[] = JSON.parse(anomaliesRaw);

  const changedFiles = execSync(
    "git diff --name-only origin/main...HEAD -- src/audit/",
    { encoding: "utf-8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  if (changedFiles.length === 0) {
    console.log("No changed audit files in this PR — skipping LLM triage.");
    return;
  }

  const diff = execSync(
    `git diff origin/main...HEAD -- ${changedFiles.join(" ")}`,
    { maxBuffer: 10 * 1024 * 1024, encoding: "utf-8" },
  );

  const prompt = `You are reviewing a drop in issue counts in a static security audit.
This could be (a) a legitimate false-positive fix, or (b) a regression that lost real detection.

Respond in strict JSON: {"verdicts": [{"category": string, "assessment":
"correção_provável" | "regressão_provável" | "inconclusivo", "reasoning": string (max 2
sentences, cite specific diff snippet)}]}. Do not suggest code, only assess.

Anomalies: ${JSON.stringify(anomalies)}

Diff of changed detector files in this PR:
${diff.slice(0, 8000)}`;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("⚠️  ANTHROPIC_API_KEY not set — skipping LLM triage.");
    console.log("Anomalies require manual review:");
    console.log(JSON.stringify(anomalies, null, 2));
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const text = data.content.find((b) => b.type === "text")?.text ?? "{}";
    const verdicts: Verdict[] = JSON.parse(text).verdicts ?? [];

    console.log("### Anomaly Triage (human review required)\n");
    for (const v of verdicts) {
      const icon =
        v.assessment === "regressão_provável"
          ? "🔴"
          : v.assessment === "correção_provável"
            ? "🟢"
            : "🟡";
      console.log(`${icon} **${v.category}**: ${v.assessment}`);
      console.log(`   ${v.reasoning}\n`);
    }
  } catch (error) {
    console.error("LLM triage failed:", error instanceof Error ? error.message : String(error));
    console.log("Anomalies require manual review:");
    console.log(JSON.stringify(anomalies, null, 2));
  }
}

triage();
