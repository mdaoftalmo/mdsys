#!/bin/bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/apps/backend"

echo "══ Prisma Migrate ══"
if [ "$1" = "dev" ]; then
  echo "Creating new migration..."
  npx prisma migrate dev --name "${2:-update}"
elif [ "$1" = "deploy" ]; then
  echo "Deploying migrations to production..."
  npx prisma migrate deploy
elif [ "$1" = "reset" ]; then
  echo "⚠️  Resetting database (all data will be lost)..."
  npx prisma migrate reset --force
  npx prisma db seed
elif [ "$1" = "push" ]; then
  echo "Pushing schema without migration..."
  npx prisma db push
else
  echo "Usage: migrate.sh [dev|deploy|reset|push]"
  echo "  dev    — Create migration (development)"
  echo "  deploy — Apply pending migrations (production)"
  echo "  reset  — Drop + recreate + seed (development)"
  echo "  push   — Push schema without migration file"
fi
