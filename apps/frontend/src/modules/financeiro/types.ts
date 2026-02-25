// src/modules/financeiro/types.ts
// ═══════════════════════════════════════════════
// Types — mirrors exact backend response shapes
// ═══════════════════════════════════════════════

export type FinanceTab = 'dashboard' | 'pagar' | 'receber' | 'dre' | 'caixa';

// ── Unit Discovery (from GET /bi/revenue-by-unit) ──
export interface UnitOption {
  unit_id: string;
  unit_name: string;
}

// ── Filter State ──
export interface FinanceFilters {
  unitId: string | null;       // null = "Todas as unidades"
  competence: string;          // "2026-02"
  competenceEnd: string;       // for DRE/CashFlow range
  consolidated: boolean;
  statusFilter: string;
}

// ── Payable (from GET /financeiro/payables) ──
export interface Payable {
  id: string;
  unit_id: string;
  description: string;
  value: number;
  original_value: number | null;
  due_date: string;
  status: PayableStatus;
  competence: string;
  payment_method: string;
  supplier_id: string;
  unit_account_id: string | null;
  supplier: { name: string } | null;
  unit_account: {
    id: string;
    custom_name: string | null;
    master_account: { code: string; name: string };
  } | null;
  cost_center: { full_path: string } | null;
}

export type PayableStatus = 'PENDENTE' | 'APROVADO' | 'REPROVADO' | 'AJUSTADO' | 'PAGO' | 'CANCELADO';

// ── Receivable (from GET /financeiro/receivables) ──
export interface Receivable {
  id: string;
  unit_id: string;
  source: string;
  gross_value: number;
  net_value: number;
  gloss_value: number;
  discount: number;
  expected_date: string;
  status: ReceivableStatus;
  competence: string;
  is_convenio: boolean;
  unit_account_id: string | null;
  unit_account?: {
    id: string;
    custom_name: string | null;
    master_account: { code: string; name: string };
  } | null;
}

export type ReceivableStatus = 'PREVISTO' | 'RECEBIDO' | 'ATRASADO' | 'GLOSADO';

// ── DRE Report (from GET /finance/reports/dre) ──
export interface DreSection {
  dre_section: string;
  nature: string;
  total: number;
  entries_count: number;
}

export interface DreSummary {
  receita_bruta: number;
  deducoes: number;
  receita_liquida: number;
  custos: number;
  lucro_bruto: number;
  despesas_operacionais: number;
  ebitda: number;
  depreciacao: number;
  resultado_antes_ir: number;
  impostos: number;
  resultado_liquido: number;
}

export interface DreReport {
  from: string;
  to: string;
  unit_id: string | null;
  consolidated: boolean;
  generated_at: string;
  sections: DreSection[];
  summary: DreSummary;
}

// ── CashFlow Report (from GET /finance/reports/cashflow) ──
export interface CashFlowDay {
  date: string;
  entries_in: number;
  entries_out: number;
  balance: number;
  cumulative: number;
  is_projection: boolean;
}

export interface CashFlowByAccount {
  account_code: string;
  account_name: string;
  total_in: number;
  total_out: number;
}

export interface CashFlowReport {
  from: string;
  to: string;
  unit_id: string | null;
  projection_days: number;
  generated_at: string;
  total_in: number;
  total_out: number;
  net_balance: number;
  daily: CashFlowDay[];
  by_account: CashFlowByAccount[];
}

// ── Constants ──

export const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  PENDENTE:   { label: 'Pendente',   bg: 'bg-amber-50',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  APROVADO:   { label: 'Aprovado',   bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  REPROVADO:  { label: 'Reprovado',  bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200' },
  AJUSTADO:   { label: 'Ajustado',   bg: 'bg-violet-50',  text: 'text-violet-700',  ring: 'ring-violet-200' },
  PAGO:       { label: 'Pago',       bg: 'bg-sky-50',     text: 'text-sky-700',     ring: 'ring-sky-200' },
  CANCELADO:  { label: 'Cancelado',  bg: 'bg-gray-50',    text: 'text-gray-500',    ring: 'ring-gray-200' },
  PREVISTO:   { label: 'Previsto',   bg: 'bg-sky-50',     text: 'text-sky-700',     ring: 'ring-sky-200' },
  RECEBIDO:   { label: 'Recebido',   bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  ATRASADO:   { label: 'Atrasado',   bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200' },
  GLOSADO:    { label: 'Glosado',    bg: 'bg-orange-50',  text: 'text-orange-700',  ring: 'ring-orange-200' },
};

export const DRE_SECTION_LABELS: Record<string, { label: string; sign: '+' | '–' }> = {
  RECEITA_BRUTA:          { label: 'Receita Bruta',                   sign: '+' },
  DEDUCOES_RECEITA:       { label: 'Deduções da Receita',             sign: '–' },
  CUSTO_SERVICO:          { label: 'Custos dos Serviços Prestados',   sign: '–' },
  DESPESA_PESSOAL:        { label: 'Despesas com Pessoal',            sign: '–' },
  DESPESA_ADMINISTRATIVA: { label: 'Despesas Administrativas',        sign: '–' },
  DESPESA_COMERCIAL:      { label: 'Despesas Comerciais',             sign: '–' },
  DESPESA_OCUPACAO:       { label: 'Despesas de Ocupação',            sign: '–' },
  DESPESA_FINANCEIRA:     { label: 'Despesas Financeiras',            sign: '–' },
  RECEITA_FINANCEIRA:     { label: 'Receitas Financeiras',            sign: '+' },
  OUTRAS_RECEITAS:        { label: 'Outras Receitas Operacionais',    sign: '+' },
  OUTRAS_DESPESAS:        { label: 'Outras Despesas Operacionais',    sign: '–' },
  DEPRECIACAO_AMORTIZACAO:{ label: 'Depreciação e Amortização',       sign: '–' },
  IMPOSTOS_RESULTADO:     { label: 'Impostos sobre o Resultado',      sign: '–' },
};
