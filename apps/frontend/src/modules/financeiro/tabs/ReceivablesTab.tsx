// src/modules/financeiro/tabs/ReceivablesTab.tsx
'use client';
// ═══════════════════════════════════════════════
// Contas a Receber — list + actions + convênio
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { fetchReceivables, postReceivable, receiveReceivable } from '../api';
import { fmtBRL, fmtDate, daysFromNow } from '../format';
import type { FinanceFilters, Receivable } from '../types';
import {
  KpiCard, LoadingState, ErrorState, EmptyState, UnitRequiredWarning,
  Table, Th, Td, StatusBadge, AccountLabel, ActionBtn, FilterPills, ErrorToast,
} from '../components/ui';

interface Props { filters: FinanceFilters; unitRequired: boolean; }

const STATUS_OPTS = [
  { key: '', label: 'Todos' },
  { key: 'PREVISTO', label: 'Previsto' },
  { key: 'RECEBIDO', label: 'Recebido' },
  { key: 'ATRASADO', label: 'Atrasado' },
  { key: 'GLOSADO', label: 'Glosado' },
];

export default function ReceivablesTab({ filters, unitRequired }: Props) {
  const [items, setItems] = useState<Receivable[]>([]);
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
    fetchReceivables(filters.unitId, filters.competence, statusFilter || undefined)
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

  const total = items.reduce((s, r) => s + Number(r.net_value), 0);
  const pending = items.filter((r) => r.status === 'PREVISTO').reduce((s, r) => s + Number(r.net_value), 0);
  const received = items.filter((r) => r.status === 'RECEBIDO').reduce((s, r) => s + Number(r.net_value), 0);
  const glosas = items.reduce((s, r) => s + Number(r.gloss_value || 0), 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Líquido" value={total} accent="emerald" subtitle={`${items.length} títulos`} />
        <KpiCard label="Previsto" value={pending} accent="sky" />
        <KpiCard label="Recebido" value={received} accent="emerald" />
        <KpiCard label="Glosas" value={glosas} accent={glosas > 0 ? 'red' : 'slate'} />
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between">
        <FilterPills options={STATUS_OPTS} value={statusFilter} onChange={setStatusFilter} />
        <p className="text-xs text-gray-400">{items.length} registro{items.length !== 1 ? 's' : ''}</p>
      </div>

      {actionError && <ErrorToast message={actionError} onDismiss={() => setActionError(null)} />}

      {/* Table */}
      {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={reload} /> :
       items.length === 0 ? <EmptyState message="Nenhuma conta a receber neste período." /> : (
        <Table>
          <thead>
            <tr>
              <Th>Origem / Conta</Th>
              <Th align="center">Tipo</Th>
              <Th>Competência</Th>
              <Th>Previsão</Th>
              <Th align="right">Bruto</Th>
              <Th align="right">Líquido</Th>
              <Th align="center">Status</Th>
              <Th align="right">Ações</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((r) => {
              const days = daysFromNow(r.expected_date);
              const overdue = days !== null && days < 0 && r.status === 'PREVISTO';
              return (
                <tr key={r.id} className={`hover:bg-gray-50/60 transition-colors ${overdue ? 'bg-red-50/40' : ''}`}>
                  <Td>
                    <div className="font-semibold text-gray-900 text-sm">{r.source}</div>
                    <AccountLabel account={r.unit_account || null} />
                  </Td>
                  <Td align="center">
                    {r.is_convenio ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200">
                        Convênio
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200">
                        Particular
                      </span>
                    )}
                  </Td>
                  <Td className="text-gray-500 text-xs font-mono">{r.competence}</Td>
                  <Td>
                    <span className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                      {fmtDate(r.expected_date)}
                    </span>
                    {overdue && (
                      <span className="block text-[10px] text-red-500 font-semibold">
                        ATRASADO {Math.abs(days!)}d
                      </span>
                    )}
                  </Td>
                  <Td align="right" mono className="text-gray-500">{fmtBRL(r.gross_value)}</Td>
                  <Td align="right" mono bold className="text-gray-900">{fmtBRL(r.net_value)}</Td>
                  <Td align="center"><StatusBadge status={r.status} /></Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === 'PREVISTO' && (
                        <>
                          <ActionBtn
                            label="Contabilizar"
                            variant="primary"
                            disabled={busy !== null}
                            onClick={() => doAction(() => postReceivable(r.id))}
                          />
                          <ActionBtn
                            label="Receber"
                            variant="success"
                            disabled={busy !== null}
                            onClick={() => doAction(() => receiveReceivable(r.id))}
                          />
                        </>
                      )}
                      {r.status === 'RECEBIDO' && (
                        <span className="text-[10px] text-emerald-500 font-semibold uppercase">Recebido</span>
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
