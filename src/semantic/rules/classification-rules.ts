import type { ClassificationRule } from "../taxonomy.js";
import { PERSISTENCE_AUTH_SECURITY_RULES } from "./classification-rules-persistence.js";
import { APPLICATION_RULES } from "./classification-rules-application.js";
import { GOVERNANCE_DATA_RULES } from "./classification-rules-governance.js";

export const CLASSIFICATION_RULES: ClassificationRule[] = [
  ...PERSISTENCE_AUTH_SECURITY_RULES,
  ...APPLICATION_RULES,
  ...GOVERNANCE_DATA_RULES,
];
