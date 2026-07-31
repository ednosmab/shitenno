import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["dist/", "node_modules/", "src/templates/", "src/__tests__/", "shitenno/", "src/audit/__fixtures__/"],
  },
  {
    files: ["src/**/*.ts", "bin/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "no-console": "off",
      "prefer-const": "warn",
      "no-var": "error",
      "no-restricted-globals": ["error", "__dirname", "__filename"],
      // Prevent hardcoding "shitenno" — use SHITENNO_DIR_NAME from src/constants.ts
      "no-restricted-syntax": ["error", {
        selector: "Literal[value='shitenno']",
        message: "Use SHITENNO_DIR_NAME from src/constants.ts instead of hardcoding 'shitenno'.",
      }],
      "max-lines-per-function": ["warn", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 4],
      "complexity": ["warn", 15],
    },
  },
  // Commands must not read filesystem directly — use getEngineeringState()
  {
    files: ["src/commands/*.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "node:fs",
          message: "Commands must not read filesystem directly. Use getEngineeringState() from engineering-state-access.ts.",
        }],
      }],
    },
  },
  // Exceptions: infrastructure modules that own filesystem access
  {
    files: [
      "src/engineering-state.ts",
      "src/maturity-profile.ts",
      "src/state-manager.ts",
      "src/analyser.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Exception: constants.ts is where SHITENNO_DIR_NAME is defined — must contain the literal
  {
    files: ["src/constants.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Exceptions: commands with legitimate write operations (init, clean, sync, upgrade, etc.)
  {
    files: [
      "src/commands/init.ts",
      "src/commands/clean.ts",
      "src/commands/briefing.ts",
      "src/commands/reminders.ts",
      "src/commands/upgrade.ts",
      "src/commands/sync.ts",
      "src/commands/update.ts",
      "src/commands/validate.ts",
      "src/commands/assess.ts",
      "src/commands/status.ts",
      "src/commands/bench.ts",
      "src/commands/digest.ts",
      "src/commands/plan.ts",
      "src/commands/handbook.ts",
      "src/commands/hooks.ts",
      "src/commands/audit.ts",
      "src/commands/feedback.ts",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Exception: sbom-generator uses 'shitenno' as CycloneDX vendor name, not directory
  {
    files: ["src/audit/supply/sbom-generator.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];
