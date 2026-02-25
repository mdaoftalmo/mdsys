// modules/abasus/types.ts

export type ProductionType = 'CONSULTA' | 'EXAME' | 'CIRURGIA';
export type ProductionStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELED';
export type SurgerySubtype = 'CATARATA' | 'RETINA' | 'PTERIGIO' | 'ANTI_VEGF';

export interface Production {
  id: string;
  unit_id: string;
  date: string;
  month: string;
  doctor_name: string;
  doctor_id: string | null;
  secretary_id: string | null;
  status: ProductionStatus;
  unit_value: number;
  _type: ProductionType;
  _totalPatients?: number;
  _totalValue?: number;
  attendances?: number;
  returns?: number;
  exam_type?: string;
  quantity?: number;
  procedure_type?: string;
  surgery_subtype?: SurgerySubtype | null;
  technique?: string;
  equipment?: string;
  unit?: { id: string; name: string };
  consumptions?: Consumption[];
}

export interface Consumption {
  id: string;
  production_type: string;
  production_id: string;
  stock_item_id: string;
  quantity: number;
  lot: string | null;
  metadata: string | null;
  stock_item?: { id: string; sku: string; name: string; category: string };
}

export interface ProductionListResponse {
  data: Production[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface DashboardSummary {
  competence: string;
  consultas: { count: number; patients: number; value: number };
  exames: { count: number; patients: number; value: number };
  cirurgias: { count: number; patients: number; value: number; bySubtype: Record<string, { qty: number; value: number }> };
  total: { records: number; patients: number; value: number };
}

// ── Repasse ──

export interface BreakdownItem { qty: number; unit_value: number; total: number; }

export interface RepasseRun {
  id?: string;
  employee_id: string;
  employee_name: string;
  role: 'DOCTOR' | 'SECRETARY';
  total_value: number;
  breakdown: Record<string, BreakdownItem>;
  payable_id: string | null;
  payable: { id: string; status: string; value: number } | null;
}

export interface MissingRule { procedure_key: string; role: string; qty: number; }
export interface SemVinculo { type: string; id: string; doctor_name: string; qty: number; }

export interface RepasseResponse {
  competence: string;
  status: 'PREVIEW' | 'ALREADY_RUN' | 'ALREADY_EXISTS' | 'CREATED' | 'NO_DATA';
  message?: string;
  runs: RepasseRun[];
  missingRules: MissingRule[];
  semVinculo: SemVinculo[];
  totalRepasse: number;
  payablesCreated?: number;
}

export interface RepasseRule {
  id: string;
  unit_id: string;
  procedure_key: string;
  role: string;
  unit_value: number;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  description: string | null;
  unit?: { id: string; name: string };
}

// ── Shared ──

export interface StockItem { id: string; sku: string; name: string; category: string; cost: number; unit_measure: string; }
export interface UnitOption { id: string; name: string; }
export interface EmployeeOption { id: string; name: string; role: string; }

export const STATUS_LABELS: Record<string, string> = { DRAFT: 'Rascunho', CONFIRMED: 'Confirmado', CANCELED: 'Cancelado' };
export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-green-100 text-green-800',
  CANCELED: 'bg-red-100 text-red-700',
};
export const TYPE_LABELS: Record<string, string> = { CONSULTA: 'Consulta', EXAME: 'Exame', CIRURGIA: 'Cirurgia' };
export const SUBTYPE_LABELS: Record<string, string> = {
  CATARATA: 'Catarata', RETINA: 'Retina', PTERIGIO: 'Pterígio', ANTI_VEGF: 'Anti-VEGF',
};
