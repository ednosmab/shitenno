import { QUICK_DETECTORS } from "../../src/audit/constants/detectors-quick.js";
import { STANDARD_DETECTORS } from "../../src/audit/constants/detectors-standard.js";
import { CODE_REVIEW_DETECTORS } from "../../src/audit/constants/detectors-code-review.js";
import { ENTERPRISE_DETECTORS } from "../../src/audit/constants/detectors-enterprise.js";

let failed = false;

function assertSuperset(
  bigger: string[],
  smaller: string[],
  biggerName: string,
  smallerName: string
): void {
  const missing = smaller.filter((d) => !bigger.includes(d));
  if (missing.length > 0) {
    console.error(
      `❌ ${biggerName} não contém todos os detectores de ${smallerName}: ${missing.join(", ")}`
    );
    failed = true;
  }
}

function assertNoDuplicates(name: string, list: string[]): void {
  const seen = new Set<string>();
  const dupes = list.filter((d) => (seen.has(d) ? true : (seen.add(d), false)));
  if (dupes.length > 0) {
    console.error(`❌ ${name} tem detectores duplicados: ${dupes.join(", ")}`);
    failed = true;
  }
}

assertSuperset(STANDARD_DETECTORS, QUICK_DETECTORS, "STANDARD_DETECTORS", "QUICK_DETECTORS");
assertSuperset(
  CODE_REVIEW_DETECTORS,
  STANDARD_DETECTORS,
  "CODE_REVIEW_DETECTORS",
  "STANDARD_DETECTORS"
);
assertSuperset(
  ENTERPRISE_DETECTORS,
  CODE_REVIEW_DETECTORS,
  "ENTERPRISE_DETECTORS",
  "CODE_REVIEW_DETECTORS"
);

assertNoDuplicates("QUICK_DETECTORS", QUICK_DETECTORS);
assertNoDuplicates("STANDARD_DETECTORS", STANDARD_DETECTORS);
assertNoDuplicates("CODE_REVIEW_DETECTORS", CODE_REVIEW_DETECTORS);
assertNoDuplicates("ENTERPRISE_DETECTORS", ENTERPRISE_DETECTORS);

if (failed) {
  console.error("❌ Composição de níveis QUEBRADA — corrija antes de prosseguir");
  process.exit(1);
}
console.log("✅ Composição de níveis OK — cada nível é superset do anterior, sem duplicados");
