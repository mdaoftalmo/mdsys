'use client';

import type { PathologyAnalysis, LeadStatus } from '../types';
import { STATUS_CONFIG, KANBAN_COLUMNS } from '../constants';

interface Props {
  analysis: PathologyAnalysis;
  onViewLeads: (pathology: string) => void;
}

const allStatuses: LeadStatus[] = [...KANBAN_COLUMNS, 'POS_OP', 'PERDIDO'];

export function PathologyCard({ analysis, onViewLeads }: Props) {
  const maxCount = Math.max(...allStatuses.map((s) => analysis.by_status[s] || 0), 1);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-slate-800">{analysis.pathology}</h3>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span><strong className="text-slate-700">{analysis.total}</strong> leads</span>
            <span>Conversão: <strong className={`${analysis.conversion_pct >= 25 ? 'text-emerald-600' : analysis.conversion_pct >= 10 ? 'text-amber-600' : 'text-red-600'}`}>{analysis.conversion_pct}%</strong></span>
            <span>Score médio: <strong className="text-slate-700">{analysis.avg_score}</strong></span>
          </div>
        </div>

        {/* Status bars */}
        <div className="space-y-1.5">
          {allStatuses.map((status) => {
            const count = analysis.by_status[status] || 0;
            if (count === 0 && (status === 'POS_OP' || status === 'RETORNO')) return null;
            const pct = (count / maxCount) * 100;
            const cfg = STATUS_CONFIG[status];

            return (
              <div key={status} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-[72px] text-right truncate">
                  {cfg.label.replace(' ✓', '')}
                </span>
                <div className="flex-1 h-5 bg-slate-50 rounded-md overflow-hidden">
                  <div
                    className={`h-full rounded-md ${cfg.color} ${cfg.border.replace('border-t-', 'bg-').replace('border-t', 'bg')} transition-all`}
                    style={{
                      width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                      backgroundColor: cfg.border.includes('emerald') ? '#10b981' :
                        cfg.border.includes('amber') ? '#f59e0b' :
                        cfg.border.includes('red') ? '#ef4444' :
                        cfg.border.includes('blue') ? '#3b82f6' :
                        cfg.border.includes('violet') ? '#8b5cf6' :
                        cfg.border.includes('green') ? '#16a34a' :
                        cfg.border.includes('cyan') ? '#06b6d4' :
                        '#94a3b8',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-6 text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alerts + footer */}
      <div className="px-5 pb-4 pt-2">
        {analysis.alerts.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {analysis.alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                  alert.severity === 'danger'
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                <span>{alert.severity === 'danger' ? '🔴' : '⚠'}</span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            Tempo médio no funil: {analysis.avg_days_in_funnel} dias
          </span>
          <button
            onClick={() => onViewLeads(analysis.pathology)}
            className="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors"
          >
            Ver leads desta patologia →
          </button>
        </div>
      </div>
    </div>
  );
}
