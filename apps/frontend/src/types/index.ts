// apps/frontend/src/types/index.ts

export type AccessLevel = 'FULL' | 'FINANCEIRO' | 'SECRETARIA';

export interface User {
  id: string;
  login: string;
  name: string;
  access_level: AccessLevel;
  unit_id: string | null;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export type LeadStatus =
  | 'PRIMEIRA' | 'PROPENSO' | 'INDECISO' | 'RETORNO'
  | 'PACIENTE' | 'POS_OP' | 'FECHOU' | 'PERDIDO';

export interface SurgicalLead {
  id: string;
  unit_id: string;
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  pathology: string;
  procedure?: string;
  eye?: string;
  status: LeadStatus;
  score: number;
  interest?: string;
  barriers: string[];
  has_insurance: boolean;
  insurance_name?: string;
  desired_timeframe?: string;
  lost_reason?: string;
  notes?: string;
  responsavel?: string;
  indication_date?: string;
  last_contact_at?: string;
  next_followup?: string;
  contacts: LeadContact[];
  unit: { name: string };
}

export interface LeadContact {
  id: string;
  date: string;
  contacted_by: string;
  channel: string;
  result?: string;
  notes?: string;
  scheduled_surgery_date?: string;
}

export interface KanbanData {
  columns: Record<LeadStatus, SurgicalLead[]>;
  stats: {
    total: number;
    fechou: number;
    perdido: number;
    em_pipeline: number;
    conversion_rate_pct: number;
  };
}

export interface CashFlowSummary {
  month: string;
  total_receivable: number;
  total_payable: number;
  balance: number;
  receivable_count: number;
  payable_count: number;
  gloss_total: number;
}

export interface StockAlert {
  id: string;
  quantity: number;
  alert_type: 'CRITICO' | 'REPOR' | 'VENCENDO';
  expiry?: string;
  lot?: string;
  item: {
    sku: string;
    name: string;
    category: string;
    min_stock: number;
    reorder_point: number;
  };
}

export const LEAD_STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bgColor: string }> = {
  PRIMEIRA:  { label: 'Primeira',   color: '#6366f1', bgColor: '#eef2ff' },
  PROPENSO:  { label: 'Propenso',   color: '#10b981', bgColor: '#ecfdf5' },
  INDECISO:  { label: 'Indeciso',   color: '#f59e0b', bgColor: '#fffbeb' },
  RETORNO:   { label: 'Retorno',    color: '#3b82f6', bgColor: '#eff6ff' },
  PACIENTE:  { label: 'Paciente',   color: '#8b5cf6', bgColor: '#f5f3ff' },
  POS_OP:    { label: 'Pós-Op',     color: '#06b6d4', bgColor: '#ecfeff' },
  FECHOU:    { label: 'Fechou ✓',   color: '#059669', bgColor: '#d1fae5' },
  PERDIDO:   { label: 'Perdido',    color: '#ef4444', bgColor: '#fef2f2' },
};
