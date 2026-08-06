import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["bin/shugo.ts", "src/interface/cli/daemon.ts", "src/application/plan-lifecycle.ts", "src/infrastructure/session-feedback.ts", "src/infrastructure/verification-lock.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  sourcemap: false,
  minify: false,
  splitting: false,
  external: ["typescript"],
  loader: {
    ".tsx": "tsx",
    ".ts": "ts",
  },
});
