#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/backend"
echo "🌱 Running seed..."
npx prisma db seed
echo "✅ Seed complete"
