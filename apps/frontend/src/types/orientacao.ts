// types/orientacao.ts — DTOs e configs do módulo Orientação Cirúrgica

import type { SurgicalLead, LeadStatus, LeadContact } from './index';

// ── Reexports para conveniência ──
export type { SurgicalLead, LeadStatus, LeadContact };

// ── API Shapes ──

export interface KanbanResponse {
  columns: Record<LeadStatus, SurgicalLead[]>;
  stats: {
    total: number;
    fechou: number;
    perdido: number;
    em_pipeline: number;
    conversion_rate_pct: number;
  };
}

export interface LeadListResponse {
  data: SurgicalLead[];
  total: number;
  page: number;
  limit: number;
}

export interface FunnelStat {
  status: LeadStatus;
  pathology: string;
  count: number;
  avg_score: number;
}

// ── Create / Update DTOs ──

export interface CreateLeadDto {
  name: string;
  phone: string;
  pathology: string;
  responsavel?: string;
  email?: string;
  cpf?: string;
  procedure?: string;
  eye?: string;
  interest?: string;
  barriers?: string[];
  has_insurance?: boolean;
  insurance_name?: string;
  desired_timeframe?: string;
  notes?: string;
}

export interface RegisterContactDto {
  contacted_by: string;
  channel: 'Telefone' | 'WhatsApp' | 'Presencial' | 'Email';
  result?: string;
  notes?: string;
  scheduled_surgery_date?: string;
}

export interface ChangeStatusDto {
  status: LeadStatus;
  lost_reason?: string;
}

// ── UI Config ──

export const LEAD_STATUS_CONFIG: Record<LeadStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  PRIMEIRA:  { label: 'Primeira',   color: '#6366f1', bgColor: '#eef2ff', borderColor: '#c7d2fe' },
  PROPENSO:  { label: 'Propenso',   color: '#10b981', bgColor: '#ecfdf5', borderColor: '#a7f3d0' },
  INDECISO:  { label: 'Indeciso',   color: '#f59e0b', bgColor: '#fffbeb', borderColor: '#fde68a' },
  RETORNO:   { label: 'Retorno',    color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe' },
  PACIENTE:  { label: 'Paciente',   color: '#8b5cf6', bgColor: '#f5f3ff', borderColor: '#ddd6fe' },
  POS_OP:    { label: 'Pós-Op',     color: '#06b6d4', bgColor: '#ecfeff', borderColor: '#a5f3fc' },
  FECHOU:    { label: 'Fechou ✓',   color: '#059669', bgColor: '#d1fae5', borderColor: '#6ee7b7' },
  PERDIDO:   { label: 'Perdido',    color: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca' },
};

export const COLUMN_ORDER: LeadStatus[] = [
  'PRIMEIRA', 'PROPENSO', 'INDECISO', 'RETORNO',
  'PACIENTE', 'POS_OP', 'FECHOU', 'PERDIDO',
];

export const CHANNEL_ICONS: Record<string, string> = {
  Telefone: '📞',
  WhatsApp: '📱',
  Presencial: '🏥',
  Email: '📧',
};

// ── Helpers ──

export function daysSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function contactUrgencyClass(daysSinceContact: number | null): {
  icon: string; textClass: string; label: string;
} {
  if (daysSinceContact === null) return { icon: '⚪', textClass: 'text-gray-400', label: 'Sem contato' };
  if (daysSinceContact <= 7)  return { icon: '🟢', textClass: 'text-gray-500', label: `há ${daysSinceContact}d` };
  if (daysSinceContact <= 30) return { icon: '🟡', textClass: 'text-yellow-600', label: `há ${daysSinceContact}d` };
  if (daysSinceContact <= 60) return { icon: '🟠', textClass: 'text-orange-600 font-medium', label: `há ${daysSinceContact}d` };
  return { icon: '🔴', textClass: 'text-red-600 font-bold', label: `⚠ há ${daysSinceContact}d!` };
}

export function scoreBadgeClass(score: number): string {
  if (score >= 60) return 'bg-green-100 text-green-800 border-green-300';
  if (score >= 35) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  return 'bg-red-100 text-red-800 border-red-300';
}
