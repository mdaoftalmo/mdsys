#!/bin/sh
set -e

echo "═══════════════════════════════════════════════════"
echo " ERP MDV Oftalmologia — Startup"
echo "═══════════════════════════════════════════════════"
echo " NODE_ENV  = ${NODE_ENV:-development}"
echo " PORT      = ${BACKEND_PORT:-3001}"
echo " RUN_SEED  = ${RUN_SEED:-false}"
echo "═══════════════════════════════════════════════════"

# ── Database migration ──
MIGRATION_COUNT=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "📦 Found $MIGRATION_COUNT migration(s) → prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "🆕 No migrations → prisma db push (first deploy)"
  npx prisma db push --accept-data-loss
fi

# ── Seed (staging/demo only) ──
if [ "$RUN_SEED" = "true" ]; then
  echo "🌱 Running seed (RUN_SEED=true)..."
  npx prisma db seed 2>&1 || echo "⚠️  Seed skipped (idempotent — data may already exist)"
fi

echo "═══════════════════════════════════════════════════"
echo " 🚀 Starting server..."
echo "═══════════════════════════════════════════════════"
exec "$@"
