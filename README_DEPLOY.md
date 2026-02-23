# ERP MDV — Deploy Guide

> **Stack:** NestJS 10 · Next.js 14 · PostgreSQL 16 · Prisma 5 · Docker

---

## Arquitetura de Deploy

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│ PostgreSQL   │
│  Next.js    │     │   NestJS    │     │   16         │
│  :3000      │     │   :3001     │     │   :5432      │
│  standalone │     │   dist/main │     │              │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │
     │  NEXT_PUBLIC_       │  DATABASE_URL
     │  API_URL            │  JWT_SECRET
     │  (build-time)       │  BACKEND_CORS_ORIGIN
```

---

## Opção 1: Render (Blueprint — 1 clique)

### Passo a passo

1. **Push repo** para GitHub/GitLab

2. **Render Dashboard** → New → Blueprint → selecionar repo

3. O `render.yaml` cria automaticamente:
   - 🗄 PostgreSQL (starter — grátis)
   - 🔧 Backend (Docker, health check em `/api/health`)
   - 🌐 Frontend (Docker, standalone)

4. **Ajustar URLs** após primeiro deploy:
   - Backend `BACKEND_CORS_ORIGIN` → URL real do frontend
   - Frontend `NEXT_PUBLIC_API_URL` → URL real do backend
   - **Rebuild frontend** após mudar NEXT_PUBLIC_API_URL (é build-time)

5. **Primeiro deploy** já roda seed (`RUN_SEED=true` no render.yaml)

6. **Após seed**: trocar `RUN_SEED` para `false` no backend

### Variáveis no Render

| Variável | Onde | Valor |
|----------|------|-------|
| `DATABASE_URL` | Backend | Auto (fromDatabase) |
| `JWT_SECRET` | Backend | Auto (generateValue) |
| `BACKEND_CORS_ORIGIN` | Backend | `https://erp-mdv-web.onrender.com` |
| `BACKEND_PORT` | Backend | `3001` |
| `RUN_SEED` | Backend | `true` (1º deploy) → `false` |
| `ADMIN_DEFAULT_PASSWORD` | Backend | `mdv@2026!` |
| `NEXT_PUBLIC_API_URL` | Frontend | `https://erp-mdv-api.onrender.com` |

### Troubleshooting Render

- **502 Bad Gateway**: O backend demora ~30s para iniciar. Aguarde.
- **Seed falhou**: Verifique logs. Pode rodar manualmente via Shell.
- **CORS error**: `BACKEND_CORS_ORIGIN` deve conter a URL exata do frontend.
- **Frontend não carrega dados**: Rebuild frontend (NEXT_PUBLIC_API_URL é build-time).
- **Free tier dorme**: Backend desliga após 15min sem tráfego. Primeira request = ~30s.

---

## Opção 2: Railway

### Passo a passo

1. **Criar projeto** no Railway Dashboard → New Project → Deploy from Repo

2. **Adicionar PostgreSQL**: Add Service → Database → PostgreSQL

3. **Criar serviço Backend**:
   - Add Service → GitHub Repo → selecionar repo
   - Settings → Root Directory: `apps/backend`
   - Settings → Builder: Dockerfile
   - Settings → Dockerfile Path: `Dockerfile`

4. **Variáveis do Backend** (Variables tab):
   ```
   DATABASE_URL      = ${{Postgres.DATABASE_URL}}
   JWT_SECRET        = (gere com: openssl rand -hex 32)
   BACKEND_CORS_ORIGIN = https://${{RAILWAY_PUBLIC_DOMAIN}}
   NODE_ENV          = production
   BACKEND_PORT      = 3001
   RUN_SEED          = true
   ADMIN_DEFAULT_PASSWORD = mdv@2026!
   PORT              = 3001
   ```

5. **Criar serviço Frontend**:
   - Add Service → GitHub Repo → mesmo repo
   - Settings → Root Directory: `apps/frontend`
   - Settings → Builder: Dockerfile
   - Settings → Dockerfile Path: `Dockerfile`
   - Build Arguments: `NEXT_PUBLIC_API_URL=https://[backend-url].railway.app`

6. **Variáveis do Frontend**:
   ```
   NEXT_PUBLIC_API_URL = https://[backend-domain].railway.app
   PORT                = 3000
   ```

7. **Ajustar CORS** do backend para apontar para URL do frontend

8. **Gerar domínios**: Settings → Networking → Generate Domain (para ambos)

### Variáveis Railway

| Variável | Serviço | Valor |
|----------|---------|-------|
| `DATABASE_URL` | Backend | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | Backend | `openssl rand -hex 32` |
| `BACKEND_CORS_ORIGIN` | Backend | URL do frontend |
| `PORT` | Backend | `3001` |
| `RUN_SEED` | Backend | `true` → `false` |
| `NEXT_PUBLIC_API_URL` | Frontend | URL do backend |
| `PORT` | Frontend | `3000` |

### Troubleshooting Railway

- **Build falhou por bcrypt**: O Dockerfile já inclui `python3 make g++`.
- **PORT**: Railway injeta `PORT` automaticamente. O backend usa `BACKEND_PORT`, então set `PORT=3001` explicitamente.
- **Monorepo**: Cada serviço precisa de Root Directory diferente.

---

## Opção 3: Docker Compose (self-host / VPS)

### Primeiro deploy

```bash
git clone <repo> && cd erp-mdv

# Configurar
cp .env.example .env
nano .env  # editar DATABASE_URL, JWT_SECRET, CORS

# Build + start + seed
RUN_SEED=true docker compose -f docker-compose.prod.yml up --build -d

# Verificar
./scripts/smoke-test.sh http://localhost:3001/api
```

### Deploys subsequentes

```bash
git pull
docker compose -f docker-compose.prod.yml up --build -d
```

### Portas

| Serviço | Porta | Health |
|---------|-------|--------|
| Frontend | 3000 | `GET /` |
| Backend | 3001 | `GET /api/health` |
| Postgres | 5432 | `pg_isready` |

---

## Opção 4: Desenvolvimento Local (sem Docker)

```bash
# Pré-requisitos: Node 20+, PostgreSQL 16 rodando

# Setup automático (instala deps, gera prisma, push schema, seed)
./scripts/setup.sh

# Ou manualmente:
cd apps/backend  && npm install && cd ../..
cd apps/frontend && npm install && cd ../..
cp .env.example .env        # editar DATABASE_URL e JWT_SECRET

cd apps/backend
npx prisma db push
npx prisma db seed
cd ../..

npm run dev                  # backend :3001 + frontend :3000
```

**Login:** admin / mdv@2026!
**Swagger:** http://localhost:3001/api/docs

---

## Scripts Disponíveis

```bash
# Raiz do projeto
npm run dev                  # Backend + Frontend (dev mode)
npm run build                # Build ambos
npm run db:migrate           # Criar migration (dev)
npm run db:migrate:prod      # Apply migrations (production)
npm run db:seed              # Rodar seed
npm run db:reset             # Reset + seed (perde dados!)
npm run db:studio            # Prisma Studio (GUI)

# scripts/
./scripts/setup.sh           # Setup completo (primeira vez)
./scripts/dev.sh             # Dev mode
./scripts/build.sh           # Build backend + frontend
./scripts/migrate.sh dev     # Criar migration
./scripts/migrate.sh deploy  # Deploy migrations
./scripts/migrate.sh reset   # Reset + seed
./scripts/migrate.sh push    # Push sem migration
./scripts/seed.sh            # Rodar seed
./scripts/smoke-test.sh      # Smoke test contra API
./scripts/docker-build.sh up # Docker Compose build + start
```

---

## Seed — Dados Demo

O seed (`prisma/seed.ts`) cria:

| Dado | Quantidade | Detalhe |
|------|-----------|---------|
| Unidades | 5 | São Camilo, Santa Casa, SUS Campinas, CME, Clínica Central |
| Usuários | 3 | admin (FULL), financeiro (FINANCEIRO), secretaria.sc (SECRETARIA) |
| Plano de Contas (master) | 41 | Árvore 3.x (receita) + 4.x (despesa), 4 níveis |
| Contas por Unidade | ~120 | Analíticas × 5 unidades |
| Fornecedores | 3 | Alcon, Zeiss, Farmácia Hospitalar |
| Contas a Pagar | 5 | PENDENTE, APROVADO, PAGO (São Camilo) |
| Contas a Receber | 5 | PREVISTO, RECEBIDO (São Camilo) |
| Leads Cirúrgicos | 5 | Pipeline completo (PRIMEIRA → FECHOU) |
| Funcionários | 3 | Médico, enfermeira, técnico |
| Estoque | 3 | LIO, colírio, luva (com níveis) |
| Conta Bancária | 1 | Bradesco (São Camilo) |

**Senhas:** Todos os usuários usam `mdv@2026!` (ou `ADMIN_DEFAULT_PASSWORD`).

**Idempotente:** O seed usa `upsert` — pode rodar múltiplas vezes sem duplicar.

---

## Smoke Test Passo a Passo

Após deploy, execute o fluxo completo:

```bash
API=https://seu-backend.com/api

# 1. Login
TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"mdv@2026!"}' | jq -r .access_token)

# 2. Listar unidades (dropdown)
curl -s -H "Authorization: Bearer $TOKEN" $API/units | jq '.[].name'

# 3. Pegar ID da primeira unidade
UNIT=$(curl -s -H "Authorization: Bearer $TOKEN" $API/units | jq -r '.[0].id')

# 4. Criar conta a pagar
SUPPLIER=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/financeiro/payables?unit_id=$UNIT&competence=2026-01" \
  | jq -r '.data[0].supplier_id')

AP=$(curl -s -X POST "$API/financeiro/payables?unit_id=$UNIT" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"supplier_id\":\"$SUPPLIER\",\"description\":\"Smoke test\",
       \"competence\":\"2026-02\",\"due_date\":\"2026-02-28\",\"value\":5000}" \
  | jq -r .id)
echo "Payable: $AP"

# 5. Aprovar
curl -s -X POST "$API/financeiro/payables/$AP/approve?unit_id=$UNIT" \
  -H "Authorization: Bearer $TOKEN" | jq .status
# → "APROVADO"

# 6. Contabilizar (LedgerEntry)
curl -s -X POST "$API/finance/payables/$AP/post" \
  -H "Authorization: Bearer $TOKEN" | jq '{type, amount}'
# → {type: "DEBIT", amount: 5000}

# 7. Pagar (CashMovement)
curl -s -X POST "$API/finance/payables/$AP/pay" \
  -H "Authorization: Bearer $TOKEN" | jq '{direction, amount}'
# → {direction: "OUT", amount: 5000}

# 8. Criar conta a receber
AR=$(curl -s -X POST "$API/financeiro/receivables?unit_id=$UNIT" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"source":"Smoke test AR","competence":"2026-02",
       "expected_date":"2026-02-28","gross_value":12000,"net_value":12000}' \
  | jq -r .id)

# 9. Contabilizar + Receber
curl -s -X POST "$API/finance/receivables/$AR/post" \
  -H "Authorization: Bearer $TOKEN" | jq .type
curl -s -X POST "$API/finance/receivables/$AR/receive" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"payment_method":"PIX"}' | jq .direction

# 10. DRE
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/finance/reports/dre?from=2026-02&to=2026-02&unit_id=$UNIT" \
  | jq '.summary | {receita_bruta, custos, resultado_liquido}'

# 11. Fluxo de Caixa
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/finance/reports/cashflow?from=2026-02-01&to=2026-02-28&unit_id=$UNIT&projection_days=30" \
  | jq '{total_in, total_out, net_balance}'

# 12. Frontend
echo "→ Abra https://seu-frontend.com/financeiro"
echo "→ Selecione 'São Camilo' no dropdown"
echo "→ Navegue pelas 5 abas"
```

---

## Checklist de Deploy

- [ ] DATABASE_URL aponta para PostgreSQL 16
- [ ] JWT_SECRET gerado com `openssl rand -hex 32`
- [ ] BACKEND_CORS_ORIGIN = URL exata do frontend
- [ ] NEXT_PUBLIC_API_URL = URL exata do backend (com `/api` se usar proxy)
- [ ] RUN_SEED=true no primeiro deploy, depois false
- [ ] Health check: `GET /api/health` retorna `{"status":"ok"}`
- [ ] Login funciona: admin / mdv@2026!
- [ ] Swagger acessível (somente NODE_ENV != production)
- [ ] Frontend carrega dados na aba Financeiro
- [ ] Smoke test passa: `./scripts/smoke-test.sh https://api-url/api`
- [ ] ADMIN_DEFAULT_PASSWORD trocado em produção real

---

## Segurança — Checklist Produção

- [ ] JWT_SECRET único e forte (32+ bytes)
- [ ] ADMIN_DEFAULT_PASSWORD trocado
- [ ] NODE_ENV=production (desabilita Swagger)
- [ ] HTTPS em todos os serviços
- [ ] DATABASE_URL usa SSL: `?sslmode=require`
- [ ] RUN_SEED=false após primeiro deploy
- [ ] Rate limiting ativo (60 req/min default)
- [ ] CORS restrito à URL exata do frontend
