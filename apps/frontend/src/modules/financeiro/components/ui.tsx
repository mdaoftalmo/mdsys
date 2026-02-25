// src/modules/financeiro/components/ui.tsx
'use client';
// ═══════════════════════════════════════════════
// Reusable UI Primitives — Finance Module
// ═══════════════════════════════════════════════
import { ReactNode } from 'react';
import { STATUS_CONFIG } from '../types';
import { fmtBRL } from '../format';

// ── Status Badge ──
export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || {
    label: status, bg: 'bg-gray-50', text: 'text-gray-600', ring: 'ring-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold tracking-wide uppercase rounded ring-1 ring-inset ${cfg.bg} ${cfg.text} ${cfg.ring}`}>
      {cfg.label}
    </span>
  );
}

// ── KPI Card ──
interface KpiCardProps {
  label: string;
  value: number;
  subtitle?: string;
  accent?: 'emerald' | 'red' | 'sky' | 'amber' | 'violet' | 'slate';
  isCurrency?: boolean;
}

const ACCENT = {
  emerald: { border: 'border-l-emerald-500', value: 'text-emerald-700' },
  red:     { border: 'border-l-red-500',     value: 'text-red-700' },
  sky:     { border: 'border-l-sky-500',     value: 'text-sky-700' },
  amber:   { border: 'border-l-amber-500',   value: 'text-amber-700' },
  violet:  { border: 'border-l-violet-500',  value: 'text-violet-700' },
  slate:   { border: 'border-l-slate-400',   value: 'text-slate-700' },
};

export function KpiCard({ label, value, subtitle, accent = 'slate', isCurrency = true }: KpiCardProps) {
  const a = ACCENT[accent];
  return (
    <div className={`bg-white border border-gray-200 border-l-4 ${a.border} px-5 py-4`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${a.value}`}>
        {isCurrency ? fmtBRL(value) : value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}

// ── Section Header ──
export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      {right}
    </div>
  );
}

// ── Loading State ──
export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium">Carregando dados…</span>
      </div>
    </div>
  );
}

// ── Empty State ──
export function EmptyState({ message = 'Nenhum registro encontrado.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Error State ──
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4 text-center max-w-md">
        <p className="text-sm font-medium text-red-800 mb-2">Erro ao carregar</p>
        <p className="text-xs text-red-600 mb-3">{message}</p>
        {onRetry && (
          <button onClick={onRetry} className="text-xs font-semibold text-red-700 hover:text-red-900 underline">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

// ── Unit Required Warning ──
export function UnitRequiredWarning() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-8 py-6 text-center max-w-lg">
        <svg className="w-10 h-10 text-amber-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm font-semibold text-amber-800 mb-1">Selecione uma unidade</p>
        <p className="text-xs text-amber-600">
          Para visualizar Contas a Pagar e Contas a Receber, selecione uma unidade específica no filtro acima.
          O modo "Todas as unidades" está disponível apenas para DRE e Fluxo de Caixa.
        </p>
      </div>
    </div>
  );
}

// ── Error Toast (inline, dismissible) ──
export function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-xs text-red-700 flex justify-between items-center">
      <span>{message}</span>
      <button onClick={onDismiss} className="text-red-500 hover:text-red-800 font-bold ml-4">✕</button>
    </div>
  );
}

// ── Action Button ──
const BTN_VARIANTS = {
  primary: 'bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  danger:  'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost:   'bg-transparent text-slate-600 hover:bg-slate-100 ring-1 ring-inset ring-slate-300 disabled:opacity-40',
};

export function ActionBtn({ label, onClick, disabled, variant = 'ghost' }: {
  label: string; onClick: () => void; disabled?: boolean; variant?: keyof typeof BTN_VARIANTS;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded transition-colors ${BTN_VARIANTS[variant]}`}
    >
      {label}
    </button>
  );
}

// ── Account Label (null-safe: "Sem conta vinculada" if null) ──
export function AccountLabel({ account }: {
  account: { custom_name: string | null; master_account: { code: string; name: string } } | null | undefined;
}) {
  if (!account) {
    return <span className="text-xs italic text-amber-500">Sem conta vinculada</span>;
  }
  return (
    <span className="text-xs text-gray-400 tabular-nums">
      {account.master_account.code} · {account.custom_name || account.master_account.name}
    </span>
  );
}

// ── Table Primitives ──
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' | 'center' }) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`${a} px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200`}>
      {children}
    </th>
  );
}

export function Td({ children, align = 'left', mono, bold, className = '' }: {
  children: ReactNode; align?: 'left' | 'right' | 'center'; mono?: boolean; bold?: boolean; className?: string;
}) {
  const a = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`${a} px-4 py-3 ${mono ? 'tabular-nums font-mono text-xs' : ''} ${bold ? 'font-semibold' : ''} ${className}`}>
      {children}
    </td>
  );
}

// ── Filter Pill Buttons ──
export function FilterPills({ options, value, onChange }: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
            value === o.key
              ? 'bg-slate-800 text-white'
              : 'bg-white text-gray-600 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
