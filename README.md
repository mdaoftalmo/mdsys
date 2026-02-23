# ERP MDV Oftalmologia

Sistema ERP multi-unidade para clínicas oftalmológicas.
**NestJS** · **Next.js 14** · **PostgreSQL 16** · **Prisma 5** · **Tailwind CSS**

---

## 1. Quickstart Local (sem Docker)

```bash
# Pré-requisitos: Node 20+, PostgreSQL 16 rodando

# Instalar dependências
cd apps/backend  && npm install && cd ../..
cd apps/frontend && npm install && cd ../..

# Configurar banco
cp .env.example .env
# Editar .env → DATABASE_URL e JWT_SECRET

# Criar schema + popular dados demo
cd apps/backend
npx prisma db push
npx prisma db seed
cd ../..

# Rodar (backend :3001, frontend :3000)
npm run dev
```

Login: **admin** / **mdv@2026!**
Swagger: http://localhost:3001/api/docs

---

## 2. Quickstart Local (Docker Compose)

```bash
# Produção local (build completo)
docker compose -f docker-compose.prod.yml up --build

# Primeiro deploy: ative o seed
RUN_SEED=true docker compose -f docker-compose.prod.yml up --build

# Dev (hot reload)
docker compose up --build
```

Acesse http://localhost:3000 (frontend) e http://localhost:3001/api/health (backend).

---

## 3. Variáveis de Ambiente

### Obrigatórias (backend)

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | Conexão PostgreSQL | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Chave JWT (gere: `openssl rand -hex 32`) | `a1b2c3d4...` (64 chars) |
| `BACKEND_CORS_ORIGIN` | URL do frontend (sem `/` no final) | `https://erp-mdv.up.railway.app` |

### Obrigatórias (frontend — build-time)

| Variável | Descrição | Exemplo |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend (sem `/` no final) | `https://erp-mdv-api.up.railway.app` |

> ⚠️ `NEXT_PUBLIC_API_URL` é injetada no build. No Railway/Render, configure como variável antes do build.

### Opcionais

| Variável | Default | Descrição |
|---|---|---|
| `RUN_SEED` | `false` | `true` = roda seed no boot (staging/demo) |
| `ADMIN_DEFAULT_PASSWORD` | `mdv@2026!` | Senha dos usuários do seed |
| `ANTHROPIC_API_KEY` | — | Para módulo AI (Claude insights) |
| `JWT_EXPIRES_IN` | `24h` | Expiração do token |
| `BACKEND_PORT` | `3001` | Porta do backend |

---

## 4. Deploy — Caminho A: Railway

### Passo a passo

**4.1 — Criar projeto**
```
railway login
railway init
railway link
```
Ou: Dashboard → New Project → Deploy from GitHub.

**4.2 — Adicionar PostgreSQL**
- Dashboard → Add Service → Database → PostgreSQL
- Railway gera `DATABASE_URL` automaticamente

**4.3 — Backend**
```
Add Service → GitHub Repo
Settings:
  Root Directory: apps/backend
  Builder: Dockerfile
  Port: 3001
```

Variables (aba Variables):
```env
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<colar output de: openssl rand -hex 32>
BACKEND_CORS_ORIGIN=https://<frontend-service>.up.railway.app
NODE_ENV=production
RUN_SEED=true
ADMIN_DEFAULT_PASSWORD=mdv@2026!
```

**4.4 — Frontend**
```
Add Service → GitHub Repo
Settings:
  Root Directory: apps/frontend
  Builder: Dockerfile
  Port: 3000
  Build args: NEXT_PUBLIC_API_URL=https://<backend-service>.up.railway.app
```

Variables:
```env
NEXT_PUBLIC_API_URL=https://<backend-service>.up.railway.app
```

**4.5 — Validar**
```bash
# Health check
curl https://<backend>.up.railway.app/api/health
# Espera: { "status": "ok", "db": { "status": "connected" } }

# Login
curl -X POST https://<backend>.up.railway.app/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"mdv@2026!"}'
# Espera: { "access_token": "eyJ..." }
```

**4.6 — Pós-deploy**: mudar `RUN_SEED=false`.

---

## 5. Deploy — Caminho B: Render

### One-click (Blueprint)

Se o repo tem `render.yaml`, basta:
```
Dashboard → New → Blueprint → Connect repo → Apply
```
O Render cria PostgreSQL + backend + frontend automaticamente.

### Manual

**5.1 — PostgreSQL**
- Dashboard → New → PostgreSQL
- Plan: Starter ($7/mês) ou Free (com limitações)
- Copiar "Internal Database URL"

**5.2 — Backend (Web Service)**
```
New → Web Service → Connect repo
  Root Directory: apps/backend
  Runtime: Docker
  Health Check Path: /api/health
```

Environment:
```env
DATABASE_URL=<Internal Database URL do passo 5.1>
JWT_SECRET=<openssl rand -hex 32>
BACKEND_CORS_ORIGIN=https://<frontend-name>.onrender.com
NODE_ENV=production
RUN_SEED=true
ADMIN_DEFAULT_PASSWORD=mdv@2026!
```

**5.3 — Frontend (Web Service)**
```
New → Web Service → Connect repo
  Root Directory: apps/frontend
  Runtime: Docker
```

Environment:
```env
NEXT_PUBLIC_API_URL=https://<backend-name>.onrender.com
```

**5.4 — Validar**: mesmos curls do Railway (seção 4.5).

**5.5 — Pós-deploy**: mudar `RUN_SEED=false`.

---

## 6. Endpoints Principais

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Health check (DB + uptime) |
| `POST` | `/api/auth/login` | Login → JWT token |
| `GET` | `/api/auth/me` | Usuário logado |
| **Financeiro — CRUD** | | |
| `POST` | `/api/financeiro/payables` | Criar conta a pagar |
| `GET` | `/api/financeiro/payables` | Listar AP |
| `POST` | `/api/financeiro/payables/:id/approve` | Aprovar AP |
| `POST` | `/api/financeiro/receivables` | Criar conta a receber |
| `GET` | `/api/financeiro/receivables` | Listar AR |
| **Financeiro — Motor** | | |
| `POST` | `/api/finance/payables/:id/post` | Contabilizar AP → LedgerEntry |
| `POST` | `/api/finance/payables/:id/pay` | Pagar AP → CashMovement |
| `POST` | `/api/finance/receivables/:id/post` | Contabilizar AR → LedgerEntry |
| `POST` | `/api/finance/receivables/:id/receive` | Receber AR → CashMovement |
| `POST` | `/api/finance/ledger/:id/reverse` | Estornar lançamento |
| **Relatórios** | | |
| `GET` | `/api/finance/reports/dre` | DRE por competência |
| `GET` | `/api/finance/reports/cashflow` | Fluxo de caixa + projeção |
| **Outros módulos** | | |
| `GET` | `/api/orientacao-cirurgica/kanban` | Board de leads cirúrgicos |
| `GET` | `/api/bi/dashboard` | Dashboard consolidado |
| `GET` | `/api/estoque/critical` | Estoque crítico |
| `GET` | `/api/rh/employees` | Colaboradores |

Swagger (dev/staging): `GET /api/docs`

---

## 7. Checklist Final de Deploy

```
INFRAESTRUTURA
  □  PostgreSQL provisionado
  □  DATABASE_URL configurada e testada
  □  JWT_SECRET gerado (openssl rand -hex 32)

BACKEND
  □  Deploy rodou sem erro
  □  GET /api/health → { "status": "ok", "db": { "status": "connected" } }
  □  BACKEND_CORS_ORIGIN = URL exata do frontend

FRONTEND
  □  NEXT_PUBLIC_API_URL = URL exata do backend (set ANTES do build)
  □  Deploy/build completou sem erro
  □  Página de login carrega em /login

SEED (modo demo)
  □  RUN_SEED=true no primeiro deploy
  □  Login admin / mdv@2026! funciona
  □  RUN_SEED=false após confirmar seed

SMOKE TEST (ver seção 8)
  □  /dashboards mostra KPIs
  □  /financeiro mostra payables do seed
  □  /orientacao-cirurgica mostra leads no kanban
  □  Fluxo completo: criar → aprovar → contabilizar → pagar
  □  DRE mostra seções com valores
  □  Fluxo de caixa mostra tabela diária
```

---

## 8. Smoke Test — Fluxo Completo

Execute após deploy com seed. Use o token retornado no passo 1 em todos os requests.

```bash
API=https://your-backend-url.com/api

# 1. Login
TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"mdv@2026!"}' | jq -r .access_token)
echo "Token: ${TOKEN:0:20}..."

# 2. Listar unidades (via health — units estão no seed)
curl -s $API/health | jq .

# 3. Listar payables (seed criou 5)
curl -s -H "Authorization: Bearer $TOKEN" "$API/financeiro/payables?competence=2026-01"

# 4. Criar um payable novo
NEW_AP=$(curl -s -X POST "$API/financeiro/payables?unit_id=<UNIT_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "supplier_id":"<SUPPLIER_ID>",
    "unit_account_id":"<UA_ID>",
    "description":"Teste smoke – LIO Alcon",
    "competence":"2026-02",
    "due_date":"2026-02-28",
    "value":5000
  }')
AP_ID=$(echo $NEW_AP | jq -r .id)
echo "Payable criado: $AP_ID"

# 5. Aprovar
curl -s -X POST "$API/financeiro/payables/$AP_ID/approve?unit_id=<UNIT_ID>" \
  -H "Authorization: Bearer $TOKEN"

# 6. Contabilizar (→ LedgerEntry)
curl -s -X POST "$API/finance/payables/$AP_ID/post" \
  -H "Authorization: Bearer $TOKEN" | jq .type
# Espera: "DEBIT"

# 7. Pagar (→ CashMovement)
curl -s -X POST "$API/finance/payables/$AP_ID/pay" \
  -H "Authorization: Bearer $TOKEN" | jq .direction
# Espera: "OUT"

# 8. Criar receivable + contabilizar + receber
NEW_AR=$(curl -s -X POST "$API/financeiro/receivables?unit_id=<UNIT_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "source":"Consulta particular teste",
    "unit_account_id":"<UA_RECEITA_ID>",
    "competence":"2026-02",
    "expected_date":"2026-02-28",
    "gross_value":2000,
    "net_value":2000
  }')
AR_ID=$(echo $NEW_AR | jq -r .id)

curl -s -X POST "$API/finance/receivables/$AR_ID/post" \
  -H "Authorization: Bearer $TOKEN" | jq .type
# Espera: "CREDIT"

curl -s -X POST "$API/finance/receivables/$AR_ID/receive" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"payment_method":"PIX"}' | jq .direction
# Espera: "IN"

# 9. DRE
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/finance/reports/dre?from=2026-02&to=2026-02" | jq .summary

# 10. Fluxo de caixa
curl -s -H "Authorization: Bearer $TOKEN" \
  "$API/finance/reports/cashflow?from=2026-02-01&to=2026-02-28&projection_days=30" \
  | jq '{total_in, total_out, net_balance, days: (.daily | length)}'
```

---

## 9. Modo Demo (Seed)

O seed (`RUN_SEED=true`) cria:

| Entidade | Qtd | Detalhes |
|---|---|---|
| Unidades | 5 | São Camilo, Santa Casa, SUS Campinas, CME, Clínica Central |
| Usuários | 3 | admin (FULL), financeiro (FINANCEIRO), secretaria.sc (SECRETARIA) |
| Plano de contas | 41 | 4 níveis: Receitas (3.x), Despesas (4.x), DRE mapeado |
| Unit accounts | ~120 | Contas analíticas × 5 unidades |
| Fornecedores | 3 | Alcon, Zeiss, Farmácia Hospitalar |
| Conta bancária | 1 | Bradesco ag 1234 |
| Payables | 5 | LIOs, medicamentos, aluguel, energia, software |
| Receivables | 5 | Consultas, cirurgias, exames (particular + convênio) |
| Leads cirúrgicos | 5 | Catarata, pterígio, glaucoma, retina |
| Colaboradores | 3 | Médico, enfermeira, técnico |
| Estoque | 3 | LIO, colírio, luvas (com níveis) |

Senha padrão de todos: **mdv@2026!** (configurável via `ADMIN_DEFAULT_PASSWORD`)

---

## 10. Estrutura do Projeto

```
erp-mdv/
├── apps/
│   ├── backend/                    # NestJS API (3001)
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 45 models
│   │   │   └── seed.ts             # Dados demo
│   │   ├── src/
│   │   │   ├── auth/               # JWT, RBAC, permissions
│   │   │   ├── modules/
│   │   │   │   ├── financeiro/     # AP/AR + Motor contábil + DRE
│   │   │   │   ├── orientacao-cirurgica/
│   │   │   │   ├── estoque/
│   │   │   │   ├── rh/
│   │   │   │   ├── bi/
│   │   │   │   └── ai/
│   │   │   └── common/             # Guards, filters, interceptors
│   │   ├── Dockerfile
│   │   └── docker-entrypoint.sh
│   └── frontend/                   # Next.js 14 (3000)
│       ├── src/
│       │   ├── app/(authenticated)/
│       │   │   ├── financeiro/     # AP/AR + DRE + Cashflow
│       │   │   ├── orientacao-cirurgica/  # Kanban + Fila + Patologias
│       │   │   ├── dashboards/
│       │   │   ├── estoque/
│       │   │   └── rh/
│       │   ├── modules/orientacao-cirurgica/  # 14 componentes
│       │   └── lib/                # API client, auth store
│       └── Dockerfile
├── docker-compose.yml              # Dev (hot reload)
├── docker-compose.prod.yml         # Prod local
├── render.yaml                     # Render Blueprint
├── .env.example
└── README.md
```
