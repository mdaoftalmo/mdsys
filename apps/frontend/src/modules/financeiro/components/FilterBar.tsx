// src/modules/financeiro/components/FilterBar.tsx
'use client';
// ═══════════════════════════════════════════════
// FilterBar — Period, Unit dropdown, Consolidated
// ═══════════════════════════════════════════════
import type { FinanceFilters, UnitOption } from '../types';

interface FilterBarProps {
  filters: FinanceFilters;
  onUpdate: <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) => void;
  units: UnitOption[];
  unitsLoading: boolean;
  showRange?: boolean;
}

export default function FilterBar({
  filters, onUpdate, units, unitsLoading, showRange,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* ── Period ── */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {showRange ? 'De' : 'Competência'}
        </label>
        <input
          type="month"
          value={filters.competence}
          onChange={(e) => {
            onUpdate('competence', e.target.value);
            if (!showRange) onUpdate('competenceEnd', e.target.value);
          }}
          className="h-8 px-2 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        {showRange && (
          <>
            <span className="text-xs text-gray-400">até</span>
            <input
              type="month"
              value={filters.competenceEnd}
              onChange={(e) => onUpdate('competenceEnd', e.target.value)}
              className="h-8 px-2 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </>
        )}
      </div>

      {/* ── Separator ── */}
      <div className="w-px h-6 bg-gray-200" />

      {/* ── Unit Dropdown ── */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Unidade
        </label>
        <div className="relative">
          <select
            value={filters.unitId ?? '__ALL__'}
            onChange={(e) => {
              const val = e.target.value;
              onUpdate('unitId', val === '__ALL__' ? null : val);
            }}
            disabled={unitsLoading}
            className="h-8 pl-2 pr-7 text-xs border border-gray-300 rounded bg-white text-gray-800 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-400 disabled:opacity-50 min-w-[200px]"
          >
            <option value="__ALL__">
              {unitsLoading ? 'Carregando unidades…' : 'Todas as unidades'}
            </option>
            {units.map((u) => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.unit_name}
              </option>
            ))}
          </select>
          {/* Chevron icon */}
          <svg
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none"
            viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Consolidated indicator */}
        {filters.unitId === null && (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200">
            Consolidado
          </span>
        )}
      </div>
    </div>
  );
}
