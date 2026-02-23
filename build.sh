#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "══ Building backend..."
cd "$ROOT/apps/backend" && npm run build
echo "══ Building frontend..."
cd "$ROOT/apps/frontend" && npm run build
echo "✅ Build complete"
