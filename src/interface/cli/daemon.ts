/**
 * daemon.ts — Re-export barrel for the daemon module.
 *
 * The actual implementation lives in src/daemon/:
 *   - index.ts   — runDaemon() entry point + orchestration
 *   - state.ts   — DaemonState types and persistence
 *   - ipc.ts     — IPC message handler
 *   - startup-scan.ts — proactive startup functions
 *
 * This file exists only for backward compatibility:
 *   - daemon-client.ts spawns "src/daemon.js" as a child process
 *   - Any external code that imports from "./daemon.js" continues to work
 */

export { runDaemon, getPaths, daemonLog } from "../../daemon/index.js";

// ── Entry Point ───────────────────────────────────────────────────────────────

import { runDaemon } from "../../daemon/index.js";
import { outputError } from "../../shared/output.js";

// When run directly as a script (shugo.ts spawns this via startDaemon)
const shitennoDirArg = process.argv[2];
const projectRootArg = process.argv[3];
if (shitennoDirArg) {
  runDaemon(shitennoDirArg, projectRootArg).catch((err) => {
    outputError(`[daemon] Fatal error: ${err}`);
    process.exit(1);
  });
}
