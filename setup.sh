#!/bin/bash
# ═══════════════════════════════════════════════════
# ERP MDV — Setup local (primeira vez)
# ═══════════════════════════════════════════════════
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "══ 1/5 Verificando pré-requisitos..."
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ obrigatório"; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "❌ npm obrigatório"; exit 1; }
NODE_V=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_V" -ge 18 ] || { echo "❌ Node >= 18 obrigatório (atual: v$NODE_V)"; exit 1; }
echo "  Node $(node -v) ✅"

echo "══ 2/5 Instalando dependências..."
cd "$ROOT/apps/backend"  && npm install
cd "$ROOT/apps/frontend" && npm install

echo "══ 3/5 Configurando .env..."
if [ ! -f "$ROOT/.env" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "  📝 .env criado — EDITE o DATABASE_URL e JWT_SECRET!"
else
  echo "  .env já existe ✅"
fi

echo "══ 4/5 Gerando Prisma Client..."
cd "$ROOT/apps/backend" && npx prisma generate

echo "══ 5/5 Criando schema + seed..."
cd "$ROOT/apps/backend"
source "$ROOT/.env" 2>/dev/null || true
npx prisma db push
RUN_SEED=true npx prisma db seed || echo "⚠️  Seed pode já existir"

echo ""
echo "═══════════════════════════════════════════════════"
echo " ✅ Setup completo!"
echo ""
echo " Iniciar:  npm run dev (na raiz do projeto)"
echo " Backend:  http://localhost:3001/api/docs"
echo " Frontend: http://localhost:3000"
echo " Login:    admin / mdv@2026!"
echo "═══════════════════════════════════════════════════"
