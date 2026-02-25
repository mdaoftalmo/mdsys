// src/modules/financeiro/api.ts
// ═══════════════════════════════════════════════
// Finance API — typed fetchers for every endpoint
// ═══════════════════════════════════════════════
import { api } from '@/lib/api';
import type {
  Payable, Receivable, DreReport, CashFlowReport, UnitOption,
} from './types';

// ── Unit Discovery ──
// Uses GET /units (read-only endpoint, returns all active units)
export async function fetchUnits(): Promise<UnitOption[]> {
  const res = await api.get<{ id: string; name: string; cnpj: string; city: string }[]>(
    '/units',
  );
  if (!Array.isArray(res)) return [];
  return res.map((u) => ({ unit_id: u.id, unit_name: u.name }));
}

// ── Payables ──
// GET /financeiro/payables uses @UnitScope → REQUIRES unit_id
interface PayablesResponse { data: Payable[]; meta?: { total: number; page: number } }

export async function fetchPayables(
  unitId: string, competence: string, status?: string,
): Promise<Payable[]> {
  const params = new URLSearchParams({ unit_id: unitId, competence });
  if (status) params.set('status', status);
  const res = await api.get<PayablesResponse | Payable[]>(
    `/financeiro/payables?${params}`,
  );
  return Array.isArray(res) ? res : res.data || [];
}

// ── Receivables ──
// GET /financeiro/receivables uses @UnitScope → REQUIRES unit_id
export async function fetchReceivables(
  unitId: string, competence: string, status?: string,
): Promise<Receivable[]> {
  const params = new URLSearchParams({ unit_id: unitId, competence });
  if (status) params.set('status', status);
  const res = await api.get<Receivable[]>(
    `/financeiro/receivables?${params}`,
  );
  return Array.isArray(res) ? res : [];
}

// ── DRE Report ──
// GET /finance/reports/dre — no @UnitScope, accepts optional unit_id + consolidated
export async function fetchDre(
  from: string, to: string, unitId?: string | null, consolidated?: boolean,
): Promise<DreReport> {
  const params = new URLSearchParams({ from, to });
  if (unitId) params.set('unit_id', unitId);
  if (consolidated) params.set('consolidated', 'true');
  return api.get<DreReport>(`/finance/reports/dre?${params}`);
}

// ── CashFlow Report ──
// GET /finance/reports/cashflow — no @UnitScope, accepts optional unit_id
export async function fetchCashFlow(
  from: string, to: string, unitId?: string | null, projectionDays = 30,
): Promise<CashFlowReport> {
  const params = new URLSearchParams({
    from, to, projection_days: String(projectionDays),
  });
  if (unitId) params.set('unit_id', unitId);
  return api.get<CashFlowReport>(`/finance/reports/cashflow?${params}`);
}

// ── Actions (POST) ──
export async function approvePayable(id: string, unitId: string) {
  return api.post(`/financeiro/payables/${id}/approve?unit_id=${unitId}`, {});
}

export async function postPayable(id: string) {
  return api.post(`/finance/payables/${id}/post`, {});
}

export async function payPayable(id: string) {
  return api.post(`/finance/payables/${id}/pay`, {});
}

export async function postReceivable(id: string) {
  return api.post(`/finance/receivables/${id}/post`, {});
}

export async function receiveReceivable(id: string, paymentMethod = 'PIX') {
  return api.post(`/finance/receivables/${id}/receive`, {
    payment_method: paymentMethod,
  });
}
