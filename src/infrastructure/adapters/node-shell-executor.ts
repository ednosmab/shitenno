/**
 * node-shell-executor.ts — Node.js ShellExecutor adapter.
 */

import { execSync } from "node:child_process";
import type { ShellExecutor } from "../../domain/ports/file-system.js";

export class NodeShellExecutor implements ShellExecutor {
  exec(command: string): string {
    return execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  }

  execSafe(command: string): { stdout: string; stderr: string; exitCode: number } {
    try {
      const stdout = execSync(command, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
      return { stdout, stderr: "", exitCode: 0 };
    } catch (error: unknown) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: (err.stdout ?? "") as string,
        stderr: (err.stderr ?? "") as string,
        exitCode: err.status ?? 1,
      };
    }
  }
}
