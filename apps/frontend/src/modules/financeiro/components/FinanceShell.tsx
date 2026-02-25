// src/modules/financeiro/components/FinanceShell.tsx
'use client';
// ═══════════════════════════════════════════════
// Finance Shell — sidebar + header + tab content
// ═══════════════════════════════════════════════
import { ReactNode } from 'react';
import type { FinanceTab, FinanceFilters, UnitOption } from '../types';
import FilterBar from './FilterBar';

const TABS: { key: FinanceTab; label: string; icon: ReactNode }[] = [
  { key: 'dashboard', label: 'Visão Geral',     icon: <IconGrid /> },
  { key: 'pagar',     label: 'Contas a Pagar',   icon: <IconArrowUp /> },
  { key: 'receber',   label: 'Contas a Receber',  icon: <IconArrowDown /> },
  { key: 'dre',       label: 'DRE',               icon: <IconChart /> },
  { key: 'caixa',     label: 'Fluxo de Caixa',    icon: <IconWaves /> },
];

interface ShellProps {
  activeTab: FinanceTab;
  onTabChange: (tab: FinanceTab) => void;
  filters: FinanceFilters;
  onFilterUpdate: <K extends keyof FinanceFilters>(key: K, value: FinanceFilters[K]) => void;
  units: UnitOption[];
  unitsLoading: boolean;
  children: ReactNode;
}

export default function FinanceShell({
  activeTab, onTabChange, filters, onFilterUpdate,
  units, unitsLoading, children,
}: ShellProps) {
  const showRange = activeTab === 'dre' || activeTab === 'caixa';

  return (
    <div className="flex h-[calc(100vh-0px)] -m-6">
      {/* ── Finance Sub-sidebar ── */}
      <aside className="w-56 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800">
        <div className="px-5 pt-6 pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-1">Módulo</p>
          <h2 className="text-lg font-bold tracking-tight">Financeiro</h2>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onTabChange(t.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left text-sm font-medium transition-all ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : ''}`}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider">ERP MDV · Financeiro</p>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        <header className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              {TABS.find((t) => t.key === activeTab)?.label}
            </h1>
            <span className="text-[10px] font-mono text-gray-400 uppercase">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>
          <FilterBar
            filters={filters}
            onUpdate={onFilterUpdate}
            units={units}
            unitsLoading={unitsLoading}
            showRange={showRange}
          />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Inline SVG Icons ──

function IconGrid() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
      <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z" />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M8 13V3m0 0L3 8m5-5l5 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowDown() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M8 3v10m0 0l5-5m-5 5L3 8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M2 14h12M4 10v4m4-8v8m4-6v6" strokeLinecap="round" />
    </svg>
  );
}

function IconWaves() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path d="M1 8c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0" strokeLinecap="round" />
      <path d="M1 12c1.5-3 3-3 4.5 0s3 3 4.5 0 3-3 4.5 0" strokeLinecap="round" opacity=".4" />
    </svg>
  );
}
