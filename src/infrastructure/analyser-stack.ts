/**
 * analyser-stack.ts — Stack detection
 *
 * Detects the technology stack of a project from filesystem signals
 * (tsconfig.json) and package.json dependencies.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { readPackageJson } from "./analyser-package.js";

const stackMap: Record<string, string[]> = {
  react: ["react", "react-dom"],
  nextjs: ["next"],
  vue: ["vue"],
  nuxt: ["nuxt"],
  svelte: ["svelte"],
  sveltekit: ["@sveltejs/kit"],
  expo: ["expo"],
  "react-native": ["react-native"],
  angular: ["@angular/core"],
  express: ["express"],
  fastify: ["fastify"],
  nestjs: ["@nestjs/core"],
  tailwindcss: ["tailwindcss"],
  styledcomponents: ["styled-components"],
  emotion: ["@emotion/react"],
  zod: ["zod"],
  jotai: ["jotai"],
  zustand: ["zustand"],
  redux: ["@reduxjs/toolkit"],
  prisma: ["@prisma/client"],
  drizzle: ["drizzle-orm"],
  typeorm: ["typeorm"],
  mongoose: ["mongoose"],
  trpc: ["@trpc/server"],
  graphql: ["graphql"],
  axios: ["axios"],
  vite: ["vite"],
  webpack: ["webpack"],
  esbuild: ["esbuild"],
  turborepo: ["turbo"],
  nx: ["nx"],
};

export function detectStack(rootDir: string): string[] {
  const stack: string[] = [];
  const pkg = readPackageJson(rootDir);

  // Detect base language/runtime from filesystem signals
  if (existsSync(join(rootDir, "tsconfig.json"))) stack.push("typescript");
  if (pkg) stack.push("node");

  if (!pkg) return [...new Set(stack)];

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  for (const [name, deps] of Object.entries(stackMap)) {
    if (deps.some((d) => d in allDeps)) {
      stack.push(name);
    }
  }

  return [...new Set(stack)];
}
