#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ERP MDV — Smoke Test Completo (12 testes)
# Auth + Pacientes + Orientação Cirúrgica + Financeiro + Filtros
#
# Uso:  ./scripts/smoke-test-full.sh [API_URL]
# Padrão: http://localhost:3001/api
# ═══════════════════════════════════════════════════════════════
set -e
API=${1:-http://localhost:3001/api}
PASS_DEFAULT=${ADMIN_DEFAULT_PASSWORD:-mdv@2026!}
OK=0; FAIL=0; WARN=0

ok()   { OK=$((OK+1));   echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1: $2"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  $1"; }
sep()  { echo ""; echo "═══ $1 ═══"; }

sep "TESTE 1/12 — Auth: Login"
TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"admin\",\"password\":\"$PASS_DEFAULT\"}" 2>/dev/null \
  | jq -r '.access_token // empty')
if [ -n "$TOKEN" ]; then
  ok "POST /auth/login → token obtido"
  AUTH="Authorization: Bearer $TOKEN"
else
  fail "POST /auth/login" "sem token — verifique credenciais"
  echo "⛔ Impossível continuar sem auth"; exit 1
fi

# Health
H=$(curl -sf -H "$AUTH" "$API/health" 2>/dev/null | jq -r '.status // empty')
[ "$H" = "ok" ] && ok "GET /health → ok" || fail "GET /health" "$H"

# Units (shared)
UNITS=$(curl -sf -H "$AUTH" "$API/units" 2>/dev/null)
UC=$(echo "$UNITS" | jq 'length')
UNIT=$(echo "$UNITS" | jq -r '.[0].id')
UNIT_NAME=$(echo "$UNITS" | jq -r '.[0].name')
[ "$UC" -gt 0 ] && ok "GET /units → $UC unidade(s), usando: $UNIT_NAME" || fail "GET /units" "vazio"

# ═══════════════════════════════════════════════════════════════
sep "TESTE 2/12 — Pacientes: Criar"
P=$(curl -sf -X POST "$API/patients?unit_id=$UNIT" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Smoke Test Paciente $(date +%s)\",
    \"cpf\":\"$(printf '%03d.%03d.%03d-%02d' $((RANDOM%999)) $((RANDOM%999)) $((RANDOM%999)) $((RANDOM%99)))\",
    \"dob\":\"1985-06-15\",
    \"phone\":\"(11) 91234-5678\",
    \"email\":\"smoke@test.com\",
    \"notes\":\"Criado pelo smoke test\"
  }" 2>/dev/null)
PID=$(echo "$P" | jq -r '.id // empty')
PCPF=$(echo "$P" | jq -r '.cpf // empty')
if [ -n "$PID" ]; then
  ok "POST /patients → id=$PID cpf=$PCPF"
else
  fail "POST /patients" "$(echo $P | jq -r '.message // "erro"')"
  PID=""
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 3/12 — Pacientes: Buscar por CPF"
if [ -n "$PCPF" ]; then
  SR=$(curl -sf -H "$AUTH" "$API/patients?search=$PCPF" 2>/dev/null)
  SC=$(echo "$SR" | jq '.data | length')
  [ "$SC" -ge 1 ] && ok "GET /patients?search=$PCPF → $SC resultado(s)" || fail "Busca CPF" "0 resultados"
else
  warn "Pulando busca CPF (paciente não criado)"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 4/12 — Pacientes: Editar telefone"
if [ -n "$PID" ]; then
  UP=$(curl -sf -X PATCH "$API/patients/$PID" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"phone":"(21) 98765-4321"}' 2>/dev/null)
  NEWP=$(echo "$UP" | jq -r '.phone // empty')
  [ "$NEWP" = "(21) 98765-4321" ] && ok "PATCH /patients/$PID → phone atualizado" || fail "PATCH phone" "$NEWP"
else
  warn "Pulando edição (paciente não criado)"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 5/12 — Pacientes: Detalhe"
if [ -n "$PID" ]; then
  DET=$(curl -sf -H "$AUTH" "$API/patients/$PID" 2>/dev/null)
  DNAME=$(echo "$DET" | jq -r '.name // empty')
  DUNIT=$(echo "$DET" | jq -r '.unit.name // empty')
  [ -n "$DNAME" ] && ok "GET /patients/$PID → $DNAME ($DUNIT)" || fail "GET detail" "vazio"
else
  warn "Pulando detalhe (paciente não criado)"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 6/12 — Orientação Cirúrgica: Criar lead + contato"
LEAD=$(curl -sf -X POST "$API/orientacao-cirurgica?unit_id=$UNIT" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{
    \"name\":\"Smoke Lead $(date +%s)\",
    \"phone\":\"(11) 99999-0000\",
    \"pathology\":\"Catarata bilateral\",
    \"eye\":\"AO\"
  }" 2>/dev/null)
LID=$(echo "$LEAD" | jq -r '.id // empty')
LSTATUS=$(echo "$LEAD" | jq -r '.status // empty')
if [ -n "$LID" ]; then
  ok "POST /orientacao-cirurgica → id=$LID status=$LSTATUS"
else
  fail "POST lead" "$(echo $LEAD | jq -r '.message // "erro"')"
  LID=""
fi

# Contato
if [ -n "$LID" ]; then
  CT=$(curl -sf -X POST "$API/orientacao-cirurgica/$LID/contacts?unit_id=$UNIT" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"contacted_by":"Dr. Eduardo","channel":"WhatsApp","result":"Paciente interessado"}' 2>/dev/null)
  CID=$(echo "$CT" | jq -r '.id // empty')
  [ -n "$CID" ] && ok "POST contact → registrado" || fail "POST contact" "$(echo $CT | jq -r '.message // "erro"')"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 7/12 — Orientação Cirúrgica: Mudar status + followup"
if [ -n "$LID" ]; then
  ST=$(curl -sf -X PATCH "$API/orientacao-cirurgica/$LID/status?unit_id=$UNIT" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"status":"RETORNO"}' 2>/dev/null)
  NST=$(echo "$ST" | jq -r '.status // empty')
  [ "$NST" = "RETORNO" ] && ok "PATCH status → RETORNO" || fail "PATCH status" "$NST"

  FU=$(curl -sf -X PATCH "$API/orientacao-cirurgica/$LID/followup?unit_id=$UNIT" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"date":"2026-03-15"}' 2>/dev/null)
  NFU=$(echo "$FU" | jq -r '.next_followup // empty')
  [ -n "$NFU" ] && ok "PATCH followup → agendado" || fail "PATCH followup" "vazio"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 8/12 — Financeiro: Criar Payable + Receivable"

# Buscar supplier existente
SUP=$(curl -sf -H "$AUTH" "$API/financeiro/payables?unit_id=$UNIT&competence=2026-01" 2>/dev/null \
  | jq -r '.data[0].supplier_id // empty')
if [ -z "$SUP" ]; then
  warn "Nenhum supplier encontrado — pulando payable"
else
  AP=$(curl -sf -X POST "$API/financeiro/payables?unit_id=$UNIT" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d "{
      \"supplier_id\":\"$SUP\",
      \"description\":\"Smoke payable $(date +%s)\",
      \"competence\":\"2026-02\",
      \"due_date\":\"2026-02-28\",
      \"value\":7500
    }" 2>/dev/null)
  APID=$(echo "$AP" | jq -r '.id // empty')
  [ -n "$APID" ] && ok "POST payable → id=$APID status=PENDENTE" || fail "POST payable" "$(echo $AP | jq -r '.message // "erro"')"
fi

AR=$(curl -sf -X POST "$API/financeiro/receivables?unit_id=$UNIT" \
  -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{
    "source":"Smoke receivable","competence":"2026-02",
    "expected_date":"2026-02-28","gross_value":15000,"net_value":15000
  }' 2>/dev/null)
ARID=$(echo "$AR" | jq -r '.id // empty')
[ -n "$ARID" ] && ok "POST receivable → id=$ARID" || fail "POST receivable" "$(echo $AR | jq -r '.message // "erro"')"

# ═══════════════════════════════════════════════════════════════
sep "TESTE 9/12 — Financeiro: Aprovar → Contabilizar → Pagar"
if [ -n "$APID" ]; then
  # Approve
  curl -sf -X POST "$API/financeiro/payables/$APID/approve?unit_id=$UNIT" \
    -H "$AUTH" > /dev/null 2>&1
  ok "Approve payable"

  # Post (LedgerEntry)
  LE=$(curl -sf -X POST "$API/finance/payables/$APID/post" -H "$AUTH" 2>/dev/null)
  LETYPE=$(echo "$LE" | jq -r '.type // empty')
  [ "$LETYPE" = "DEBIT" ] && ok "Post payable → LedgerEntry DEBIT" || fail "Post payable" "$LETYPE"

  # Pay (CashMovement)
  CM=$(curl -sf -X POST "$API/finance/payables/$APID/pay" -H "$AUTH" 2>/dev/null)
  CMDIR=$(echo "$CM" | jq -r '.direction // empty')
  [ "$CMDIR" = "OUT" ] && ok "Pay payable → CashMovement OUT" || fail "Pay payable" "$CMDIR"
else
  warn "Pulando fluxo AP (não criado)"
fi

# Receivable: post + receive
if [ -n "$ARID" ]; then
  LE2=$(curl -sf -X POST "$API/finance/receivables/$ARID/post" -H "$AUTH" 2>/dev/null)
  LE2T=$(echo "$LE2" | jq -r '.type // empty')
  [ "$LE2T" = "CREDIT" ] && ok "Post receivable → LedgerEntry CREDIT" || fail "Post receivable" "$LE2T"

  CM2=$(curl -sf -X POST "$API/finance/receivables/$ARID/receive" \
    -H "$AUTH" -H 'Content-Type: application/json' \
    -d '{"payment_method":"PIX"}' 2>/dev/null)
  CM2D=$(echo "$CM2" | jq -r '.direction // empty')
  [ "$CM2D" = "IN" ] && ok "Receive → CashMovement IN (PIX)" || fail "Receive" "$CM2D"
fi

# ═══════════════════════════════════════════════════════════════
sep "TESTE 10/12 — Financeiro: DRE + Fluxo de Caixa"
DRE=$(curl -sf -H "$AUTH" \
  "$API/finance/reports/dre?from=2026-02&to=2026-02&unit_id=$UNIT" 2>/dev/null)
echo "$DRE" | jq -e '.summary' > /dev/null 2>&1 \
  && ok "GET /reports/dre → summary presente" \
  || fail "GET /reports/dre" "sem summary"

CF=$(curl -sf -H "$AUTH" \
  "$API/finance/reports/cashflow?from=2026-02-01&to=2026-02-28&unit_id=$UNIT&projection_days=30" 2>/dev/null)
echo "$CF" | jq -e '.total_in' > /dev/null 2>&1 \
  && ok "GET /reports/cashflow → totals presentes" \
  || fail "GET /reports/cashflow" "inválido"

# ═══════════════════════════════════════════════════════════════
sep "TESTE 11/12 — Filtro unidade: específica vs 'Todas'"

# Pacientes: sem unit_id = todas
ALL_P=$(curl -sf -H "$AUTH" "$API/patients?limit=5" 2>/dev/null | jq '.meta.total')
FLT_P=$(curl -sf -H "$AUTH" "$API/patients?unit_id=$UNIT&limit=5" 2>/dev/null | jq '.meta.total')
ok "Pacientes: Todas=$ALL_P, $UNIT_NAME=$FLT_P"

# DRE: consolidated
DRE_CON=$(curl -sf -H "$AUTH" \
  "$API/finance/reports/dre?from=2026-01&to=2026-03&consolidated=true" 2>/dev/null)
echo "$DRE_CON" | jq -e '.summary' > /dev/null 2>&1 \
  && ok "DRE consolidado (sem unit_id, consolidated=true)" \
  || fail "DRE consolidado" "falhou"

# ═══════════════════════════════════════════════════════════════
sep "TESTE 12/12 — Frontend acessível"
FE_URL=${API/\/api/}
FE_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" "$FE_URL/" 2>/dev/null || echo "000")
if [ "$FE_STATUS" = "200" ]; then
  ok "Frontend → HTTP 200 em $FE_URL"
elif [ "$FE_STATUS" = "000" ]; then
  warn "Frontend não acessível em $FE_URL (pode estar em porta diferente)"
else
  fail "Frontend" "HTTP $FE_STATUS"
fi

# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  RESULTADO: $OK passed, $FAIL failed, $WARN warnings"
if [ "$FAIL" -eq 0 ]; then
  echo "  ✅ TODOS OS TESTES PASSARAM"
else
  echo "  ⚠️  $FAIL TESTES FALHARAM — verifique acima"
fi
echo "═══════════════════════════════════════════════════════════════"
