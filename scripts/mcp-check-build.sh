#!/bin/bash
# mcp-check-build.sh — Ensures build is up to date before MCP client runs
# Usage: source this or run before mcp-client.mjs

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_FILE="$PROJECT_ROOT/dist/bin/shugo.js"

if [ ! -f "$DIST_FILE" ]; then
  echo "Build not found. Running pnpm build..."
  cd "$PROJECT_ROOT" && pnpm run build 2>&1 | tail -5
  echo ""
fi
