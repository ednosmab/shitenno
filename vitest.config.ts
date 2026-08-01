import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/__tests__/**/*.test.ts", "scripts/__tests__/**/*.test.ts"],
    exclude: ["src/__tests__/benchmarks.bench.ts"],
    setupFiles: ["src/__tests__/setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 10_000,
    reporters: ["verbose"],
    // Arquivos de teste já rodam em paralelo por padrão (fileParallelism),
    // mas "forks" isola melhor processos que tocam filesystem/env real
    // (os testes E2E do O.3) do que "threads" — evita estado compartilhado
    // acidental entre arquivos que usam tmpdir/env vars.
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/templates/**"],
      thresholds: {
        lines: 48,
        functions: 80,
        branches: 75,
        statements: 48,
      },
    },
  },
});
