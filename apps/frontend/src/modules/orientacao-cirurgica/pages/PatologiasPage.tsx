'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { OrientacaoLayout } from '../layout/OrientacaoLayout';
import { PathologyCard, EmptyState, ErrorBanner, ListSkeleton } from '../components';
import { usePatologias, useFilaDoDia } from '../hooks';
import type { PathologyAnalysis, LeadStatus } from '../types';
import { KANBAN_COLUMNS, STATUS_CONFIG } from '../constants';

type SortKey = 'total' | 'conversion_pct' | 'avg_score' | 'avg_days_in_funnel';

export default function PatologiasPage() {
  const { analyses, loading, error, refetch } = usePatologias();
  const { pendingCount } = useFilaDoDia();
  const router = useRouter();

  const [period, setPeriod] = useState('90');
  const [sortBy, setSortBy] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sort analyses
  const sorted = useMemo(() => {
    const arr = [...analyses];
    arr.sort((a, b) => {
      const diff = (a[sortBy] as number) - (b[sortBy] as number);
      return sortDir === 'desc' ? -diff : diff;
    });
    return arr;
  }, [analyses, sortBy, sortDir]);

  // Totals for comparison table
  const totals = useMemo(() => {
    const t = { total: 0, fechou: 0, conversion_pct: 0, avg_score: 0, avg_days: 0 };
    if (analyses.length === 0) return t;
    t.total = analyses.reduce((s, a) => s + a.total, 0);
    t.fechou = analyses.reduce((s, a) => s + a.fechou, 0);
    t.conversion_pct = t.total > 0 ? Math.round((t.fechou / t.total) * 100) : 0;
    t.avg_score = Math.round(analyses.reduce((s, a) => s + a.avg_score * a.total, 0) / t.total);
    t.avg_days = Math.round(analyses.reduce((s, a) => s + a.avg_days_in_funnel * a.total, 0) / t.total);
    return t;
  }, [analyses]);

  const handleViewLeads = (pathology: string) => {
    // Navigate to board with pathology filter pre-applied via query param
    router.push(`/orientacao-cirurgica?pathology=${encodeURIComponent(pathology)}`);
  };

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const SortIndicator = ({ field }: { field: SortKey }) => (
    <span className="ml-1 text-xs">
      {sortBy === field ? (sortDir === 'desc' ? '▾' : '▴') : ''}
    </span>
  );

  return (
    <OrientacaoLayout filaPendingCount={pendingCount}>
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3 mb-5">
        <label className="text-xs font-semibold text-slate-500">Período:</label>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="30">Últimos 30 dias</option>
          <option value="60">Últimos 60 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="180">Últimos 180 dias</option>
          <option value="365">Último ano</option>
        </select>
        <span className="text-xs text-slate-400 ml-auto">
          {analyses.length} patologias · {totals.total} leads total
        </span>
      </div>

      {loading && <ListSkeleton rows={4} />}

      {!loading && analyses.length === 0 && (
        <EmptyState
          icon="🔬"
          title="Nenhum lead registrado"
          description="Quando houver leads no sistema, a análise por patologia aparecerá aqui."
        />
      )}

      {/* Pathology cards */}
      {!loading && sorted.length > 0 && (
        <div className="space-y-4 mb-8">
          {sorted.map((analysis) => (
            <PathologyCard
              key={analysis.pathology}
              analysis={analysis}
              onViewLeads={handleViewLeads}
            />
          ))}
        </div>
      )}

      {/* Comparison table */}
      {!loading && sorted.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-700">Tabela Comparativa</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase">
                    Patologia
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600"
                    onClick={() => toggleSort('total')}
                  >
                    Leads <SortIndicator field="total" />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">
                    Fechou
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600"
                    onClick={() => toggleSort('conversion_pct')}
                  >
                    Conv.% <SortIndicator field="conversion_pct" />
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600"
                    onClick={() => toggleSort('avg_score')}
                  >
                    Score <SortIndicator field="avg_score" />
                  </th>
                  <th
                    className="px-4 py-3 text-xs font-bold text-slate-500 uppercase cursor-pointer hover:text-indigo-600"
                    onClick={() => toggleSort('avg_days_in_funnel')}
                  >
                    Dias médios <SortIndicator field="avg_days_in_funnel" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr
                    key={a.pathology}
                    className="border-t border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors"
                    onClick={() => handleViewLeads(a.pathology)}
                  >
                    <td className="px-5 py-3 font-semibold text-slate-800">{a.pathology}</td>
                    <td className="px-4 py-3 text-slate-700">{a.total}</td>
                    <td className="px-4 py-3 text-emerald-700 font-medium">{a.fechou}</td>
                    <td className={`px-4 py-3 font-semibold ${
                      a.conversion_pct >= 25 ? 'text-emerald-600' :
                      a.conversion_pct >= 10 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {a.conversion_pct}%
                    </td>
                    <td className="px-4 py-3 text-slate-700">{a.avg_score}</td>
                    <td className="px-4 py-3 text-slate-700">{a.avg_days_in_funnel}</td>
                  </tr>
                ))}
                {/* Total row */}
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                  <td className="px-5 py-3 text-slate-800">TOTAL</td>
                  <td className="px-4 py-3 text-slate-800">{totals.total}</td>
                  <td className="px-4 py-3 text-emerald-700">{totals.fechou}</td>
                  <td className="px-4 py-3 text-indigo-700">{totals.conversion_pct}%</td>
                  <td className="px-4 py-3 text-slate-800">{totals.avg_score}</td>
                  <td className="px-4 py-3 text-slate-800">{totals.avg_days}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </OrientacaoLayout>
  );
}
