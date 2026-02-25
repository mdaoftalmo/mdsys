'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { fetchProductions, fetchUnits, confirmProduction, cancelProduction } from '@/modules/abasus/api';
import type { Production, UnitOption, ProductionType } from '@/modules/abasus/types';
import { STATUS_LABELS, STATUS_COLORS, TYPE_LABELS, SUBTYPE_LABELS } from '@/modules/abasus/types';

function fmtCurrency(v: number) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR'); }

export default function ProducaoPage() {
  const [data, setData] = useState<Production[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<UnitOption[]>([]);

  const [tab, setTab] = useState<ProductionType | ''>('');
  const [competence, setCompetence] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchUnits().then(u => {
      const sus = u.find(x => x.name.toUpperCase().includes('SUS'));
      if (sus) { setUnitId(sus.id); setUnits([sus]); }
    });
  }, []);

  const load = useCallback(async () => {
    if (!unitId) return;
    setLoading(true); setError('');
    try {
      const res = await fetchProductions({
        unitId, type: tab || undefined, competence: competence || undefined,
        status: statusFilter || undefined, search: search || undefined, page, limit: 50,
      });
      setData(res.data); setMeta(res.meta);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [unitId, tab, competence, statusFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (id: string, action: 'confirm' | 'cancel') => {
    const msgs = { confirm: 'Confirmar produção? Baixará estoque e registrará no financeiro.', cancel: 'Cancelar produção?' };
    if (!confirm(msgs[action])) return;
    try {
      if (action === 'confirm') await confirmProduction(id);
      else await cancelProduction(id);
      await load();
    } catch (e: any) { alert(e.message || 'Erro'); }
  };

  const tabs: { key: ProductionType | ''; label: string }[] = [
    { key: '', label: 'Todos' },
    { key: 'CONSULTA', label: '🩺 Consultas' },
    { key: 'EXAME', label: '🔬 Exames' },
    { key: 'CIRURGIA', label: '🔪 Cirurgias' },
  ];

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none';

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/abasus" className="text-gray-400 hover:text-gray-600">←</Link>
          <h1 className="text-2xl font-bold text-gray-900">Produção SUS</h1>
        </div>
        <Link href="/abasus/producao/novo" className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 text-sm">
          + Novo Lançamento
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setPage(1); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input type="month" value={competence} onChange={e => { setCompetence(e.target.value); setPage(1); }} className={inputCls} />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={inputCls}>
          <option value="">Todos status</option>
          <option value="DRAFT">Rascunho</option>
          <option value="CONFIRMED">Confirmado</option>
          <option value="CANCELED">Cancelado</option>
        </select>
        <input type="text" placeholder="Buscar médico..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} className={`${inputCls} flex-1 min-w-[200px]`} />
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Nenhum lançamento encontrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Médico</th>
                <th className="px-4 py-3 font-medium">Detalhe</th>
                <th className="px-4 py-3 font-medium text-center">Qtd</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-gray-500">{fmtDate(p.date)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                      {TYPE_LABELS[p._type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.doctor_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p._type === 'CONSULTA' && `${p.attendances || 0} atend. + ${p.returns || 0} ret.`}
                    {p._type === 'EXAME' && (p.exam_type || 'Exame')}
                    {p._type === 'CIRURGIA' && (
                      <span>{p.procedure_type} {p.surgery_subtype && <span className="text-purple-600 font-medium">({SUBTYPE_LABELS[p.surgery_subtype] || p.surgery_subtype})</span>}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold">{p._totalPatients || p.quantity || 0}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtCurrency(p._totalValue || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status]}`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link href={`/abasus/producao/novo?edit=${p.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Ver</Link>
                      {p.status === 'DRAFT' && (
                        <>
                          <button onClick={() => handleAction(p.id, 'confirm')} className="text-green-600 hover:text-green-800 text-xs font-medium ml-2">✓</button>
                          <button onClick={() => handleAction(p.id, 'cancel')} className="text-red-500 hover:text-red-700 text-xs ml-1">✕</button>
                        </>
                      )}
                    </div>
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
            className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50">← Anterior</button>
          <span>Página {meta.page} de {meta.pages} ({meta.total} registros)</span>
          <button onClick={() => setPage(p => Math.min(meta.pages, p + 1))} disabled={page >= meta.pages}
            className="px-4 py-2 border rounded-lg disabled:opacity-30 hover:bg-gray-50">Próxima →</button>
        </div>
      )}
    </div>
  );
}
