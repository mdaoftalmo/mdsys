# ═══════════════════════════════════════════════════════════════
# PARTE A — PROPOSTA FINAL DE ENTIDADES E RELAÇÕES
# Modelo Financeiro: Plano Mestre + Ledger + Caixa
# ═══════════════════════════════════════════════════════════════

## MAPEAMENTO OLD → NEW

| Existente (chart_accounts)     | Novo (master_accounts)              | Ação             |
|-------------------------------|-------------------------------------|------------------|
| ChartAccount.id               | MasterAccount.id                    | Mantém UUID      |
| ChartAccount.code             | MasterAccount.code                  | Mantém           |
| ChartAccount.name             | MasterAccount.name                  | Mantém           |
| ChartAccount.type (RECEITA/DESPESA/PATRIMONIO) | MasterAccount.nature (RECEITA/DESPESA/PATRIMONIO) | Rename field |
| —                             | MasterAccount.dre_section           | NOVO             |
| —                             | MasterAccount.parent_id             | NOVO (hierarquia) |
| —                             | MasterAccount.level                 | NOVO             |
| —                             | MasterAccount.is_group              | NOVO             |
| —                             | MasterAccount.is_locked             | NOVO (governança) |
| Payable.chart_account         | Payable.unit_account                | Muda FK          |

## ENTIDADES NOVAS

### 1. MasterAccount (@@map "master_accounts")
- Plano de Contas do GRUPO. Global (sem unit_id).
- Hierárquico: parent_id self-relation, level 1-5.
- is_group: true = agrupador (não recebe lançamentos), false = conta analítica.
- is_locked: true = só admin grupo altera.
- dre_section: enum que identifica a posição na DRE (RECEITA_BRUTA, DEDUCOES, CUSTOS...).
- nature: RECEITA ou DESPESA ou PATRIMONIO.
- Regra: Não excluir se houver UnitAccount vinculado.

### 2. UnitAccount (@@map "unit_accounts")
- Plano por unidade. SEMPRE referencia master_account_id (obrigatório).
- unit_id obrigatório.
- Pode ter nome customizado (ex: master "Material Cirúrgico" → unidade "Lentes IOL").
- is_active: permite desativar conta para unidade sem afetar o mestre.
- Unique: (unit_id, master_account_id) — 1:1 por unidade.

### 3. LedgerEntry (@@map "ledger_entries")
- Lançamento contábil por COMPETÊNCIA. Gerado ao aprovar AP ou lançar AR.
- Campos: unit_id, unit_account_id, competence, amount, type (DEBIT/CREDIT).
- source_type + source_id: polimórfico (PAYABLE/RECEIVABLE).
- entry_date: data do lançamento.
- Unique: (source_type, source_id) — garante idempotência.
- Regra: APPEND-ONLY. Para estornar: cria contra-lançamento (type inverso).

### 4. CashMovement (@@map "cash_movements")
- Movimento de CAIXA. Gerado ao pagar AP ou receber AR.
- Campos: unit_id, unit_account_id, amount, movement_date, bank_account_id.
- source_type + source_id: polimórfico (PAYABLE/RECEIVABLE).
- direction: IN ou OUT.
- Unique: (source_type, source_id) — garante idempotência.
- Link com bank_account para conciliação.

## FLUXO DE DADOS

```
AP Criado (PENDENTE) → Sem efeito contábil
      │
      ▼
AP Aprovado (APROVADO) → Gera LedgerEntry (competência, DEBIT)
      │                    ↑ idempotente: unique(source_type, source_id)
      ▼
AP Pago (PAGO) → Gera CashMovement (data pgto, OUT)
                   ↑ idempotente: unique(source_type, source_id)

AR Lançado (PREVISTO) → Gera LedgerEntry (competência, CREDIT)
      │
      ▼
AR Recebido (RECEBIDO) → Gera CashMovement (data recebimento, IN)
```

## DRE = SELECT por master_account.dre_section

```sql
SELECT ma.dre_section, ma.nature, SUM(le.amount)
FROM ledger_entries le
JOIN unit_accounts ua ON ua.id = le.unit_account_id
JOIN master_accounts ma ON ma.id = ua.master_account_id
WHERE le.competence = '2026-01'
  AND le.unit_id = :unit_id
GROUP BY ma.dre_section, ma.nature
ORDER BY ma.dre_section
```

## RELAÇÕES

```
MasterAccount  1 ──── N  UnitAccount
MasterAccount  1 ──── N  MasterAccount (self: parent/children)
UnitAccount    1 ──── N  LedgerEntry
UnitAccount    1 ──── N  CashMovement
UnitAccount    1 ──── N  Payable (substitui chart_account)
Unit           1 ──── N  UnitAccount
Payable        1 ──── 0..1  LedgerEntry (via source_type/source_id)
Payable        1 ──── 0..1  CashMovement (via source_type/source_id)
Receivable     1 ──── 0..1  LedgerEntry
Receivable     1 ──── 0..1  CashMovement
BankAccount    1 ──── N  CashMovement
```
