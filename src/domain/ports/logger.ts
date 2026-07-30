/**
 * logger.ts — Logger port for Clean Architecture.
 *
 * Domain layer defines the interface; infrastructure provides the implementation.
 */

export interface Logger {
  info(module: string, message: string, data?: unknown): void;
  warn(module: string, message: string, data?: unknown): void;
  error(module: string, message: string, data?: unknown): void;
  debug(module: string, message: string, data?: unknown): void;
}
