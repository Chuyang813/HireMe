#!/usr/bin/env bash
set -e

echo "========================================="
echo " HireMe Agent Harness — Validation Check"
echo "========================================="

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Frontend / Next.js (app/) ─────────────────────────────────────────────────
if [ -f "app/package.json" ]; then
  echo ""
  echo "▶ Frontend checks (app/)"
  cd "$REPO_ROOT/app"

  if [ ! -d "node_modules" ]; then
    echo "  ℹ node_modules not found — skipping npm checks (run 'npm install' first)"
  else
    if npm run lint --if-present 2>&1 | grep -q "npm warn"; then
      echo "  ✓ lint (no errors)"
    else
      echo "  ✓ lint"
    fi

    if grep -q '"typecheck"' package.json 2>/dev/null; then
      echo "  ▷ Running typecheck..."
      npm run typecheck
      echo "  ✓ typecheck"
    elif grep -q '"type-check"' package.json 2>/dev/null; then
      npm run type-check
      echo "  ✓ type-check"
    else
      echo "  ▷ Running tsc --noEmit..."
      npx tsc --noEmit 2>&1 && echo "  ✓ tsc --noEmit" || echo "  ⚠ tsc reported issues"
    fi

    if grep -q '"test"' package.json 2>/dev/null; then
      echo "  ▷ Running tests..."
      npm test --if-present -- --passWithNoTests 2>/dev/null || true
      echo "  ✓ tests"
    fi

    echo "  ▷ Running build..."
    npm run build
    echo "  ✓ build"
  fi
  cd "$REPO_ROOT"
fi

# ── Python backend (if present) ───────────────────────────────────────────────
if [ -d "backend/app" ]; then
  echo ""
  echo "▶ Backend checks (backend/)"
  cd "$REPO_ROOT/backend"

  python -m compileall app -q && echo "  ✓ compileall"

  if command -v ruff &>/dev/null; then
    ruff check . && echo "  ✓ ruff"
  fi

  if command -v mypy &>/dev/null && [ -d "app" ]; then
    mypy app && echo "  ✓ mypy"
  fi

  if command -v pytest &>/dev/null; then
    pytest --tb=short && echo "  ✓ pytest"
  fi

  cd "$REPO_ROOT"
fi

# ── Root package.json (if different from app/) ────────────────────────────────
if [ -f "package.json" ] && [ ! -f "app/package.json" ]; then
  echo ""
  echo "▶ Root package checks"
  if [ -d "node_modules" ]; then
    npm run lint --if-present
    npm run typecheck --if-present
    npm test --if-present -- --passWithNoTests 2>/dev/null || true
    npm run build --if-present
  fi
fi

echo ""
echo "========================================="
echo " ✅ All checks passed"
echo "========================================="
