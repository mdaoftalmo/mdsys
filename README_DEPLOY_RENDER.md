# ERP MDV — Deploy no Render (Guia Completo)

## Arquitetura

```
Browser → [Render: erp-mdv-web] → [Render: erp-mdv-api] → [Render: PostgreSQL]
            Next.js :3000              NestJS :3001             postgres :5432
            standalone ~50MB           dist/main ~120MB         starter (free)
```

---

## Caminho Rápido: Blueprint (1 clique)

O arquivo `render.yaml` na raiz do repo cria tudo automaticamente.

### Passo a passo

1. **Push** o código para GitHub (ou GitLab)

2. **Render Dashboard** → **New** → **Blueprint**

3. **Conectar repositório** → Render lê `render.yaml` e cria:

   | Recurso | Nome | Tipo |
   |---------|------|------|
   | Database | `erp-mdv-db` | PostgreSQL starter |
   | Backend | `erp-mdv-api` | Docker web service |
   | Frontend | `erp-mdv-web` | Docker web service |

4. **Aguardar deploy** (~5-8 min primeiro build)

5. **Primeiro deploy** já roda seed automaticamente (`RUN_SEED=true` no yaml)

6. **Após seed funcionar**: trocar `RUN_SEED` para `false` no Environment do backend

---

## Variáveis de Ambiente

### Backend (`erp-mdv-api`)

| Variável | Valor | Nota |
|----------|-------|------|
| `DATABASE_URL` | Auto (fromDatabase) | Render injeta |
| `JWT_SECRET` | Auto (generateValue) | Render gera |
| `BACKEND_CORS_ORIGIN` | `https://erp-mdv-web.onrender.com` | URL exata do frontend |
| `NODE_ENV` | `production` | Desabilita Swagger |
| `BACKEND_PORT` | `3001` | |
| `RUN_SEED` | `true` → `false` | true só no 1º deploy |
| `ADMIN_DEFAULT_PASSWORD` | `mdv@2026!` | Trocar em prod |

### Frontend (`erp-mdv-web`)

| Variável | Valor | Nota |
|----------|-------|------|
| `NEXT_PUBLIC_API_URL` | `https://erp-mdv-api.onrender.com` | **BUILD-TIME** |
| `NODE_ENV` | `production` | |

> **IMPORTANTE:** `NEXT_PUBLIC_API_URL` é injetada no build. Se mudar, precisa **rebuild** (Manual Deploy → Clear cache & deploy).

---

## Passo a Passo Manual (sem Blueprint)

Se preferir criar os serviços manualmente:

### 1. PostgreSQL

- New → PostgreSQL
- Name: `erp-mdv-db`
- Database: `erp_mdv`
- User: `erp_user`
- Plan: Starter (free)
- Copiar **Internal Database URL**

### 2. Backend

- New → Web Service → Connect repo
- **Root Directory:** `apps/backend`
- **Environment:** Docker
- **Dockerfile Path:** `Dockerfile`
- **Health Check Path:** `/api/health`
- Adicionar variáveis (tabela acima)
- `DATABASE_URL` = Internal Database URL copiada

### 3. Frontend

- New → Web Service → Connect repo
- **Root Directory:** `apps/frontend`
- **Environment:** Docker
- **Dockerfile Path:** `Dockerfile`
- Adicionar variáveis (tabela acima)

### 4. Ajustar URLs cruzadas

- Backend `BACKEND_CORS_ORIGIN` = URL do frontend
- Frontend `NEXT_PUBLIC_API_URL` = URL do backend
- **Rebuild frontend** (Clear cache & deploy)

---

## Como o Deploy Funciona (Fluxo Interno)

```
1. Build:
   Dockerfile → multi-stage → imagem Docker

2. Startup (docker-entrypoint.sh):
   ├─ Detecta migrations em prisma/migrations/
   │  ├─ SIM → npx prisma migrate deploy
   │  └─ NÃO → npx prisma db push (1º deploy)
   ├─ RUN_SEED=true? → npx prisma db seed
   └─ node dist/main (backend) ou node server.js (frontend)

3. Health Check:
   Backend: GET /api/health
   Frontend: GET /
```

### Sobre Migrations

O entrypoint detecta automaticamente:
- **Primeiro deploy** (sem pasta `prisma/migrations/`): usa `db push` para criar o schema
- **Deploys subsequentes** (com migrations): usa `migrate deploy` para aplicar pendentes

Para criar uma migration em dev:
```bash
cd apps/backend
npx prisma migrate dev --name nome_da_alteracao
git add prisma/migrations
git push  # Render aplica automaticamente no próximo deploy
```

---

## Seed — Dados Demo

O seed cria (via `npx prisma db seed`):

| Dado | Qtd | Detalhe |
|------|-----|---------|
| Unidades | 5 | São Camilo, Santa Casa, SUS Campinas, CME, Clínica Central |
| Usuários | 3 | admin (FULL), financeiro (FINANCEIRO), secretaria.sc (SECRETARIA) |
| Plano de Contas | 41 | Árvore contábil 4 níveis (3.x receitas, 4.x despesas) |
| Contas/Unidade | ~120 | Analíticas × 5 unidades |
| Fornecedores | 3 | Alcon, Zeiss, Farmácia Hospitalar |
| Contas a Pagar | 5 | PENDENTE, APROVADO, PAGO |
| Contas a Receber | 5 | PREVISTO, RECEBIDO |
| Pacientes | 6 | Com CPF, telefone, notas clínicas |
| Leads Cirúrgicos | 5 | Pipeline PRIMEIRA → FECHOU |
| Funcionários | 3 | Médico, enfermeira, técnico |
| Estoque | 3 | LIO, colírio, luva (com níveis) |

**Login:** `admin` / `mdv@2026!`

---

## Smoke Test Pós-Deploy

```bash
# Usar o script automatizado:
./scripts/smoke-test-full.sh https://erp-mdv-api.onrender.com/api

# Ou manual rápido:
API=https://erp-mdv-api.onrender.com/api

TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"admin","password":"mdv@2026!"}' | jq -r .access_token)

curl -s -H "Authorization: Bearer $TOKEN" $API/health | jq .status
curl -s -H "Authorization: Bearer $TOKEN" $API/units | jq '.[].name'
curl -s -H "Authorization: Bearer $TOKEN" "$API/patients?limit=3" | jq '.meta.total'

# Frontend:
open https://erp-mdv-web.onrender.com
```

---

## Troubleshooting Render

### Build falhou: "bcrypt"
O Dockerfile já inclui `python3 make g++`. Se falhar, verificar que o **Root Directory** está em `apps/backend` e o **Dockerfile Path** é `Dockerfile` (não `./apps/backend/Dockerfile`).

### 502 Bad Gateway
O backend demora ~30s para iniciar (migrations + Prisma). Aguardar e recarregar. O health check path `/api/health` detecta quando está pronto.

### CORS error no frontend
`BACKEND_CORS_ORIGIN` deve conter a URL **exata** do frontend (sem barra final). Exemplo: `https://erp-mdv-web.onrender.com`

### Frontend não carrega dados
`NEXT_PUBLIC_API_URL` é **build-time**. Se mudou a URL do backend, precisa rebuild: Dashboard → Manual Deploy → **Clear build cache & deploy**.

### Free tier dorme
Serviços gratuitos desligam após 15min sem tráfego. Primeira request leva ~30s para "acordar". Considere upgrade para pago em produção.

### Seed falhou
Verificar logs do backend. O seed é idempotente (usa `upsert`), pode rodar novamente via Shell do Render:
```bash
npx prisma db seed
```

### Migration falhou
Se o schema mudou e não há migration:
```bash
# Via Shell do Render:
npx prisma db push --accept-data-loss
```

---

## Endpoints Disponíveis

| Método | Rota | Módulo |
|--------|------|--------|
| POST | `/api/auth/login` | Auth |
| GET | `/api/health` | Health |
| GET | `/api/units` | Units (dropdown) |
| GET/POST/PATCH | `/api/patients` | Pacientes |
| GET/POST/PATCH | `/api/financeiro/payables` | Contas a Pagar |
| GET/POST | `/api/financeiro/receivables` | Contas a Receber |
| POST | `/api/finance/payables/:id/post\|pay` | Engine AP |
| POST | `/api/finance/receivables/:id/post\|receive` | Engine AR |
| GET | `/api/finance/reports/dre` | DRE |
| GET | `/api/finance/reports/cashflow` | Fluxo de Caixa |
| GET/POST/PATCH | `/api/orientacao-cirurgica` | Leads Cirúrgicos |
| GET/PATCH | `/api/estoque` | Estoque |
| GET | `/api/rh` | RH |
| GET | `/api/bi/*` | BI |

**Swagger:** `https://erp-mdv-api.onrender.com/api/docs` (apenas em dev, desabilitado em production)

---

## Checklist de Deploy

- [ ] Código no GitHub/GitLab
- [ ] Blueprint criado ou serviços manuais configurados
- [ ] DATABASE_URL apontando para PostgreSQL
- [ ] JWT_SECRET gerado (Render auto-gera no Blueprint)
- [ ] BACKEND_CORS_ORIGIN = URL exata do frontend
- [ ] NEXT_PUBLIC_API_URL = URL exata do backend
- [ ] RUN_SEED=true no primeiro deploy
- [ ] Health check: GET /api/health retorna `{"status":"ok"}`
- [ ] Login funciona: admin / mdv@2026!
- [ ] Frontend carrega: /financeiro, /pacientes, /orientacao-cirurgica
- [ ] Smoke test full: `./scripts/smoke-test-full.sh`
- [ ] RUN_SEED trocado para false após seed confirmar
- [ ] ADMIN_DEFAULT_PASSWORD trocado em produção real

---

## Segurança (Produção Real)

- [ ] JWT_SECRET único (32+ bytes hex)
- [ ] ADMIN_DEFAULT_PASSWORD trocado
- [ ] NODE_ENV=production (desabilita Swagger)
- [ ] HTTPS em todos os serviços (Render faz automaticamente)
- [ ] DATABASE_URL com SSL: `?sslmode=require` (Render interno já é SSL)
- [ ] RUN_SEED=false permanentemente
- [ ] Rate limiting ativo (60 req/min default)
- [ ] CORS restrito à URL exata do frontend
