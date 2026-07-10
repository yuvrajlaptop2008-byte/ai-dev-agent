#!/bin/bash
# One-command setup + launch. Re-run anytime — it's idempotent.
set -e
cd "$(dirname "$0")"

PY=python3
if ! command -v $PY >/dev/null || ! $PY -c "import sys; assert sys.version_info >= (3,11) and sys.version_info < (3,14)" 2>/dev/null; then
  echo "❌ Python 3.11-3.13 required. Found: $($PY --version 2>&1)"
  echo "   Install: https://www.python.org/downloads/"
  exit 1
fi

if [ ! -d .venv ]; then
  echo "→ Creating virtual environment..."
  $PY -m venv .venv
fi
VENV_PY=.venv/bin/python
VENV_PIP=.venv/bin/pip

if [ ! -f .venv/.installed ]; then
  echo "→ Installing Hermes (first run, takes a minute)..."
  $VENV_PIP install --upgrade pip -q
  $VENV_PIP install -e . -q
  touch .venv/.installed
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env — add your OPENROUTER_API_KEY and GITHUB_TOKEN, then re-run: bash run.sh"
  exit 0
fi
set -a; source .env; set +a

export HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
if [ ! -f "$HERMES_HOME/config.yaml" ]; then
  echo "→ Seeding first-run config into $HERMES_HOME..."
  mkdir -p "$HERMES_HOME"
  cp config-template/SOUL.md "$HERMES_HOME/SOUL.md" 2>/dev/null || true
  cp config-template/config.yaml "$HERMES_HOME/config.yaml" 2>/dev/null || true
fi

echo "✅ Starting Hermes..."
exec .venv/bin/hermes "$@"
