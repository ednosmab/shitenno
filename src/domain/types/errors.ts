/**
 * errors.ts — Typed Errors for Shugo
 *
 * Replaces process.exit(1) with errors that Commander catches.
 */

export class ShitennoError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "ShitennoError";
  }
}

export class NotInitializedError extends ShitennoError {
  constructor() {
    super("Project not initialized. Run `shugo init` first.", "NOT_INITIALIZED");
  }
}

export class InvalidRuleError extends ShitennoError {
  constructor(detail: string) {
    super(`Invalid rule ID: ${detail}`, "INVALID_RULE");
  }
}

export class ScriptNotAllowedError extends ShitennoError {
  constructor(script: string) {
    super(`Script not allowed: ${script}`, "SCRIPT_NOT_ALLOWED");
  }
}
