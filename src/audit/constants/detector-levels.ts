import type { AuditLevel } from "../types.js";
import { QUICK_DETECTORS } from "./detectors-quick.js";
import { STANDARD_DETECTORS } from "./detectors-standard.js";
import { CODE_REVIEW_DETECTORS } from "./detectors-code-review.js";
import { ENTERPRISE_DETECTORS } from "./detectors-enterprise.js";

export const DETECTORS_BY_LEVEL: Record<AuditLevel, string[]> = {
  quick: QUICK_DETECTORS,
  standard: STANDARD_DETECTORS,
  "code-review": CODE_REVIEW_DETECTORS,
  enterprise: ENTERPRISE_DETECTORS,
};
