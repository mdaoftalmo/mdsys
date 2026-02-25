'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { SurgicalLead, LeadStatus } from '@/types/orientacao';
import { LEAD_STATUS_CONFIG, COLUMN_ORDER, daysSince } from '@/types/orientacao';
import { EmptyState, ErrorBanner } from '@/components/orientacao';

// ── Derived types ──
interface PathologyGroup {
  pathology: string;
  leads: SurgicalLead[];
  byStatus: Record<LeadStatus, SurgicalLead[]>;
  total: number;
  fechou: number;
  perdido: number;
  convRate: number;
  avgScore: number;
  avgDaysSinceContact: number;
  alerts: string[];
}

const PERIOD_OPTIONS = [
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
  { label: 'Últimos 180 dias', days: 180 },
  { label: 'Último ano', days: 365 },
  { label: 'Todos', days: 0 },
];

// ── Status bar colors (inline for the bars) ──
const STATUS_COLORS: Record<LeadStatus, string> = {
  PRIMEIRA: '#6366f1', PROPENSO: '#10b981', INDECISO: '#f59e0b', RETORNO: '#3b82f6',
  PACIENTE: '#8b5cf6', POS_OP: '#06b6d4', FECHOU: '#059669', PERDIDO: '#ef4444',
};

export default function PatologiasPage() {
  const user = useAuthStore((s) => s.user);
  const unitId = user?.unit_id || '';
  const unitParam = unitId ? `?unit_id=${unitId}` : '';
  const router = useRouter();

  // ── Data ──
  const [leads, setLeads] = useState<SurgicalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filters ──
  const [periodDays, setPeriodDays] = useState(90);
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<'total' | 'convRate' | 'avgScore' | 'avgDays'>('total');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Fetch ──
  const fetchLeads = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SurgicalLead[] }>(
        `/orientacao-cirurgica${unitParam}&limit=1000`,
      );
      setLeads(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [unitId, unitParam]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Derived: filter by period ──
  const filteredLeads = useMemo(() => {
    let result = leads;

    if (periodDays > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - periodDays);
      result = result.filter((l) => {
        const d = l.indication_date || l.last_contact_at;
        return d ? new Date(d) >= cutoff : true;
      });
    }

    if (responsavelFilter) {
      result = result.filter((l) => l.responsavel === responsavelFilter);
    }

    return result;
  }, [leads, periodDays, responsavelFilter]);

  const responsaveis = useMemo(
    () => [...new Set(leads.map((l) => l.responsavel).filter(Boolean) as string[])].sort(),
    [leads],
  );

  // ── Group by pathology ──
  const groups = useMemo(() => {
    const map = new Map<string, SurgicalLead[]>();
    for (const lead of filteredLeads) {
      const key = lead.pathology || 'Não informado';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(lead);
    }

    const result: PathologyGroup[] = [];
    for (const [pathology, pLeads] of map.entries()) {
      const byStatus: Record<string, SurgicalLead[]> = {};
      for (const s of COLUMN_ORDER) byStatus[s] = [];
      for (const l of pLeads) {
        if (byStatus[l.status]) byStatus[l.status].push(l);
      }

      const fechou = byStatus.FECHOU?.length || 0;
      const perdido = byStatus.PERDIDO?.length || 0;
      const total = pLeads.length;
      const convRate = total > 0 ? Math.round((fechou / total) * 100) : 0;
      const avgScore = total > 0 ? Math.round(pLeads.reduce((s, l) => s + l.score, 0) / total) : 0;

      const contactDays = pLeads
        .map((l) => daysSince(l.last_contact_at))
        .filter((d): d is number => d !== null);
      const avgDaysSinceContact = contactDays.length > 0
        ? Math.round(contactDays.reduce((a, b) => a + b, 0) / contactDays.length)
        : 0;

      // Generate alerts
      const alerts: string[] = [];
      const pipeline = pLeads.filter((l) => l.status !== 'FECHOU' && l.status !== 'PERDIDO');
      const overdue30 = pipeline.filter((l) => {
        const d = daysSince(l.last_contact_at);
        return d !== null && d > 30;
      });
      if (overdue30.length >= 2) {
        alerts.push(`⚠ ${overdue30.length} leads sem contato há 30+ dias`);
      }
      const indeciso = byStatus.INDECISO?.length || 0;
      if (pipeline.length > 0 && indeciso / pipeline.length >= 0.5) {
        alerts.push(`🔴 ${indeciso} indecisos — possível barreira sistêmica`);
      }
      if (total >= 5 && convRate < 10) {
        alerts.push(`🔴 Conversão abaixo de 10% — revisar abordagem`);
      }
      if (avgScore < 20 && total >= 3) {
        alerts.push(`⚠ Score médio baixo — leads pouco qualificados`);
      }

      result.push({
        pathology,
        leads: pLeads,
        byStatus: byStatus as Record<LeadStatus, SurgicalLead[]>,
        total, fechou, perdido, convRate, avgScore, avgDaysSinceContact, alerts,
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortColumn) {
        case 'convRate': aVal = a.convRate; bVal = b.convRate; break;
        case 'avgScore': aVal = a.avgScore; bVal = b.avgScore; break;
        case 'avgDays': aVal = a.avgDaysSinceContact; bVal = b.avgDaysSinceContact; break;
        default: aVal = a.total; bVal = b.total;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [filteredLeads, sortColumn, sortDir]);

  // ── Totals for comparison table ──
  const totals = useMemo(() => {
    const t = filteredLeads.length;
    const f = filteredLeads.filter((l) => l.status === 'FECHOU').length;
    const scores = filteredLeads.map((l) => l.score);
    const days = filteredLeads.map((l) => daysSince(l.last_contact_at)).filter((d): d is number => d !== null);
    return {
      total: t,
      fechou: f,
      convRate: t > 0 ? Math.round((f / t) * 100) : 0,
      avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      avgDays: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
    };
  }, [filteredLeads]);

  // ── Sort handler ──
  function toggleSort(col: typeof sortColumn) {
    if (sortColumn === col) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  }

  function sortArrow(col: typeof sortColumn) {
    if (sortColumn !== col) return ' ↕';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  }

  // ── Navigate to board with pathology filter ──
  function openBoardFiltered(pathology: string) {
    router.push(`/orientacao-cirurgica?pathology=${encodeURIComponent(pathology)}`);
  }

  // ── Render ──
  if (!unitId) {
    return <EmptyState title="Unidade não selecionada" description="Selecione uma unidade." />;
  }

  return (
    <div className="h-full overflow-y-auto pb-8">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 mb-4">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-medium">Período:</label>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-brand-500/30 outline-none"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.days} value={o.days}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-500 font-medium">Responsável:</label>
          <select
            value={responsavelFilter}
            onChange={(e) => setResponsavelFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-brand-500/30 outline-none"
          >
            <option value="">Todos</option>
            {responsaveis.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={fetchLeads} /></div>}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-44 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Nenhum lead no período"
          description={`Nenhum lead registrado nos últimos ${periodDays || 'todos os'} dias.`}
        />
      ) : (
        <>
          {/* Pathology cards */}
          <div className="space-y-4 mb-6">
            {groups.map((g) => (
              <div key={g.pathology} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800">{g.pathology}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span><strong className="text-gray-700">{g.total}</strong> leads</span>
                    <span>Conversão: <strong className={g.convRate >= 25 ? 'text-green-700' : g.convRate >= 10 ? 'text-yellow-700' : 'text-red-700'}>{g.convRate}%</strong></span>
                    <span>Score médio: <strong className="text-gray-700">{g.avgScore}</strong></span>
                  </div>
                </div>

                {/* Status bars */}
                <div className="px-5 py-3 space-y-1.5">
                  {COLUMN_ORDER.filter((s) => s !== 'POS_OP').map((status) => {
                    const count = g.byStatus[status]?.length || 0;
                    const pct = g.total > 0 ? (count / g.total) * 100 : 0;
                    if (count === 0 && status !== 'FECHOU') return null;

                    return (
                      <div key={status} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-gray-500 text-right">{LEAD_STATUS_CONFIG[status].label}</span>
                        <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                              backgroundColor: STATUS_COLORS[status],
                            }}
                          />
                        </div>
                        <span className="w-6 text-gray-600 font-medium">{count}</span>
                        {status === 'FECHOU' && count > 0 && (
                          <span className="text-green-600">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Alerts */}
                {g.alerts.length > 0 && (
                  <div className="px-5 pb-3 space-y-1">
                    {g.alerts.map((alert, i) => (
                      <p key={i} className={`text-xs font-medium ${alert.startsWith('🔴') ? 'text-red-600' : 'text-yellow-600'}`}>
                        {alert}
                      </p>
                    ))}
                  </div>
                )}

                {/* Link */}
                <div className="px-5 py-2 border-t border-gray-100">
                  <button
                    onClick={() => openBoardFiltered(g.pathology)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium"
                  >
                    Ver leads desta patologia →
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">Tabela Comparativa</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left px-5 py-2 font-medium">Patologia</th>
                    <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('total')}>
                      Leads{sortArrow('total')}
                    </th>
                    <th className="text-right px-3 py-2 font-medium">Fechou</th>
                    <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('convRate')}>
                      Conv.%{sortArrow('convRate')}
                    </th>
                    <th className="text-right px-3 py-2 font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('avgScore')}>
                      Score{sortArrow('avgScore')}
                    </th>
                    <th className="text-right px-5 py-2 font-medium cursor-pointer hover:text-gray-700" onClick={() => toggleSort('avgDays')}>
                      Dias médios{sortArrow('avgDays')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <tr key={g.pathology} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-5 py-2.5 font-medium text-gray-800">{g.pathology}</td>
                      <td className="text-right px-3 py-2.5 text-gray-600">{g.total}</td>
                      <td className="text-right px-3 py-2.5 text-green-700 font-medium">{g.fechou}</td>
                      <td className="text-right px-3 py-2.5">
                        <span className={g.convRate >= 25 ? 'text-green-700 font-medium' : g.convRate >= 10 ? 'text-yellow-700' : 'text-red-600'}>
                          {g.convRate}%
                        </span>
                      </td>
                      <td className="text-right px-3 py-2.5 text-gray-600">{g.avgScore}</td>
                      <td className="text-right px-5 py-2.5 text-gray-600">{g.avgDaysSinceContact}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-700">
                    <td className="px-5 py-2.5">TOTAL</td>
                    <td className="text-right px-3 py-2.5">{totals.total}</td>
                    <td className="text-right px-3 py-2.5 text-green-700">{totals.fechou}</td>
                    <td className="text-right px-3 py-2.5">{totals.convRate}%</td>
                    <td className="text-right px-3 py-2.5">{totals.avgScore}</td>
                    <td className="text-right px-5 py-2.5">{totals.avgDays}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
