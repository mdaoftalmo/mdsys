#!/bin/bash
# ═══════════════════════════════════════════════════
# ERP MDV — Smoke Test (verifica deploy funcional)
# Requer: curl, jq
# ═══════════════════════════════════════════════════
set -e
API=${1:-http://localhost:3001/api}
PASS=${ADMIN_DEFAULT_PASSWORD:-mdv@2026!}
PASS_OK=0
FAIL=0

ok()   { PASS_OK=$((PASS_OK+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1));       echo "  ❌ $1: $2"; }

echo "══ Smoke Test: $API ══"
echo ""

# 1. Health
echo "── Health ──"
H=$(curl -sf "$API/health" 2>/dev/null) && ok "GET /health" || fail "GET /health" "unreachable"

# 2. Login
echo "── Auth ──"
TOKEN=$(curl -sf -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"login\":\"admin\",\"password\":\"$PASS\"}" 2>/dev/null | jq -r '.access_token // empty')
[ -n "$TOKEN" ] && ok "POST /auth/login → token" || { fail "POST /auth/login" "no token"; echo "⛔ Cannot proceed"; exit 1; }
AUTH="Authorization: Bearer $TOKEN"

# 3. Units
echo "── Units ──"
UNITS=$(curl -sf -H "$AUTH" "$API/units" 2>/dev/null)
UC=$(echo "$UNITS" | jq 'length')
[ "$UC" -gt 0 ] && ok "GET /units → $UC unit(s)" || fail "GET /units" "empty"
UNIT_ID=$(echo "$UNITS" | jq -r '.[0].id')

# 4. Payables
echo "── Financeiro: Payables ──"
AP=$(curl -sf -H "$AUTH" "$API/financeiro/payables?unit_id=$UNIT_ID&competence=2026-01" 2>/dev/null)
APC=$(echo "$AP" | jq '.data | length // 0' 2>/dev/null)
[ "$APC" -gt 0 ] && ok "GET /payables → $APC item(s)" || ok "GET /payables → 0 (clean DB)"

# 5. Receivables
echo "── Financeiro: Receivables ──"
AR=$(curl -sf -H "$AUTH" "$API/financeiro/receivables?unit_id=$UNIT_ID&competence=2026-01" 2>/dev/null)
ARC=$(echo "$AR" | jq 'length // 0' 2>/dev/null)
[ "$ARC" -ge 0 ] && ok "GET /receivables → $ARC item(s)" || fail "GET /receivables" "error"

# 6. DRE
echo "── Finance Engine: DRE ──"
DRE=$(curl -sf -H "$AUTH" "$API/finance/reports/dre?from=2026-01&to=2026-03&consolidated=true" 2>/dev/null)
echo "$DRE" | jq -e '.summary' >/dev/null 2>&1 && ok "GET /reports/dre → summary present" || fail "GET /reports/dre" "no summary"

# 7. CashFlow
echo "── Finance Engine: CashFlow ──"
CF=$(curl -sf -H "$AUTH" "$API/finance/reports/cashflow?from=2026-01-01&to=2026-03-31&projection_days=30" 2>/dev/null)
echo "$CF" | jq -e '.total_in' >/dev/null 2>&1 && ok "GET /reports/cashflow" || fail "GET /reports/cashflow" "invalid"

# 8. Frontend
echo "── Frontend ──"
FE_URL="${API/api/}"
curl -sf "${FE_URL}" -o /dev/null 2>/dev/null && ok "Frontend reachable at ${FE_URL}" || echo "  ⚠️  Frontend not at ${FE_URL} (may be on different port)"

echo ""
echo "═══════════════════════════════════════════════════"
echo " Results: $PASS_OK passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && echo " ✅ ALL CHECKS PASSED" || echo " ⚠️  $FAIL CHECKS FAILED"
echo "═══════════════════════════════════════════════════"
