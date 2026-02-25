// modules/abasus/api.ts
import { api } from '@/lib/api';
import type {
  Production, ProductionListResponse, Consumption, DashboardSummary,
  RepasseResponse, RepasseRule, StockItem, UnitOption, EmployeeOption,
} from './types';

// ── Production ──

export async function fetchProductions(params: {
  unitId: string; type?: string; competence?: string; doctorId?: string;
  status?: string; search?: string; page?: number; limit?: number;
}): Promise<ProductionListResponse> {
  const qs = new URLSearchParams();
  qs.set('unit_id', params.unitId);
  if (params.type) qs.set('type', params.type);
  if (params.competence) qs.set('competence', params.competence);
  if (params.doctorId) qs.set('doctor_id', params.doctorId);
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 50));
  return api.get<ProductionListResponse>(`/abasus/production?${qs}`);
}

export async function fetchProduction(id: string): Promise<Production> {
  return api.get<Production>(`/abasus/production/${id}`);
}

export async function createProduction(unitId: string, data: any): Promise<Production> {
  return api.post<Production>(`/abasus/production?unit_id=${unitId}`, data);
}

export async function updateProduction(id: string, data: any): Promise<Production> {
  return api.patch<Production>(`/abasus/production/${id}`, data);
}

export async function confirmProduction(id: string): Promise<Production> {
  return api.post<Production>(`/abasus/production/${id}/confirm`, {});
}

export async function cancelProduction(id: string): Promise<any> {
  return api.post(`/abasus/production/${id}/cancel`, {});
}

// ── Consumption ──

export async function addConsumption(productionId: string, data: {
  stock_item_id: string; quantity: number; lot?: string; metadata?: string;
}): Promise<Consumption> {
  return api.post<Consumption>(`/abasus/production/${productionId}/consumption`, data);
}

export async function updateConsumption(id: string, data: any): Promise<Consumption> {
  return api.patch<Consumption>(`/abasus/production/consumption/${id}`, data);
}

export async function removeConsumption(id: string): Promise<void> {
  return api.delete(`/abasus/production/consumption/${id}`);
}

// ── Dashboard ──

export async function fetchSummary(unitId: string, competence: string): Promise<DashboardSummary> {
  return api.get<DashboardSummary>(`/abasus/production/summary/${competence}?unit_id=${unitId}`);
}

export async function fetchConsumptionReport(unitId: string, competence: string): Promise<any> {
  return api.get(`/abasus/production/consumption-report/${competence}?unit_id=${unitId}`);
}

// ── Repasse ──

export async function previewRepasse(unitId: string, competence: string): Promise<RepasseResponse> {
  return api.get<RepasseResponse>(`/abasus/repasse?unit_id=${unitId}&competence=${competence}`);
}

export async function runRepasse(unitId: string, competence: string): Promise<RepasseResponse> {
  return api.post<RepasseResponse>(`/abasus/repasse/run?unit_id=${unitId}`, { competence });
}

export async function fetchRepasseRules(unitId?: string): Promise<RepasseRule[]> {
  const qs = unitId ? `?unit_id=${unitId}&active=true` : '';
  return api.get<RepasseRule[]>(`/abasus/repasse/rules${qs}`);
}

export async function createRepasseRule(data: {
  unit_id: string; procedure_key: string; role: string;
  unit_value: number; valid_from: string; valid_to?: string;
  description?: string;
}): Promise<RepasseRule> {
  return api.post<RepasseRule>('/abasus/repasse/rules', data);
}

export async function updateRepasseRule(id: string, data: any): Promise<RepasseRule> {
  return api.patch<RepasseRule>(`/abasus/repasse/rules/${id}`, data);
}

export async function fetchProcedureKeys(): Promise<string[]> {
  return api.get<string[]>('/abasus/repasse/procedure-keys');
}

export async function fetchSurgeryTypes(): Promise<any[]> {
  return api.get('/abasus/repasse/surgery-types');
}

// ── Shared ──

export async function fetchUnits(): Promise<UnitOption[]> {
  const res = await api.get<{ id: string; name: string }[]>('/units');
  return Array.isArray(res) ? res : [];
}

export async function fetchStockItems(search?: string): Promise<StockItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get<StockItem[]>(`/estoque/items${qs}`);
}

export async function fetchStockLevels(unitId: string): Promise<any[]> {
  return api.get(`/estoque/levels?unit_id=${unitId}`);
}

export async function fetchEmployees(unitId?: string): Promise<EmployeeOption[]> {
  try {
    const res = await api.get<any[]>('/rh/employees');
    return (Array.isArray(res) ? res : []).map((e: any) => ({ id: e.id, name: e.name, role: e.role }));
  } catch { return []; }
}

export async function fetchRepasseHistory(unitId: string): Promise<any[]> {
  return api.get<any[]>(`/abasus/repasse/history?unit_id=${unitId}`);
}
