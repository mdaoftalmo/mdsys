#!/bin/bash
# Build and run with Docker Compose (production-like)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "══ Docker Compose — Production Build ══"
echo ""
echo "Opções:"
echo "  1) Primeiro deploy (com seed):"
echo "     RUN_SEED=true docker compose -f docker-compose.prod.yml up --build"
echo ""
echo "  2) Deploy normal (sem seed):"
echo "     docker compose -f docker-compose.prod.yml up --build"
echo ""
echo "  3) Parar tudo:"
echo "     docker compose -f docker-compose.prod.yml down"
echo ""
echo "  4) Parar + limpar volumes (apaga dados):"
echo "     docker compose -f docker-compose.prod.yml down -v"
echo ""

if [ "$1" = "up" ]; then
  RUN_SEED=${RUN_SEED:-false} docker compose -f docker-compose.prod.yml up --build "$@"
elif [ "$1" = "down" ]; then
  docker compose -f docker-compose.prod.yml down "$@"
else
  echo "Uso: docker-build.sh [up|down]"
fi
