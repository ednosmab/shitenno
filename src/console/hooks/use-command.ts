/**
 * use-command.ts — Command execution hook
 *
 * Executes shugo CLI commands via child_process and manages
 * execution state (idle/running/done/error) with output capture.
 */

import { useState, useCallback } from "react";
import { exec } from "child_process";

export type CommandStatus = "idle" | "running" | "done" | "error";

export interface CommandExecution {
  id: string;
  command: string;
  args: string[];
  label: string;
  description: string;
  status: CommandStatus;
  output: string;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export interface CommandDefinition {
  id: string;
  command: string;
  args: string[];
  label: string;
  description: string;
  estimatedTime: string;
  category: "read-only" | "management" | "destructive";
  requiresConfirmation?: boolean;
}

export const COMMAND_DEFINITIONS: CommandDefinition[] = [
  {
    id: "status",
    command: "shugo",
    args: ["status", "--json"],
    label: "shugo status",
    description: "Check governance health status",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "validate",
    command: "shugo",
    args: ["validate", "--json"],
    label: "shugo validate",
    description: "Validate session integrity",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "doctor",
    command: "shugo",
    args: ["doctor", "--json"],
    label: "shugo doctor",
    description: "Engineering mentor: risks, improvements, teaching",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "digest",
    command: "shugo",
    args: ["digest", "--json"],
    label: "shugo digest",
    description: "Daily digest of project health and changes",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "briefing",
    command: "shugo",
    args: ["briefing", "--json"],
    label: "shugo briefing",
    description: "Pre-session briefing for AI agents",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "detect",
    command: "shugo",
    args: ["detect", "--json"],
    label: "shugo detect",
    description: "Detect patterns and propose candidate rules",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "audit",
    command: "shugo",
    args: ["audit", "--json"],
    label: "shugo audit",
    description: "Comprehensive health audit with graph analysis",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "evolve",
    command: "shugo",
    args: ["evolve", "--json"],
    label: "shugo evolve",
    description: "Evolution recommendations and growth profile",
    estimatedTime: "2-5s",
    category: "read-only",
  },
  {
    id: "console",
    command: "shugo",
    args: ["console", "--json"],
    label: "shugo console",
    description: "Token economy and session metrics",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "report",
    command: "shugo",
    args: ["report", "--json"],
    label: "shugo report",
    description: "User performance report across 7 dimensions",
    estimatedTime: "<2s",
    category: "read-only",
  },
  {
    id: "feedback-summary",
    command: "shugo",
    args: ["feedback", "--summary", "--json"],
    label: "shugo feedback --summary",
    description: "Feedback statistics and success rate",
    estimatedTime: "<1s",
    category: "read-only",
  },
  {
    id: "goal-list",
    command: "shugo",
    args: ["goal", "list", "--json"],
    label: "shugo goal list",
    description: "List governance goals with status",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "decide-list",
    command: "shugo",
    args: ["decide", "list", "--json"],
    label: "shugo decide list",
    description: "Decision history with scores",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "policy-list",
    command: "shugo",
    args: ["policy", "list", "--json"],
    label: "shugo policy list",
    description: "List governance policies",
    estimatedTime: "<1s",
    category: "management",
  },
  {
    id: "clean",
    command: "shugo",
    args: ["clean", "--json"],
    label: "shugo clean",
    description: "Clear cache and temporary files",
    estimatedTime: "<1s",
    category: "destructive",
    requiresConfirmation: true,
  },
  {
    id: "sync",
    command: "shugo",
    args: ["sync", "--json"],
    label: "shugo sync",
    description: "Sync governance files from shitenno",
    estimatedTime: "<2s",
    category: "destructive",
    requiresConfirmation: true,
  },
];

let commandCounter = 0;

function generateId(): string {
  commandCounter += 1;
  return `cmd-${commandCounter}-${Date.now()}`;
}

function createExecution(definition: CommandDefinition): CommandExecution {
  return {
    id: generateId(),
    command: definition.command,
    args: definition.args,
    label: definition.label,
    description: definition.description,
    status: "running",
    output: "",
    startTime: new Date(),
  };
}

function createResult(
  execution: CommandExecution,
  error: Error | null,
  stdout: string,
  stderr: string
): CommandExecution {
  const endTime = new Date();
  const duration = execution.startTime
    ? (endTime.getTime() - execution.startTime.getTime()) / 1000
    : 0;
  return {
    ...execution,
    status: error ? "error" : "done",
    output: stdout || stderr || "",
    error: error ? error.message : undefined,
    endTime,
    duration,
  };
}

export function useCommand(projectRoot: string) {
  const [executions, setExecutions] = useState<CommandExecution[]>([]);
  const [currentExecution, setCurrentExecution] = useState<CommandExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState<CommandExecution[]>([]);

  const executeCommand = useCallback(
    (definition: CommandDefinition) => {
      if (isRunning) return;
      const execution = createExecution(definition);
      setCurrentExecution(execution);
      setIsRunning(true);
      setExecutions((prev) => [...prev, execution]);
      const fullCommand = `${definition.command} ${definition.args.join(" ")}`;
      exec(
        fullCommand,
        { cwd: projectRoot, timeout: 30000, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          const result = createResult(execution, error, stdout, stderr);
          setCurrentExecution(result);
          setIsRunning(false);
          setExecutions((prev) => prev.map((e) => (e.id === execution.id ? result : e)));
          setHistory((prev) => [...prev, result]);
        }
      );
    },
    [projectRoot, isRunning]
  );

  const clearOutput = useCallback(() => {
    setCurrentExecution(null);
  }, []);

  const rerunCommand = useCallback(
    (definition: CommandDefinition) => {
      executeCommand(definition);
    },
    [executeCommand]
  );

  return {
    executions,
    currentExecution,
    isRunning,
    history,
    executeCommand,
    clearOutput,
    rerunCommand,
  };
}
