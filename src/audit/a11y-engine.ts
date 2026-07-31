/**
 * a11y-engine.ts — Bundled accessibility engine for JSX/React projects
 *
 * Uses ESLint + jsx-a11y programmatically with embedded config,
 * independent of the host project's ESLint configuration.
 */

import type { HealthIssue, SourceFileInfo } from "./types.js";

let eslintModule: typeof import("eslint") | null = null;
let jsxA11yModule: unknown = null;

async function loadA11yEngine(): Promise<boolean> {
  try {
    eslintModule = await import("eslint");
    const mod = await import("eslint-plugin-jsx-a11y");
    jsxA11yModule = mod.default ?? mod;
    return true;
  } catch {
    // optionalDependency not installed (e.g., user ran with --no-optional,
    // or restricted environment) — degrade gracefully, don't break the audit
    return false;
  }
}

function getSkippedResult(): HealthIssue[] {
  return [{ type: "accessibility_gap", severity: 1,
    description: "Verificação de acessibilidade JSX pulada — dependência opcional eslint-plugin-jsx-a11y não disponível",
    location: "package.json", recommendation: "Rodar 'npm install' novamente ou verificar se optionalDependencies foram instaladas", confidence: 1.0 }];
}

function createESLintInstance(eslintModule: typeof import("eslint"), jsxA11yModule: unknown) {
  const { ESLint } = eslintModule;
  const a11y = jsxA11yModule as { configs?: { recommended?: { rules: Record<string, unknown> } } };
  const rules = a11y?.configs?.recommended?.rules ?? {};
  return new ESLint({ overrideConfigFile: true, baseConfig: {
    plugins: { "jsx-a11y": jsxA11yModule },
    rules,
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 2022, sourceType: "module" } },
  } } as never);
}

async function lintFileForA11yIssues(eslint: ReturnType<typeof createESLintInstance>, file: SourceFileInfo): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  try {
    const results = await eslint.lintText(file.content, { filePath: file.fullPath });
    for (const result of results) {
      for (const msg of result.messages) {
        if (msg.ruleId?.startsWith("jsx-a11y/")) {
          issues.push({ type: "accessibility_gap", severity: msg.severity === 2 ? 2 : 1,
            description: `[${msg.ruleId}] ${msg.message}`, location: `${file.relPath}:${msg.line}`,
            recommendation: `https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/${msg.ruleId.replace("jsx-a11y/", "")}.md`, confidence: 0.95 });
        }
      }
    }
  } catch { /* A malformed JSX file shouldn't break checking of others */ }
  return issues;
}

export async function detectAccessibilityGaps(_projectRoot: string, files: SourceFileInfo[]): Promise<HealthIssue[]> {
  const jsxFiles = files.filter((f) => /\.(tsx|jsx)$/.test(f.relPath));
  if (jsxFiles.length === 0) return [];
  const loaded = await loadA11yEngine();
  if (!loaded || !eslintModule) return getSkippedResult();
  const eslint = createESLintInstance(eslintModule, jsxA11yModule);
  const issues: HealthIssue[] = [];
  for (const file of jsxFiles) issues.push(...await lintFileForA11yIssues(eslint, file));
  return issues;
}
