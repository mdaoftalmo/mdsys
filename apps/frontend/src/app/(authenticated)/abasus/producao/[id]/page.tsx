'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  fetchProduction, confirmProduction, cancelProduction,
  addConsumption, removeConsumption, fetchStockItems,
} from '@/modules/abasus/api';
import type { Production, Consumption, StockItem } from '@/modules/abasus/types';
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, SUBTYPE_LABELS } from '@/modules/abasus/types';

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function ProductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [prod, setProd] = useState<Production | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  // Stock items for adding consumption
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stkSearch, setStkSearch] = useState('');
  const [showAddInsumo, setShowAddInsumo] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { setProd(await fetchProduction(id)); } catch (e: any) { setError(e.message || 'Erro'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!stkSearch) { fetchStockItems().then(setStockItems).catch(() => {}); return; }
    const t = setTimeout(() => { fetchStockItems(stkSearch).then(setStockItems).catch(() => {}); }, 300);
    return () => clearTimeout(t);
  }, [stkSearch]);

  const handleAction = async (action: 'confirm' | 'cancel') => {
    const msgs = { confirm: 'Confirmar produção? Isso dará baixa no estoque e gerará lançamento contábil.', cancel: 'Cancelar esta produção?' };
    if (!confirm(msgs[action])) return;
    setActionLoading(action); setError(''); setSuccess('');
    try {
      if (action === 'confirm') await confirmProduction(id);
      else await cancelProduction(id);
      setSuccess(`Produção ${action === 'confirm' ? 'confirmada' : 'cancelada'} com sucesso!`);
      await load();
    } catch (e: any) { setError(e.message || `Erro ao ${action}`); }
    finally { setActionLoading(''); }
  };

  const handleAddInsumo = async (item: StockItem) => {
    setError('');
    try {
      await addConsumption(id, { stock_item_id: item.id, quantity: 1 });
      setSuccess(`"${item.name}" adicionado`);
      await load();
    } catch (e: any) { setError(e.message || 'Erro ao adicionar'); }
  };

  const handleRemoveInsumo = async (c: Consumption) => {
    if (!confirm(`Remover "${c.stock_item?.name}"?`)) return;
    try { await removeConsumption(c.id); await load(); } catch (e: any) { setError(e.message); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Carregando…
    </div>
  );

  if (error && !prod) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-700">{error}</p>
      <button onClick={load} className="mt-3 underline text-red-600 text-sm">Tentar novamente</button>
    </div>
  );

  if (!prod) return null;

  const isDraft = prod.status === 'DRAFT';
  const totalValue = prod._totalValue ?? (Number(prod.unit_value) * (prod._type === 'CONSULTA' ? (prod.attendances || 0) + (prod.returns || 0) : (prod.quantity || 0)));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/abasus/producao" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {TYPE_LABELS[prod._type]} #{id.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
              {fmtDate(prod.date)} · {prod.month}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[prod.status]}`}>
                {STATUS_LABELS[prod.status]}
              </span>
              {prod._type === 'CIRURGIA' && prod.surgery_subtype && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                  {SUBTYPE_LABELS[prod.surgery_subtype] || prod.surgery_subtype}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {isDraft && (
            <>
              <button onClick={() => handleAction('confirm')} disabled={!!actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {actionLoading === 'confirm' ? 'Confirmando...' : '✓ Confirmar'}
              </button>
              <button onClick={() => handleAction('cancel')} disabled={!!actionLoading}
                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Médico</h3>
          <div className="font-semibold text-gray-900 text-lg">{prod.doctor_name}</div>
          {prod.unit?.name && <div className="text-xs text-gray-500 mt-1">Unidade: {prod.unit.name}</div>}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Produção</h3>
          <div className="space-y-1 text-sm">
            {prod._type === 'CONSULTA' && (
              <>
                <div><span className="text-gray-500">Atendimentos:</span> <span className="font-semibold">{prod.attendances}</span></div>
                <div><span className="text-gray-500">Retornos:</span> <span className="font-semibold">{prod.returns}</span></div>
                <div><span className="text-gray-500">Valor unit.:</span> <span className="font-medium">{fmtCurrency(prod.unit_value)}</span></div>
              </>
            )}
            {prod._type === 'EXAME' && (
              <>
                <div><span className="text-gray-500">Tipo:</span> <span className="font-semibold">{prod.exam_type}</span></div>
                <div><span className="text-gray-500">Quantidade:</span> <span className="font-semibold">{prod.quantity}</span></div>
              </>
            )}
            {prod._type === 'CIRURGIA' && (
              <>
                <div><span className="text-gray-500">Procedimento:</span> <span className="font-semibold">{prod.procedure_type}</span></div>
                <div><span className="text-gray-500">Quantidade:</span> <span className="font-semibold">{prod.quantity}</span></div>
                {prod.technique && <div><span className="text-gray-500">Técnica:</span> {prod.technique}</div>}
              </>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Valor Total</h3>
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(totalValue)}</div>
        </div>
      </div>

      {/* Consumptions (insumos) */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Insumos Consumidos ({prod.consumptions?.length || 0})</h3>
          {isDraft && (
            <button onClick={() => setShowAddInsumo(!showAddInsumo)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              {showAddInsumo ? '✕ Fechar' : '+ Adicionar Insumo'}
            </button>
          )}
        </div>

        {/* Add insumo picker */}
        {showAddInsumo && isDraft && (
          <div className="p-4 bg-blue-50/50 border-b border-blue-100 space-y-3">
            <input type="text" placeholder="Buscar insumo por nome, SKU ou categoria..."
              value={stkSearch} onChange={(e) => setStkSearch(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:ring-2 focus:ring-blue-200 outline-none" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {stockItems.map(item => (
                <button key={item.id} onClick={() => handleAddInsumo(item)}
                  className="text-left border border-gray-100 rounded-lg p-2 hover:border-blue-300 hover:bg-blue-50/50 transition text-xs bg-white">
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-gray-400">{item.sku} · {item.category}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-50">
              <th className="px-5 py-3 font-medium">Insumo</th>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 font-medium text-center">Qtd</th>
              <th className="px-5 py-3 font-medium">Lote</th>
              {isDraft && <th className="px-5 py-3 font-medium text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!prod.consumptions || prod.consumptions.length === 0) ? (
              <tr><td colSpan={isDraft ? 6 : 5} className="px-5 py-8 text-center text-gray-400">Nenhum insumo registrado</td></tr>
            ) : prod.consumptions.map(c => (
              <tr key={c.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-900">{c.stock_item?.name || '—'}</td>
                <td className="px-5 py-3 text-gray-500 font-mono text-xs">{c.stock_item?.sku || '—'}</td>
                <td className="px-5 py-3 text-gray-500">{c.stock_item?.category || '—'}</td>
                <td className="px-5 py-3 text-center font-semibold">{c.quantity}</td>
                <td className="px-5 py-3 text-gray-400 text-xs">{c.lot || '—'}</td>
                {isDraft && (
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => handleRemoveInsumo(c)} className="text-red-500 hover:text-red-700 text-xs">Remover</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status banners */}
      {prod.status === 'CONFIRMED' && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-semibold">Produção Confirmada</div>
            <div className="text-xs text-green-600">Estoque baixado · Lançamento contábil registrado</div>
          </div>
        </div>
      )}
      {prod.status === 'CANCELED' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-3">
          <span className="text-2xl">❌</span>
          <div className="font-semibold">Produção Cancelada</div>
        </div>
      )}

      <div className="text-xs text-gray-300 font-mono">{prod.id}</div>
    </div>
  );
}
