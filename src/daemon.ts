/**
 * daemon.ts — Backward-compatibility entry point for the daemon module.
 *
 * The actual implementation lives in src/daemon/ (orchestrated by
 * src/interface/cli/daemon.ts). This shim exists so daemon-client spawns
 * "src/daemon.js" as documented and external imports of "./daemon.js"
 * continue to work.
 */

export { runDaemon, getPaths, daemonLog } from "./interface/cli/daemon.js";
