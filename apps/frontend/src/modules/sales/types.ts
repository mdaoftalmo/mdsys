// modules/sales/types.ts

export interface SaleItem {
  id: string;
  service_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
  service?: { id: string; name: string; category: string } | null;
}

export interface Sale {
  id: string;
  unit_id: string;
  patient_id: string | null;
  convenio_id: string | null;
  payment_method: string;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELED' | 'PAID';
  visit_type: string;
  subtotal: number;
  discount: number;
  total: number;
  is_coparticipacao: boolean;
  receivable_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: { id: string; name: string; cpf: string; phone?: string } | null;
  unit?: { id: string; name: string } | null;
  convenio?: { id: string; name: string } | null;
  receivable?: { id: string; status: string; net_value: number; received_at: string | null } | null;
  items?: SaleItem[];
  _count?: { items: number };
}

export interface SaleListResponse {
  data: Sale[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ServiceCatalogItem {
  id: string;
  name: string;
  category: string;
  price_particular: number;
  price_card: number | null;
  tuss_code: string | null;
  is_active: boolean;
}

export interface ConvenioItem {
  id: string;
  name: string;
  slug: string;
  registro_ans: string | null;
  color: string | null;
}

export interface UnitOption {
  id: string;
  name: string;
}

export type PaymentMethodType = 'DINHEIRO' | 'PIX' | 'CARTAO_DEBITO' | 'CARTAO_CREDITO' | 'BOLETO' | 'TRANSFERENCIA' | 'CONVENIO' | 'CARTAO_CORP';

export const PAYMENT_LABELS: Record<string, string> = {
  DINHEIRO: 'Dinheiro',
  PIX: 'PIX',
  CARTAO_DEBITO: 'Cartão Débito',
  CARTAO_CREDITO: 'Cartão Crédito',
  BOLETO: 'Boleto',
  TRANSFERENCIA: 'Transferência',
  CONVENIO: 'Convênio',
  CARTAO_CORP: 'Cartão Corporativo',
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  CONFIRMED: 'Confirmada',
  CANCELED: 'Cancelada',
  PAID: 'Paga',
};

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  CANCELED: 'bg-red-100 text-red-700',
  PAID: 'bg-green-100 text-green-800',
};
