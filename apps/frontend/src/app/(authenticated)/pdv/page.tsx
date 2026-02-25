'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchSales, fetchUnits } from '@/modules/sales/api';
import type { Sale, SaleListResponse, UnitOption } from '@/modules/sales/types';
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_LABELS } from '@/modules/sales/types';

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function PdvListPage() {
  const [data, setData] = useState<Sale[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [units, setUnits] = useState<UnitOption[]>([]);

  // Filters
  const [search, setSearch] = useState('');
  const [unitId, setUnitId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { fetchUnits().then(setUnits).catch(() => {}); }, []);

  const loadSales = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchSales({
        search: search || undefined, unitId: unitId || undefined,
        type: type || undefined, status: status || undefined, page, limit: 20,
      });
      setData(res.data || []);
      setMeta(res.meta || { total: 0, page: 1, limit: 20, pages: 0 });
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar vendas');
    } finally {
      setLoading(false);
    }
  }, [search, unitId, type, status, page]);

  useEffect(() => { const t = setTimeout(loadSales, 300); return () => clearTimeout(t); }, [loadSales]);

  const selectCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-white';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">PDV — Vendas</h1>
          <p className="text-sm text-gray-500 mt-1">Ponto de Venda · Particular e Convênio</p>
        </div>
        <Link href="/pdv/nova" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition text-sm">
          + Nova Venda
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input
            type="text" placeholder="Buscar paciente ou CPF..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={selectCls}
          />
          <select value={unitId} onChange={(e) => { setUnitId(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Todas as unidades</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Todos os tipos</option>
            <option value="PARTICULAR">Particular</option>
            <option value="CONVENIO">Convênio</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Todos os status</option>
            <option value="DRAFT">Rascunho</option>
            <option value="CONFIRMED">Confirmada</option>
            <option value="PAID">Paga</option>
            <option value="CANCELED">Cancelada</option>
          </select>
          <div className="text-sm text-gray-400 flex items-center justify-end">
            {meta.total} venda{meta.total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={loadSales} className="underline font-medium">Tentar novamente</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            Carregando vendas…
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">🧾</div>
            <p className="text-lg font-medium">Nenhuma venda encontrada</p>
            <p className="text-sm mt-1">Ajuste os filtros ou crie uma nova venda</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Paciente</th>
                <th className="px-4 py-3 font-medium">Unidade</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium text-center">Itens</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(s.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{s.patient?.name || '—'}</div>
                    <div className="text-xs text-gray-400 font-mono">{s.patient?.cpf || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                      {s.unit?.name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.convenio_id ? (
                      <span className="text-purple-700 font-medium">{s.convenio?.name || 'Convênio'}</span>
                    ) : (
                      <span className="text-gray-700">Particular</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                    {fmtCurrency(s.total)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{PAYMENT_LABELS[s.payment_method] || s.payment_method}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{s._count?.items ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/pdv/${s.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.pages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50">
            ← Anterior
          </button>
          <span>Página {meta.page} de {meta.pages}</span>
          <button onClick={() => setPage(p => Math.min(meta.pages, p + 1))} disabled={page >= meta.pages}
            className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
