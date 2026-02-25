// src/modules/financeiro/format.ts
// ═══════════════════════════════════════════════
// Formatters — BRL currency, dates, deltas
// ═══════════════════════════════════════════════

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const DATE_SHORT = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/** Format number as R$ 1.234,56 */
export function fmtBRL(value: number | string | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  return BRL.format(num);
}

/** Format ISO date string as dd/mm/yyyy */
export function fmtDate(date: string | null | undefined): string {
  if (!date) return '—';
  return DATE_SHORT.format(new Date(date));
}

/** Format ISO date as weekday abbreviation (seg, ter, ...) */
export function fmtWeekday(date: string): string {
  return WEEKDAY.format(new Date(date + 'T12:00:00'));
}

/** Days from now (negative = overdue) */
export function daysFromNow(date: string | null | undefined): number | null {
  if (!date) return null;
  return Math.floor((new Date(date).getTime() - Date.now()) / 86400000);
}

/** Format percentage with 1 decimal */
export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Last day of month: "2026-02" → "2026-02-28" */
export function lastDayOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${ym}-${String(last).padStart(2, '0')}`;
}

/** First day of month: "2026-02" → "2026-02-01" */
export function firstDayOfMonth(ym: string): string {
  return `${ym}-01`;
}

/** Current month as "YYYY-MM" */
export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
