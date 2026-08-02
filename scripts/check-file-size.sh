#!/usr/bin/env bash
# check-file-size.sh — Blocks src/ files with >300 lines (excludes __tests__/ and templates/, see ADR-007)
# Usage: bash scripts/check-file-size.sh [--report-only]
# Baseline mode (default): files in scripts/file-size-baseline.txt are grandfathered.
# Only NEW violations (not in baseline) cause failure.
set -euo pipefail

MAX_LINES=300
VIOLATIONS=0
NEW_VIOLATIONS=0
REPORT_ONLY=false

if [ "${1:-}" = "--report-only" ]; then
  REPORT_ONLY=true
fi

BASELINE_FILE="scripts/file-size-baseline.txt"
BASELINE_FILES=""
if [ -f "$BASELINE_FILE" ]; then
  BASELINE_FILES=$(cat "$BASELINE_FILE")
fi

is_baseline() {
  local file="$1"
  echo "$BASELINE_FILES" | grep -qxF "$file"
}

while IFS= read -r -d '' file; do
  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$MAX_LINES" ]; then
    VIOLATIONS=$((VIOLATIONS + 1))
    if is_baseline "$file"; then
      echo "BASELINE F-06: $file has $lines lines (grandfathered)"
    else
      echo "VIOLATION F-06: $file has $lines lines (max: $MAX_LINES)"
      NEW_VIOLATIONS=$((NEW_VIOLATIONS + 1))
    fi
  fi
done < <(find src -name "*.ts" \
  -not -path "*/__tests__/*" \
  -not -path "*/templates/*" \
  -print0)

if [ "$VIOLATIONS" -gt 0 ]; then
  echo ""
  echo "Total: $VIOLATIONS violation(s), $NEW_VIOLATIONS NEW."
  if [ "$REPORT_ONLY" = true ]; then
    echo "REPORT-ONLY mode: violations detected but not blocking."
    exit 0
  fi
  if [ "$NEW_VIOLATIONS" -gt 0 ]; then
    echo "NEW violations detected — blocking. Add new files to $BASELINE_FILE to grandfather."
    exit 1
  fi
  echo "All violations are grandfathered (baseline). No blocking."
  exit 0
fi

echo "F-06 check passed: no files exceed $MAX_LINES lines."
