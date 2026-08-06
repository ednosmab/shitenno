import chalk from "chalk";
import { queryDaemonWithFallback } from "../../infrastructure/daemon-client.js";
import { output } from "../../shared/output.js";

interface DaemonHealth {
  type: string;
  score: number | null;
  trend: string;
  lastCommand: string | null;
}

/**
 * Print a one-line daemon health banner if the daemon is running.
 * Skips output when isJson is true to avoid polluting JSON streams.
 */
export async function printDaemonBanner(shitennoDir: string, isJson = false): Promise<void> {
  if (isJson) return;
  const health = await queryDaemonWithFallback<DaemonHealth>(
    shitennoDir,
    { type: "query_health" },
    () => null as unknown as DaemonHealth,
  );
  if (!health) return;
  const icon = health.trend === "critical" ? "🔴" : health.trend === "degrading" ? "🟡" : "🟢";
  output(chalk.gray(`  ${icon} daemon: score ${health.score ?? "N/A"} · last cmd: ${health.lastCommand ?? "—"}`));
}
