/**
 * maturity-profile.ts — Project Maturity Profile
 *
 * Thin facade — all logic split into maturity-profile/ modules.
 */

export type {
  MaturityDimensions,
  Capability,
  CapabilityInfo,
  MaturityProfile,
} from "../domain/entities/engineering-state.js";

export { CAPABILITIES } from "../maturity-profile/capabilities.js";
export type { MaturityAnswers, ProjectAnalysis } from "../maturity-profile/dimensions.js";
export { calculateDimensions, detectGovernanceArtifactsScore, calculateOverallScore } from "../maturity-profile/dimensions.js";
export { detectCapabilitySignalsFromFilesystem } from "../maturity-profile/detection.js";
export { recommendCapabilities, getFutureCapabilities } from "../maturity-profile/recommendation.js";
export { calculateMaturityProfile, saveMaturityProfile, loadMaturityProfile, profileToLegacyLevel } from "../maturity-profile/persistence.js";
export type { MaturitySnapshot } from "../maturity-profile/telemetry.js";
export { recordMaturitySnapshot, readMaturityHistory } from "../maturity-profile/telemetry.js";
