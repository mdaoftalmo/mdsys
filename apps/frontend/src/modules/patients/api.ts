// modules/patients/api.ts
import { api } from '@/lib/api';
import type { Patient, PatientListResponse, PatientFormData, UnitOption } from './types';

export async function fetchPatients(params: {
  search?: string;
  unitId?: string;
  page?: number;
  limit?: number;
}): Promise<PatientListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.unitId) qs.set('unit_id', params.unitId);
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 20));
  return api.get<PatientListResponse>(`/patients?${qs.toString()}`);
}

export async function fetchPatient(id: string): Promise<Patient> {
  return api.get<Patient>(`/patients/${id}`);
}

export async function createPatient(unitId: string, data: PatientFormData): Promise<Patient> {
  return api.post<Patient>(`/patients?unit_id=${unitId}`, data);
}

export async function updatePatient(id: string, data: Partial<PatientFormData>): Promise<Patient> {
  return api.patch<Patient>(`/patients/${id}`, data);
}

export async function fetchUnits(): Promise<UnitOption[]> {
  const res = await api.get<{ id: string; name: string }[]>('/units');
  return Array.isArray(res) ? res : [];
}
