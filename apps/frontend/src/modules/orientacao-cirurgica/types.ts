// ═══════════════════════════════════════════════════════════════
// ORIENTAÇÃO CIRÚRGICA — TypeScript Types
// Mirrors: schema.prisma (SurgicalLead, LeadContact)
//          dto/index.ts (CreateLeadDto, RegisterContactDto, etc.)
// ═══════════════════════════════════════════════════════════════

export type LeadStatus =
  | 'PRIMEIRA' | 'PROPENSO' | 'INDECISO' | 'RETORNO'
  | 'PACIENTE' | 'POS_OP' | 'FECHOU' | 'PERDIDO';

export type ContactChannel = 'Telefone' | 'WhatsApp' | 'Presencial' | 'Email';
export type Interest = 'alto' | 'medio' | 'baixo';
export type Timeframe = '0-30' | '30-60' | '31-90' | '60+' | '90+';
export type Eye = 'OD' | 'OE' | 'AO';

// ── Models (from API response) ──

export interface LeadContact {
  id: string;
  lead_id: string;
  date: string;
  contacted_by: string;
  channel: ContactChannel;
  result: string | null;
  notes: string | null;
  scheduled_surgery_date: string | null;
  created_at: string;
}

export interface SurgicalLead {
  id: string;
  unit_id: string;
  patient_id: string | null;
  name: string;
  phone: string;
  email: string | null;
  cpf: string | null;
  pathology: string;
  procedure: string | null;
  eye: string | null;
  status: LeadStatus;
  score: number;
  score_factors_json?: {
    interest: number;
    insurance: number;
    timeframe: number;
    had_return: number;
    contact_recency: number;
    barriers_price: number;
    barriers_fear: number;
    barriers_other: number;
    total: number;
  } | null;
  interest: Interest | null;
  barriers: string[];
  has_insurance: boolean;
  insurance_name: string | null;
  had_return: boolean;
  desired_timeframe: Timeframe | null;
  lost_reason: string | null;
  notes: string | null;
  responsavel: string | null;
  indication_date: string | null;
  last_contact_at: string | null;
  next_followup: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Includes
  contacts?: LeadContact[];
  unit?: { name: string };
  patient?: { id: string; name: string; cpf: string } | null;
}

// ── API Responses ──

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

export interface FunnelStat {
  status: LeadStatus;
  pathology: string;
  count: number;
  avg_score: number;
}

export interface PaginatedLeads {
  data: SurgicalLead[];
  total: number;
  page: number;
  limit: number;
}

// ── DTOs (request bodies) ──

export interface CreateLeadPayload {
  name: string;
  phone: string;
  email?: string;
  cpf?: string;
  pathology: string;
  procedure?: string;
  eye?: Eye;
  status?: LeadStatus;
  barriers?: string[];
  has_insurance?: boolean;
  insurance_name?: string;
  interest?: Interest;
  desired_timeframe?: Timeframe;
  notes?: string;
  responsavel?: string;
  indication_date?: string;
  next_followup?: string;
}

export interface UpdateLeadPayload extends Partial<CreateLeadPayload> {
  lost_reason?: string;
  had_return?: boolean;
}

export interface ChangeStatusPayload {
  status: LeadStatus;
  lost_reason?: string;
}

export interface RegisterContactPayload {
  contacted_by: string;
  channel: ContactChannel;
  result?: string;
  notes?: string;
  scheduled_surgery_date?: string;
}

export interface LeadFilters {
  status?: LeadStatus;
  pathology?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── UI-specific types ──

export type UrgencyLevel = 'ok' | 'warning' | 'danger' | 'critical';

export interface QueueItem {
  lead: SurgicalLead;
  section: 'overdue' | 'today' | 'high_score' | 'done';
  days_since_contact: number;
  urgency: UrgencyLevel;
}

export interface PathologyAnalysis {
  pathology: string;
  total: number;
  by_status: Record<LeadStatus, number>;
  fechou: number;
  conversion_pct: number;
  avg_score: number;
  avg_days_in_funnel: number;
  overdue_count: number;
  alerts: PathologyAlert[];
}

export interface PathologyAlert {
  type: 'overdue' | 'stuck' | 'low_conversion' | 'low_score' | 'empty_funnel';
  severity: 'warning' | 'danger';
  message: string;
}
