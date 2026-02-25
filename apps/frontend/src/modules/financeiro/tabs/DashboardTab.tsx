// src/modules/financeiro/tabs/DashboardTab.tsx
'use client';
// ═══════════════════════════════════════════════
// Dashboard — 8 KPIs + upcoming payables
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { fetchPayables, fetchReceivables } from '../api';
import { fmtBRL, fmtDate } from '../format';
import type { FinanceFilters, Payable, Receivable } from '../types';
import {
  KpiCard, LoadingState, ErrorState, EmptyState, UnitRequiredWarning,
  SectionHeader, Table, Th, Td, StatusBadge,
} from '../components/ui';

interface Props { filters: FinanceFilters; unitRequired: boolean; }

export default function DashboardTab({ filters, unitRequired }: Props) {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!filters.unitId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([
        fetchPayables(filters.unitId, filters.competence),
        fetchReceivables(filters.unitId, filters.competence),
      ]);
      setPayables(p);
      setReceivables(r);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters.unitId, filters.competence]);

  useEffect(() => {
    if (filters.unitId) load();
  }, [filters.unitId, filters.competence, load]);

  // "Todas" selected → show warning
  if (unitRequired) return <UnitRequiredWarning />;

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalAP = payables.reduce((s, p) => s + Number(p.value), 0);
  const totalAR = receivables.reduce((s, r) => s + Number(r.net_value), 0);
  const apPending = payables.filter((p) => p.status === 'PENDENTE').reduce((s, p) => s + Number(p.value), 0);
  const arPending = receivables.filter((r) => r.status === 'PREVISTO').reduce((s, r) => s + Number(r.net_value), 0);
  const apPago = payables.filter((p) => p.status === 'PAGO').reduce((s, p) => s + Number(p.value), 0);
  const arRecebido = receivables.filter((r) => r.status === 'RECEBIDO').reduce((s, r) => s + Number(r.net_value), 0);
  const glosas = receivables.reduce((s, r) => s + Number(r.gloss_value || 0), 0);
  const saldo = totalAR - totalAP;

  return (
    <div className="space-y-6">
      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total a Pagar" value={totalAP} accent="red" subtitle={`${payables.length} títulos`} />
        <KpiCard label="Total a Receber" value={totalAR} accent="emerald" subtitle={`${receivables.length} títulos`} />
        <KpiCard label="Pendente AP" value={apPending} accent="amber" />
        <KpiCard label="Saldo Projetado" value={saldo} accent={saldo >= 0 ? 'sky' : 'red'} />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="AP Pagos" value={apPago} accent="slate" />
        <KpiCard label="AR Recebidos" value={arRecebido} accent="slate" />
        <KpiCard label="AR Pendente" value={arPending} accent="amber" />
        <KpiCard label="Glosas" value={glosas} accent={glosas > 0 ? 'violet' : 'slate'} />
      </div>

      {/* Upcoming payables */}
      <div>
        <SectionHeader title="Próximos Vencimentos — Contas a Pagar" />
        {payables.length === 0 ? (
          <EmptyState message="Nenhuma conta a pagar neste período." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Descrição</Th>
                <Th>Fornecedor</Th>
                <Th align="right">Valor</Th>
                <Th>Vencimento</Th>
                <Th align="center">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payables
                .filter((p) => p.status !== 'PAGO' && p.status !== 'CANCELADO')
                .slice(0, 5)
                .map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <Td bold>{p.description}</Td>
                    <Td className="text-gray-500">{p.supplier?.name || '—'}</Td>
                    <Td align="right" mono>{fmtBRL(p.value)}</Td>
                    <Td className="text-gray-500">{fmtDate(p.due_date)}</Td>
                    <Td align="center"><StatusBadge status={p.status} /></Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}
