#!/bin/bash
set -e
cd "$(dirname "$0")"
[ ! -d node_modules ] && npm install --ignore-scripts
[ ! -d frontend/node_modules ] && (cd frontend && npm install)
[ ! -d frontend/dist ] && (cd frontend && npm run build)
node server.js
