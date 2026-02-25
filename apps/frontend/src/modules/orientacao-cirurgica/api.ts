// ═══════════════════════════════════════════════════════════════
// API Client — typed wrappers for orientacao-cirurgica endpoints
//
// ENDPOINTS USED (all exist in backend):
//   GET    /orientacao-cirurgica/kanban
//   GET    /orientacao-cirurgica/funnel
//   GET    /orientacao-cirurgica
//   GET    /orientacao-cirurgica/:id
//   POST   /orientacao-cirurgica
//   PATCH  /orientacao-cirurgica/:id
//   PATCH  /orientacao-cirurgica/:id/status
//   POST   /orientacao-cirurgica/:id/contacts
//   PATCH  /orientacao-cirurgica/:id/followup
//
// ENDPOINTS NEEDED (não existem ainda):
//   GET    /orientacao-cirurgica/fila-do-dia     ← server-side queue
//   GET    /orientacao-cirurgica/patologias      ← server-side aggregation
//   (para MVP: computamos client-side com /kanban + /funnel)
// ═══════════════════════════════════════════════════════════════

import type {
  KanbanResponse, SurgicalLead, FunnelStat, PaginatedLeads,
  CreateLeadPayload, UpdateLeadPayload, ChangeStatusPayload,
  RegisterContactPayload, LeadFilters, LeadContact,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const PREFIX = `${BASE}/orientacao-cirurgica`;

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('token') : null;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.message || `HTTP ${res.status}`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }

  return res.json();
}

function qs(params: Record<string, any>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ── Kanban ──
export const getKanban = () =>
  request<KanbanResponse>(`${PREFIX}/kanban`);

// ── Funnel stats ──
export const getFunnel = () =>
  request<FunnelStat[]>(`${PREFIX}/funnel`);

// ── List with filters ──
export const getLeads = (filters: LeadFilters = {}) =>
  request<PaginatedLeads>(`${PREFIX}${qs(filters)}`);

// ── Single lead (full detail + contacts) ──
export const getLeadById = (id: string) =>
  request<SurgicalLead>(`${PREFIX}/${id}`);

// ── Create ──
export const createLead = (data: CreateLeadPayload) =>
  request<SurgicalLead>(`${PREFIX}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ── Update ──
export const updateLead = (id: string, data: UpdateLeadPayload) =>
  request<SurgicalLead>(`${PREFIX}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

// ── Change status ──
export const changeStatus = (id: string, data: ChangeStatusPayload) =>
  request<SurgicalLead>(`${PREFIX}/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

// ── Register contact ──
export const registerContact = (leadId: string, data: RegisterContactPayload) =>
  request<LeadContact>(`${PREFIX}/${leadId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

// ── Schedule follow-up ──
export const scheduleFollowup = (leadId: string, date: string) =>
  request<SurgicalLead>(`${PREFIX}/${leadId}/followup`, {
    method: 'PATCH',
    body: JSON.stringify({ date }),
  });

// ── Call queue ──
export const getCallQueue = (date?: string) => {
  const params = date ? `?date=${date}` : '';
  return request<SurgicalLead[]>(`${PREFIX}/call-queue${params}`);
};

// ── Analytics / KPIs ──
export interface AnalyticsSummary {
  summary: {
    total: number; fechou: number; perdido: number; pipeline: number;
    conversion_pct: number; overdue_contacts: number;
    followup_overdue: number; avg_days_to_close: number | null;
  };
  by_status: { status: string; count: number; avg_score: number }[];
  pathology_breakdown: {
    pathology: string; total: number; fechou: number; perdido: number;
    pipeline: number; conversion_pct: number;
  }[];
  lost_reasons: { reason: string; count: number; pct: number }[];
}
export const getAnalytics = () =>
  request<AnalyticsSummary>(`${PREFIX}/analytics`);
