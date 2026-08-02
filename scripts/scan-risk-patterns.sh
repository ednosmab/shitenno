#!/usr/bin/env bash
# scan-risk-patterns.sh — Scans for known risk patterns in source code
# Used by CI to enforce quality gates automatically
set -euo pipefail

FAILED=0

echo "→ fail-open patterns (warning, non-blocking)..."
HITS=$(grep -rn "!== false\|?? true\b" src --include="*.ts" | grep -v __tests__ | grep -v "src/templates/" || true)
[ -n "$HITS" ] && { echo "⚠️  Review manually:"; echo "$HITS"; }

echo "→ console.* outside output.ts/logger.ts (blocking)..."
# Exclude: __tests__, templates (generated project scripts), audit detectors (string refs), formatting.ts (comments)
HITS=$(grep -rln "console\.\(log\|error\|warn\)" bin src --include="*.ts" \
  | grep -v __tests__ \
  | grep -v "src/output.ts" \
  | grep -v "src/logger.ts" \
  | grep -v "src/templates/" \
  | grep -v "src/audit/" \
  | grep -v "src/formatting.ts" \
  | grep -v "src/analyser.ts" \
  || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

echo "→ self-hosting residue (blocking)..."
# Exclude templates (legitimate string refs), init commands (legitimate guard)
HITS=$(grep -rln "shitenno-go" src --include="*.ts" \
  | grep -v __tests__ \
  | grep -v "src/templates/" \
  | grep -v "src/commands/init" \
  || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

echo "→ fs-extra named imports (blocking)..."
HITS=$(grep -rn "^import { .* } from \"fs-extra\"" src bin --include="*.ts" | grep -v __tests__ || true)
[ -n "$HITS" ] && { echo "❌ $HITS"; FAILED=1; }

exit $FAILED
