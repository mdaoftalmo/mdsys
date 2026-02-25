// src/modules/financeiro/tabs/PayablesTab.tsx
'use client';
// ═══════════════════════════════════════════════
// Contas a Pagar — list + status pills + actions
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { fetchPayables, approvePayable, postPayable, payPayable } from '../api';
import { fmtBRL, fmtDate, daysFromNow } from '../format';
import type { FinanceFilters, Payable } from '../types';
import {
  KpiCard, LoadingState, ErrorState, EmptyState, UnitRequiredWarning,
  Table, Th, Td, StatusBadge, AccountLabel, ActionBtn, FilterPills, ErrorToast,
} from '../components/ui';

interface Props { filters: FinanceFilters; unitRequired: boolean; }

const STATUS_OPTS = [
  { key: '', label: 'Todos' },
  { key: 'PENDENTE', label: 'Pendente' },
  { key: 'APROVADO', label: 'Aprovado' },
  { key: 'PAGO', label: 'Pago' },
  { key: 'AJUSTADO', label: 'Ajustado' },
];

export default function PayablesTab({ filters, unitRequired }: Props) {
  const [items, setItems] = useState<Payable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!filters.unitId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPayables(filters.unitId, filters.competence, statusFilter || undefined)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filters.unitId, filters.competence, statusFilter, tick]);

  const doAction = async (fn: () => Promise<any>) => {
    setActionError(null);
    setBusy('action');
    try {
      await fn();
      reload();
    } catch (e: any) {
      setActionError(e.message);
    } finally {
      setBusy(null);
    }
  };

  if (unitRequired) return <UnitRequiredWarning />;

  // Summaries
  const total = items.reduce((s, p) => s + Number(p.value), 0);
  const pending = items.filter((p) => p.status === 'PENDENTE').reduce((s, p) => s + Number(p.value), 0);
  const approved = items.filter((p) => p.status === 'APROVADO' || p.status === 'AJUSTADO').reduce((s, p) => s + Number(p.value), 0);
  const paid = items.filter((p) => p.status === 'PAGO').reduce((s, p) => s + Number(p.value), 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total no Período" value={total} accent="slate" subtitle={`${items.length} títulos`} />
        <KpiCard label="Pendentes" value={pending} accent="amber" />
        <KpiCard label="Aprovados (a pagar)" value={approved} accent="sky" />
        <KpiCard label="Pagos" value={paid} accent="emerald" />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <FilterPills options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
        <p className="text-xs text-gray-400">{items.length} registro{items.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Action error toast */}
      {actionError && <ErrorToast message={actionError} onDismiss={() => setActionError(null)} />}

      {/* Table */}
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> :
       items.length === 0 ? <EmptyState message="Nenhuma conta a pagar neste período." /> : (
        <Table>
          <thead>
            <tr>
              <Th>Descrição / Conta</Th>
              <Th>Fornecedor</Th>
              <Th>Competência</Th>
              <Th>Vencimento</Th>
              <Th align="right">Valor</Th>
              <Th align="center">Status</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((p) => {
              const days = daysFromNow(p.due_date);
              const overdue = days !== null && days < 0 && p.status !== 'PAGO' && p.status !== 'CANCELADO';
              return (
                <tr key={p.id} className={`hover:bg-gray-50/60 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                  <Td>
                    <div className="font-semibold text-gray-900 text-sm">{p.description}</div>
                    <AccountLabel account={p.unit_account} />
                  </Td>
                  <Td className="text-gray-600 text-sm">{p.supplier?.name || '—'}</Td>
                  <Td className="text-gray-500 text-xs font-mono">{p.competence}</Td>
                  <Td>
                    <span className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                      {fmtDate(p.due_date)}
                    </span>
                    {overdue && (
                      <span className="block text-[10px] text-red-500 font-semibold">
                        VENCIDO {Math.abs(days!)}d
                      </span>
                    )}
                    {days !== null && days >= 0 && days <= 3 && p.status !== 'PAGO' && (
                      <span className="block text-[10px] text-amber-600">
                        {days === 0 ? 'HOJE' : `em ${days}d`}
                      </span>
                    )}
                  </Td>
                  <Td align="right" mono bold className="text-gray-900">{fmtBRL(p.value)}</Td>
                  <Td align="center"><StatusBadge status={p.status} /></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === 'PENDENTE' && (
                        <ActionBtn
                          label="Aprovar"
                          variant="success"
                          disabled={busy !== null}
                          onClick={() => doAction(() => approvePayable(p.id, p.unit_id))}
                        />
                      )}
                      {(p.status === 'APROVADO' || p.status === 'AJUSTADO') && (
                        <>
                          <ActionBtn
                            label="Contabilizar"
                            variant="primary"
                            disabled={busy !== null}
                            onClick={() => doAction(() => postPayable(p.id))}
                          />
                          <ActionBtn
                            label="Pagar"
                            variant="success"
                            disabled={busy !== null}
                            onClick={() => doAction(() => payPayable(p.id))}
                          />
                        </>
                      )}
                      {p.status === 'PAGO' && (
                        <span className="text-[10px] text-emerald-500 font-semibold uppercase">Quitado</span>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
