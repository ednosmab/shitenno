/**
 * file-system.ts — FileSystem port for Clean Architecture.
 *
 * All file system operations MUST go through this interface in domain layer.
 * Infrastructure provides the concrete implementation.
 */

export interface FileSystem {
  exists(path: string): boolean;
  read(path: string): string;
  readLines(path: string): string[];
  write(path: string, content: string): void;
  append(path: string, content: string): void;
  listDir(path: string): string[];
  ensureDir(path: string): void;
}

export interface ShellExecutor {
  exec(command: string): string;
  execSafe(command: string): { stdout: string; stderr: string; exitCode: number };
}
