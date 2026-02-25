// app/(authenticated)/pacientes/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchPatients, fetchUnits } from '@/modules/patients/api';
import type { Patient, PatientListResponse, UnitOption } from '@/modules/patients/types';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function age(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
  return a;
}

export default function PacientesPage() {
  const [data, setData] = useState<Patient[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, pages: 0 });
  const [search, setSearch] = useState('');
  const [unitId, setUnitId] = useState<string>('');
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  // Load units once
  useEffect(() => {
    fetchUnits().then(setUnits).catch(() => {});
  }, []);

  // Load patients on filter change
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPatients({
        search: search || undefined,
        unitId: unitId || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
      setMeta(res.meta);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar pacientes');
    } finally {
      setLoading(false);
    }
  }, [search, unitId, page]);

  useEffect(() => { load(); }, [load]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {meta.total} paciente{meta.total !== 1 ? 's' : ''} cadastrado{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/pacientes/novo"
          className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700"
        >
          + Novo Paciente
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou CPF..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>
        <div className="w-full sm:w-56">
          <select
            value={unitId}
            onChange={(e) => { setUnitId(e.target.value); setPage(1); }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <option value="">Todas as unidades (origem)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm mb-4">
          {error}
          <button onClick={load} className="ml-3 underline">Tentar novamente</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700" />
          <span className="ml-3 text-sm text-gray-500">Carregando...</span>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && data.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <div className="text-4xl mb-3">🧑‍⚕️</div>
          <p className="text-lg font-medium">Nenhum paciente encontrado</p>
          <p className="text-sm mt-1">
            {search ? 'Tente alterar os filtros de busca.' : 'Cadastre o primeiro paciente.'}
          </p>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && data.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Paciente</th>
                  <th className="px-4 py-3 font-medium">CPF</th>
                  <th className="px-4 py-3 font-medium">Idade</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">Unidade de Origem</th>
                  <th className="px-4 py-3 font-medium">Cadastro</th>
                  <th className="px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      {p.email && (
                        <div className="text-xs text-gray-400 mt-0.5">{p.email}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-600">{p.cpf}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {age(p.dob)} anos
                      <span className="text-xs text-gray-400 ml-1">({fmtDate(p.dob)})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {p.unit?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/pacientes/${p.id}`}
                        className="text-sm font-medium text-slate-600 hover:text-slate-900"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {meta.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                Página {meta.page} de {meta.pages} · {meta.total} resultado{meta.total !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
                  disabled={page >= meta.pages}
                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40"
                >
                  Próxima →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
