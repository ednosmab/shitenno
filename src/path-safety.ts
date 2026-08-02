/**
 * path-safety.ts — Path Traversal Prevention Utilities
 *
 * Provides functions to validate that user-supplied paths
 * stay within expected directory boundaries.
 */

import { basename, relative, resolve, isAbsolute } from "node:path";

/**
 * Error thrown when a path escapes the allowed root directory.
 */
export class PathTraversalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathTraversalError";
  }
}

/**
 * Resolve a path inside a root directory, rejecting any attempt
 * to escape via "..", absolute path, or symlink traversal.
 *
 * @param root - The allowed root directory
 * @param segments - Path segments to resolve within root
 * @returns The resolved absolute path
 * @throws PathTraversalError if the path escapes root
 */
export function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const candidate = resolve(resolvedRoot, ...segments);
  const rel = relative(resolvedRoot, candidate);

  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new PathTraversalError(
      `Path "${segments.join("/")}" escapes root "${root}"`
    );
  }
  return candidate;
}

/**
 * Validate that a user-supplied ID/filename contains no path separators
 * or traversal sequences. Returns the basename only (strips any directory).
 * Throws if the ID is empty or contains unsafe characters.
 */
export function sanitizePlanId(id: string): string {
  const cleaned = basename(id);
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error(`Invalid plan ID: "${id}"`);
  }
  if (/[\\/]/.test(id) || id.includes("..")) {
    throw new Error(`Plan ID contains path separators: "${id}"`);
  }
  return cleaned;
}

/**
 * Validate that a planName from MCP args is safe.
 * Returns the basename only. Throws if unsafe.
 */
export function sanitizePlanName(name: string): string {
  const cleaned = basename(name);
  if (!cleaned || cleaned === "." || cleaned === "..") {
    throw new Error(`Invalid plan name: "${name}"`);
  }
  if (/[\\/]/.test(name) || name.includes("..")) {
    throw new Error(`Plan name contains path traversal: "${name}"`);
  }
  return cleaned;
}
