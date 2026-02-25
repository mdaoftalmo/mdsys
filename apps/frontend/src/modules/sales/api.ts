// modules/sales/api.ts
import { api } from '@/lib/api';
import type {
  Sale, SaleListResponse, SaleItem, ServiceCatalogItem,
  ConvenioItem, UnitOption,
} from './types';

export async function fetchSales(params: {
  search?: string; unitId?: string; from?: string; to?: string;
  type?: string; status?: string; page?: number; limit?: number;
}): Promise<SaleListResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.unitId) qs.set('unit_id', params.unitId);
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.type) qs.set('type', params.type);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page || 1));
  qs.set('limit', String(params.limit || 20));
  return api.get<SaleListResponse>(`/sales?${qs.toString()}`);
}

export async function fetchSale(id: string): Promise<Sale> {
  return api.get<Sale>(`/sales/${id}`);
}

export async function createSale(unitId: string, data: {
  patient_id: string; convenio_id?: string;
  payment_method: string; visit_type?: string; notes?: string;
}): Promise<Sale> {
  return api.post<Sale>(`/sales?unit_id=${unitId}`, data);
}

export async function addItem(saleId: string, data: {
  service_id?: string; description: string;
  quantity: number; unit_price: number; discount?: number;
}): Promise<SaleItem> {
  return api.post<SaleItem>(`/sales/${saleId}/items`, data);
}

export async function updateItem(saleId: string, itemId: string, data: {
  quantity?: number; unit_price?: number; discount?: number;
}): Promise<SaleItem> {
  return api.patch<SaleItem>(`/sales/${saleId}/items/${itemId}`, data);
}

export async function removeItem(saleId: string, itemId: string): Promise<void> {
  return api.delete(`/sales/${saleId}/items/${itemId}`);
}

export async function confirmSale(saleId: string): Promise<Sale> {
  return api.post<Sale>(`/sales/${saleId}/confirm`, {});
}

export async function cancelSale(saleId: string): Promise<Sale> {
  return api.post<Sale>(`/sales/${saleId}/cancel`, {});
}

export async function receiveSale(saleId: string, paymentMethod?: string): Promise<any> {
  return api.post(`/sales/${saleId}/receive`, { payment_method: paymentMethod });
}

export async function fetchServices(search?: string): Promise<ServiceCatalogItem[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get<ServiceCatalogItem[]>(`/services${qs}`);
}

export async function fetchConvenios(): Promise<ConvenioItem[]> {
  return api.get<ConvenioItem[]>('/convenios');
}

export async function fetchUnits(): Promise<UnitOption[]> {
  const res = await api.get<{ id: string; name: string }[]>('/units');
  return Array.isArray(res) ? res : [];
}

export async function searchPatients(search: string): Promise<any> {
  return api.get(`/patients?search=${encodeURIComponent(search)}&limit=10`);
}
