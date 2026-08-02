/**
 * architecture-detectors.ts — Barrel file for Architecture Detectors
 *
 * Re-exports from architecture/structural.ts and architecture/coupling.ts.
 */

export {
  detectCleanArchitectureLayers,
  detectSRPViolations,
  detectDependencyInversion,
  detectBarrelFileCycles,
} from "./architecture/structural.js";

export {
  detectModuleCoupling,
  detectImportConsistency,
  detectTestStructure,
} from "./architecture/coupling.js";
