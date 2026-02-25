// ═══════════════════════════════════════════════════════════════
// Constants — status config, colors, labels, column order
// ═══════════════════════════════════════════════════════════════

import { LeadStatus, ContactChannel, UrgencyLevel } from './types';

// ── Kanban column order (left → right) ──
export const KANBAN_COLUMNS: LeadStatus[] = [
  'PRIMEIRA', 'PROPENSO', 'INDECISO', 'RETORNO', 'PACIENTE', 'FECHOU',
];
export const ARCHIVE_COLUMNS: LeadStatus[] = ['POS_OP', 'PERDIDO'];

// ── Status visual config ──
export const STATUS_CONFIG: Record<LeadStatus, {
  label: string;
  color: string;       // tailwind bg
  text: string;        // tailwind text
  border: string;      // tailwind border-top
  icon: string;
}> = {
  PRIMEIRA:  { label: 'Primeira Consulta', color: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-t-slate-400',   icon: '📋' },
  PROPENSO:  { label: 'Propenso',          color: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-t-emerald-500', icon: '🟢' },
  INDECISO:  { label: 'Indeciso',          color: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-t-amber-500',   icon: '🟡' },
  RETORNO:   { label: 'Retorno',           color: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-t-blue-500',    icon: '🔁' },
  PACIENTE:  { label: 'Paciente',          color: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-t-violet-500',  icon: '🏥' },
  POS_OP:    { label: 'Pós-Op',            color: 'bg-cyan-50',     text: 'text-cyan-700',    border: 'border-t-cyan-500',    icon: '💊' },
  FECHOU:    { label: 'Fechou ✓',          color: 'bg-green-50',    text: 'text-green-700',   border: 'border-t-green-600',   icon: '✅' },
  PERDIDO:   { label: 'Perdido',           color: 'bg-red-50',      text: 'text-red-600',     border: 'border-t-red-500',     icon: '❌' },
};

// ── Score thresholds ──
export const SCORE_THRESHOLDS = {
  high: 60,    // green badge (60-100)
  medium: 35,  // yellow badge (35-59)
  // below medium = red badge
} as const;

// ── Contact days thresholds ──
export const CONTACT_THRESHOLDS = {
  ok: 7,        // 0-7 days → green
  warning: 30,  // 7-30 days → yellow
  danger: 60,   // 30-60 → orange
  // 60+ → red/critical
} as const;

// ── Channel icons ──
export const CHANNEL_ICONS: Record<ContactChannel, string> = {
  Telefone:    '📞',
  WhatsApp:    '💬',
  Presencial:  '🏥',
  Email:       '📧',
};

// ── Barrier options ──
export const BARRIER_OPTIONS = [
  'Preço', 'Medo', 'Agenda', 'Familiar', 'Convênio',
  'Distância', 'Saúde', 'Outro',
] as const;

// ── Pathology options (most common) ──
export const PATHOLOGY_OPTIONS = [
  'Catarata', 'Glaucoma', 'Retina', 'Plástica',
  'Córnea', 'Estrabismo', 'Refrativa',
] as const;

// ── Helper: urgency from days since contact ──
export function getContactUrgency(daysSince: number | null): UrgencyLevel {
  if (daysSince === null) return 'critical';
  if (daysSince <= CONTACT_THRESHOLDS.ok) return 'ok';
  if (daysSince <= CONTACT_THRESHOLDS.warning) return 'warning';
  if (daysSince <= CONTACT_THRESHOLDS.danger) return 'danger';
  return 'critical';
}

// ── Helper: score color ──
export function getScoreColor(score: number): string {
  if (score >= SCORE_THRESHOLDS.high) return 'bg-emerald-500 text-white';
  if (score >= SCORE_THRESHOLDS.medium) return 'bg-amber-400 text-amber-900';
  return 'bg-red-500 text-white';
}

// ── Helper: days since date ──
export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Helper: format relative date ──
export function formatRelativeDate(dateStr: string | null): string {
  const days = daysSince(dateStr);
  if (days === null) return 'Nunca contatado';
  if (days === 0) return 'hoje';
  if (days === 1) return 'há 1 dia';
  return `há ${days} dias`;
}

// ── Helper: format date BR ──
export function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
