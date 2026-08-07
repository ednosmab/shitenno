/**
 * Decision Core — RunScript Executor
 *
 * Migrated from rule-engine/actions.ts (run_script / run_local_script / run_shugo_command).
 * Executes whitelisted scripts with security allowlist enforcement.
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { isScriptAllowed, isShugoCommandAllowed, getAllowedScriptCommand, getAllowedShugoCommand } from "../../shared/security.js";
import type { ActionExecutor } from "./types.js";

export class RunScriptExecutor implements ActionExecutor {
  name = "run_script" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const script = String(params.script ?? "");
    if (!script) return { success: false, executed: false, message: "No script specified" };

    if (!isScriptAllowed(script)) {
      return {
        success: false,
        executed: false,
        message: `Script "${script}" not in allowlist`,
      };
    }

    const command = getAllowedScriptCommand(script);
    if (!command) {
      return { success: false, executed: false, message: `No command mapping for script: ${script}` };
    }

    try {
      const output = execSync(command, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { success: true, executed: true, script, output: output.slice(0, 2000) };
    } catch (error) {
      return { success: false, executed: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

export class RunLocalScriptExecutor implements ActionExecutor {
  name = "run_local_script" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const script = String(params.script ?? "");
    if (!script) return { success: false, executed: false, message: "No script specified" };

    if (!isScriptAllowed(script)) {
      return {
        success: false,
        executed: false,
        message: `Script "${script}" not in allowlist`,
      };
    }

    const command = getAllowedScriptCommand(script);
    if (!command) {
      return { success: false, executed: false, message: `No command mapping for script: ${script}` };
    }

    try {
      const output = execSync(command, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { success: true, executed: true, script, output: output.slice(0, 2000) };
    } catch (error) {
      return { success: false, executed: false, message: `Script failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}

export class RunShugoCommandExecutor implements ActionExecutor {
  name = "run_shugo_command" as const;

  async execute(params: Record<string, unknown>, context: { projectRoot: string }): Promise<Record<string, unknown>> {
    const command = String(params.command ?? "");
    if (!command) return { success: false, executed: false, message: "No shugo command specified" };

    if (!isShugoCommandAllowed(command)) {
      return {
        success: false,
        executed: false,
        message: `Shugo command "${command}" not in allowlist`,
      };
    }

    const shugoCommand = getAllowedShugoCommand(command);
    if (!shugoCommand) {
      return { success: false, executed: false, message: `No command mapping for: ${command}` };
    }

    const assessBin = join(context.projectRoot, "dist", "shugo.js");
    if (!existsSync(assessBin)) {
      return { success: true, executed: true, message: "Shugo binary not found (dev environment)" };
    }

    try {
      const output = execSync(`SHITENNO_CHILD=1 node dist/shugo.js ${shugoCommand}`, {
        cwd: context.projectRoot,
        timeout: 30_000,
        encoding: "utf-8",
        stdio: "pipe",
      });
      return { success: true, executed: true, command, output: output.slice(0, 2000) };
    } catch (error) {
      return { success: false, executed: false, message: `Shugo command failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
}
