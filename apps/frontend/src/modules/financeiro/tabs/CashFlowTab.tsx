// src/modules/financeiro/tabs/CashFlowTab.tsx
'use client';
// ═══════════════════════════════════════════════
// Fluxo de Caixa — daily + by-account views
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { fetchCashFlow } from '../api';
import { fmtBRL, fmtWeekday, firstDayOfMonth, lastDayOfMonth } from '../format';
import type { FinanceFilters, CashFlowReport } from '../types';
import { LoadingState, ErrorState, EmptyState, KpiCard, Table, Th, Td } from '../components/ui';

interface Props { filters: FinanceFilters; }

export default function CashFlowTab({ filters }: Props) {
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'daily' | 'account'>('daily');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = firstDayOfMonth(filters.competence);
      const to = lastDayOfMonth(filters.competenceEnd || filters.competence);
      const res = await fetchCashFlow(from, to, filters.unitId, 30);
      setReport(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters.competence, filters.competenceEnd, filters.unitId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return <EmptyState />;

  const hasData = report.daily.length > 0;
  const realizedDays = report.daily.filter((d) => !d.is_projection);
  const projectedDays = report.daily.filter((d) => d.is_projection);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Entradas" value={report.total_in} accent="emerald" />
        <KpiCard label="Total Saídas" value={report.total_out} accent="red" />
        <KpiCard label="Saldo Líquido" value={report.net_balance} accent={report.net_balance >= 0 ? 'sky' : 'red'} />
        <KpiCard
          label="Dias com Movimento"
          value={report.daily.length}
          accent="slate"
          isCurrency={false}
          subtitle={`${realizedDays.length} realizado · ${projectedDays.length} projeção`}
        />
      </div>

      {/* Period + view toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>Período: <strong className="text-gray-600">{report.from}</strong> a <strong className="text-gray-600">{report.to}</strong></span>
          <span>·</span>
          <span>Projeção: {report.projection_days} dias</span>
        </div>
        <div className="flex gap-1">
          {(['daily', 'account'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                view === v
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
              }`}
            >
              {v === 'daily' ? 'Diário' : 'Por Conta'}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState message="Nenhum movimento de caixa no período. Execute Pagar/Receber nas abas anteriores." />
      ) : view === 'daily' ? (
        /* ── Daily View ── */
        <Table>
          <thead>
            <tr>
              <Th>Data</Th>
              <Th align="center">Tipo</Th>
              <Th align="right">Entradas</Th>
              <Th align="right">Saídas</Th>
              <Th align="right">Saldo Dia</Th>
              <Th align="right">Acumulado</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.daily.map((day) => (
              <tr key={day.date} className={`hover:bg-gray-50/60 transition-colors ${day.is_projection ? 'bg-amber-50/30' : ''}`}>
                <Td>
                  <span className="text-sm text-gray-700 font-mono">{day.date}</span>
                  <span className="block text-[10px] text-gray-400">{fmtWeekday(day.date)}</span>
                </Td>
                <Td align="center">
                  {day.is_projection ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                      Projeção
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                      Realizado
                    </span>
                  )}
                </Td>
                <Td align="right" mono className={day.entries_in > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'}>
                  {day.entries_in > 0 ? fmtBRL(day.entries_in) : '—'}
                </Td>
                <Td align="right" mono className={day.entries_out > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                  {day.entries_out > 0 ? fmtBRL(day.entries_out) : '—'}
                </Td>
                <Td align="right" mono bold className={day.balance >= 0 ? 'text-gray-900' : 'text-red-700'}>
                  {fmtBRL(day.balance)}
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={`text-sm font-bold tabular-nums ${day.cumulative >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {fmtBRL(day.cumulative)}
                    </span>
                    <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                      <div
                        className={`h-full rounded-full transition-all ${day.cumulative >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                        style={{ width: `${Math.min((Math.abs(day.cumulative) / Math.max(report.total_in, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <Td bold className="text-slate-800">TOTAL</Td>
              <Td />
              <Td align="right" mono bold className="text-emerald-700">{fmtBRL(report.total_in)}</Td>
              <Td align="right" mono bold className="text-red-700">{fmtBRL(report.total_out)}</Td>
              <Td align="right" mono bold className={`text-base ${report.net_balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtBRL(report.net_balance)}
              </Td>
              <Td />
            </tr>
          </tfoot>
        </Table>
      ) : (
        /* ── By Account View ── */
        <Table>
          <thead>
            <tr>
              <Th>Código</Th>
              <Th>Conta</Th>
              <Th align="right">Entradas</Th>
              <Th align="right">Saídas</Th>
              <Th align="right">Líquido</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(report.by_account || []).length === 0 ? (
              <tr><td colSpan={5}><EmptyState message="Nenhum movimento por conta disponível." /></td></tr>
            ) : (
              report.by_account.map((acc) => {
                const net = acc.total_in - acc.total_out;
                return (
                  <tr key={acc.account_code} className="hover:bg-gray-50/60">
                    <Td mono className="text-gray-500 text-xs">{acc.account_code}</Td>
                    <Td bold className="text-gray-800 text-sm">{acc.account_name}</Td>
                    <Td align="right" mono className={acc.total_in > 0 ? 'text-emerald-700 font-semibold' : 'text-gray-300'}>
                      {acc.total_in > 0 ? fmtBRL(acc.total_in) : '—'}
                    </Td>
                    <Td align="right" mono className={acc.total_out > 0 ? 'text-red-600 font-semibold' : 'text-gray-300'}>
                      {acc.total_out > 0 ? fmtBRL(acc.total_out) : '—'}
                    </Td>
                    <Td align="right" mono bold className={net >= 0 ? 'text-emerald-700' : 'text-red-700'}>
                      {fmtBRL(net)}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <Td />
              <Td bold className="text-slate-800">TOTAL</Td>
              <Td align="right" mono bold className="text-emerald-700">{fmtBRL(report.total_in)}</Td>
              <Td align="right" mono bold className="text-red-700">{fmtBRL(report.total_out)}</Td>
              <Td align="right" mono bold className={`text-base ${report.net_balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {fmtBRL(report.net_balance)}
              </Td>
            </tr>
          </tfoot>
        </Table>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-gray-400 uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" />
          <span>Realizado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" />
          <span>Projeção ({report.projection_days}d)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
          <span>Saldo Negativo</span>
        </div>
      </div>
    </div>
  );
}
