'use client';
import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchSale, confirmSale, cancelSale, receiveSale } from '@/modules/sales/api';
import type { Sale } from '@/modules/sales/types';
import { STATUS_LABELS, STATUS_COLORS, PAYMENT_LABELS } from '@/modules/sales/types';

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const s = await fetchSale(id);
      setSale(s);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar venda');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAction = async (action: 'confirm' | 'cancel' | 'receive') => {
    const labels = { confirm: 'Confirmar venda? Isso criará o recebível financeiro.', cancel: 'Cancelar esta venda? Essa ação não pode ser desfeita.', receive: 'Registrar recebimento? Isso criará o lançamento de caixa.' };
    if (!confirm(labels[action])) return;

    setActionLoading(action); setError(''); setSuccess('');
    try {
      if (action === 'confirm') await confirmSale(id);
      else if (action === 'cancel') await cancelSale(id);
      else if (action === 'receive') await receiveSale(id, sale?.payment_method);
      setSuccess(`Ação "${action}" realizada com sucesso!`);
      await load();
    } catch (e: any) {
      setError(e.message || `Erro ao ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-gray-400">
      <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
      Carregando…
    </div>
  );

  if (error && !sale) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-700">{error}</p>
      <button onClick={load} className="mt-3 underline text-red-600 text-sm">Tentar novamente</button>
    </div>
  );

  if (!sale) return null;

  const isDraft = sale.status === 'DRAFT';
  const isConfirmed = sale.status === 'CONFIRMED';
  const isPaid = sale.status === 'PAID';
  const isCanceled = sale.status === 'CANCELED';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/pdv" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Venda #{id.slice(0, 8)}
            </h1>
            <p className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
              {fmtDate(sale.created_at)}
              <span className="text-gray-300">·</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sale.status]}`}>
                {STATUS_LABELS[sale.status]}
              </span>
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isDraft && (
            <>
              <button onClick={() => handleAction('confirm')} disabled={!!actionLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                {actionLoading === 'confirm' ? 'Confirmando...' : '✓ Confirmar'}
              </button>
              <button onClick={() => handleAction('cancel')} disabled={!!actionLoading}
                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
                Cancelar
              </button>
            </>
          )}
          {isConfirmed && (
            <>
              <button onClick={() => handleAction('receive')} disabled={!!actionLoading}
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {actionLoading === 'receive' ? 'Recebendo...' : '💰 Receber Pagamento'}
              </button>
              <button onClick={() => handleAction('cancel')} disabled={!!actionLoading}
                className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50">
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Patient */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Paciente</h3>
          <div className="font-semibold text-gray-900 text-lg">{sale.patient?.name || '—'}</div>
          <div className="text-xs text-gray-500 font-mono mt-1">{sale.patient?.cpf || ''}</div>
          {sale.patient?.phone && <div className="text-xs text-gray-500 mt-0.5">{sale.patient.phone}</div>}
        </div>

        {/* Unit + Type */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Detalhes</h3>
          <div className="space-y-1 text-sm">
            <div><span className="text-gray-500">Unidade:</span> <span className="font-medium">{sale.unit?.name || '—'}</span></div>
            <div><span className="text-gray-500">Tipo:</span>{' '}
              {sale.convenio_id
                ? <span className="font-medium text-purple-700">{sale.convenio?.name || 'Convênio'}</span>
                : <span className="font-medium">Particular</span>}
            </div>
            <div><span className="text-gray-500">Pagamento:</span> <span className="font-medium">{PAYMENT_LABELS[sale.payment_method] || sale.payment_method}</span></div>
            <div><span className="text-gray-500">Visita:</span> <span className="font-medium">{sale.visit_type}</span></div>
          </div>
        </div>

        {/* Financial */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Financeiro</h3>
          <div className="text-3xl font-bold text-gray-900">{fmtCurrency(sale.total)}</div>
          {Number(sale.discount) > 0 && (
            <div className="text-xs text-red-600 mt-1">Desconto: -{fmtCurrency(sale.discount)}</div>
          )}
          {sale.receivable && (
            <div className="mt-3 bg-gray-50 rounded-lg p-2 text-xs">
              <span className="text-gray-500">Recebível:</span>{' '}
              <span className={`font-medium ${sale.receivable.status === 'RECEBIDO' ? 'text-green-700' : sale.receivable.status === 'PREVISTO' ? 'text-blue-700' : 'text-gray-700'}`}>
                {sale.receivable.status}
              </span>
              {sale.receivable.received_at && (
                <span className="text-gray-400 ml-2">· {fmtDate(sale.receivable.received_at)}</span>
              )}
            </div>
          )}
          {!sale.receivable && sale.status !== 'DRAFT' && sale.status !== 'CANCELED' && (
            <div className="mt-3 text-xs text-orange-600 italic">Sem recebível vinculado</div>
          )}
        </div>
      </div>

      {/* Notes */}
      {sale.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <span className="font-medium">Obs:</span> {sale.notes}
        </div>
      )}

      {/* Items table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Itens da Venda ({sale.items?.length || 0})</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-50">
              <th className="px-5 py-3 font-medium">Serviço / Descrição</th>
              <th className="px-5 py-3 font-medium">Categoria</th>
              <th className="px-5 py-3 font-medium text-center">Qtd</th>
              <th className="px-5 py-3 font-medium text-right">Preço Unit.</th>
              <th className="px-5 py-3 font-medium text-right">Desconto</th>
              <th className="px-5 py-3 font-medium text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {(!sale.items || sale.items.length === 0) ? (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Nenhum item</td></tr>
            ) : sale.items.map(item => (
              <tr key={item.id} className="hover:bg-gray-50/50">
                <td className="px-5 py-3 font-medium text-gray-900">{item.description}</td>
                <td className="px-5 py-3 text-gray-500">{item.service?.category || '—'}</td>
                <td className="px-5 py-3 text-center">{item.quantity}</td>
                <td className="px-5 py-3 text-right">{fmtCurrency(item.unit_price)}</td>
                <td className="px-5 py-3 text-right text-red-600">{Number(item.discount) > 0 ? `-${fmtCurrency(item.discount)}` : '—'}</td>
                <td className="px-5 py-3 text-right font-semibold">{fmtCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4">
          <div className="flex justify-end gap-10 text-sm">
            <div className="text-gray-500">Subtotal: <span className="font-medium text-gray-800">{fmtCurrency(sale.subtotal)}</span></div>
            {Number(sale.discount) > 0 && <div className="text-red-600">Desconto: -{fmtCurrency(sale.discount)}</div>}
            <div className="text-lg font-bold text-gray-900">Total: {fmtCurrency(sale.total)}</div>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      {isPaid && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <div className="font-semibold">Venda Paga</div>
            <div className="text-xs text-green-600">Recebível quitado · Lançamento de caixa registrado</div>
          </div>
        </div>
      )}
      {isCanceled && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-3">
          <span className="text-2xl">❌</span>
          <div>
            <div className="font-semibold">Venda Cancelada</div>
          </div>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-gray-300 flex gap-6">
        <span>Criada: {fmtDate(sale.created_at)}</span>
        <span>Atualizada: {fmtDate(sale.updated_at)}</span>
        <span className="font-mono">{sale.id}</span>
      </div>
    </div>
  );
}
