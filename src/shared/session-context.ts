/**
 * session-context.ts — Global Session State
 *
 * Provides access to the current session ID across all commands.
 * The session ID is set once at startup (bin/shugo.ts) and read by
 * commands that need to track session-level activity.
 *
 * PRINCIPLE: Session context is cross-cutting, not command-specific.
 */

let currentSessionId: string | null = null;

/** Set the current session (called once at startup). */
export function setSessionContext(
  sessionId: string,
  _startedAt: string
): void {
  currentSessionId = sessionId;
}

/** Get the current session ID, or null if no session is active. */
export function getSessionId(): string | null {
  return currentSessionId;
}

/** Clear the session (called at shutdown). */
export function clearSessionContext(): void {
  currentSessionId = null;
}
