#!/bin/bash
set -e
cd "$(dirname "$0")"

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌ Node.js 18+ required. Found: $(node -v)"
  echo "   Install latest: https://nodejs.org or use nvm: nvm install --lts"
  exit 1
fi

[ ! -d node_modules ] && (npm install --ignore-scripts || npm install --ignore-scripts --omit=optional)
[ ! -d frontend/node_modules ] && (cd frontend && npm install)
[ ! -d frontend/dist ] && (cd frontend && npm run build)
node server.js
