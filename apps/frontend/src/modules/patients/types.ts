// modules/patients/types.ts

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  rg: string | null;
  dob: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  source_channel: string | null;
  prontuario_code: string | null;
  notes: string | null;
  origin_unit_id: string;
  created_at: string;
  updated_at: string;
  unit: { id: string; name: string };
  surgical_leads?: { id: string; status: string; pathology: string; created_at: string }[];
}

export interface PatientListResponse {
  data: Patient[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface PatientFormData {
  name: string;
  cpf: string;
  rg: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  source_channel: string;
  notes: string;
}

export interface UnitOption {
  id: string;
  name: string;
}
