'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchSummary, fetchUnits } from '@/modules/abasus/api';
import type { DashboardSummary, UnitOption } from '@/modules/abasus/types';

function fmtCurrency(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

export default function AbasusDashboard() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [competence, setCompetence] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUnits().then(u => {
      const sus = u.find(x => x.name.toUpperCase().includes('SUS'));
      if (sus) { setUnitId(sus.id); setUnits([sus]); }
      else setUnits(u);
    });
  }, []);

  useEffect(() => {
    if (!unitId || !competence) return;
    setLoading(true); setError('');
    fetchSummary(unitId, competence).then(setSummary).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [unitId, competence]);

  const cardCls = 'bg-white border border-gray-200 rounded-xl p-6';

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏥 ABASUS — Unidade SUS</h1>
          <p className="text-sm text-gray-500 mt-1">Controle operacional de produção SUS</p>
        </div>
        <div className="flex gap-3">
          <input type="month" value={competence} onChange={e => setCompetence(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Link href="/abasus/producao" className={`${cardCls} hover:border-blue-300 transition group`}>
          <div className="text-2xl mb-2">📋</div>
          <div className="font-semibold text-gray-900 group-hover:text-blue-700">Produção</div>
          <div className="text-xs text-gray-500">Consultas, Exames, Cirurgias</div>
        </Link>
        <Link href="/abasus/producao/novo" className={`${cardCls} hover:border-green-300 transition group`}>
          <div className="text-2xl mb-2">➕</div>
          <div className="font-semibold text-gray-900 group-hover:text-green-700">Novo Lançamento</div>
          <div className="text-xs text-gray-500">Registrar produção SUS</div>
        </Link>
        <Link href="/abasus/repasse" className={`${cardCls} hover:border-purple-300 transition group`}>
          <div className="text-2xl mb-2">💰</div>
          <div className="font-semibold text-gray-900 group-hover:text-purple-700">Repasses</div>
          <div className="text-xs text-gray-500">Calcular repasses médicos</div>
        </Link>
        <Link href="/abasus/consumo" className={`${cardCls} hover:border-amber-300 transition group`}>
          <div className="text-2xl mb-2">📦</div>
          <div className="font-semibold text-gray-900 group-hover:text-amber-700">Consumo</div>
          <div className="text-xs text-gray-500">Insumos utilizados</div>
        </Link>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando resumo...</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className={cardCls}>
              <div className="text-xs text-gray-400 uppercase font-medium mb-2">Total Geral</div>
              <div className="text-3xl font-bold text-gray-900">{summary.total.patients}</div>
              <div className="text-sm text-gray-500">pacientes · {summary.total.records} registros</div>
              <div className="text-lg font-semibold text-blue-700 mt-2">{fmtCurrency(summary.total.value)}</div>
            </div>
            <div className={cardCls}>
              <div className="text-xs text-gray-400 uppercase font-medium mb-2">Consultas</div>
              <div className="text-2xl font-bold text-gray-900">{summary.consultas.patients}</div>
              <div className="text-sm text-gray-500">{summary.consultas.count} lançamentos</div>
              <div className="text-sm font-medium text-green-700 mt-1">{fmtCurrency(summary.consultas.value)}</div>
            </div>
            <div className={cardCls}>
              <div className="text-xs text-gray-400 uppercase font-medium mb-2">Exames</div>
              <div className="text-2xl font-bold text-gray-900">{summary.exames.patients}</div>
              <div className="text-sm text-gray-500">{summary.exames.count} lançamentos</div>
              <div className="text-sm font-medium text-green-700 mt-1">{fmtCurrency(summary.exames.value)}</div>
            </div>
            <div className={cardCls}>
              <div className="text-xs text-gray-400 uppercase font-medium mb-2">Cirurgias</div>
              <div className="text-2xl font-bold text-gray-900">{summary.cirurgias.patients}</div>
              <div className="text-sm text-gray-500">{summary.cirurgias.count} lançamentos</div>
              <div className="text-sm font-medium text-green-700 mt-1">{fmtCurrency(summary.cirurgias.value)}</div>
            </div>
          </div>

          {/* Surgery breakdown */}
          {Object.keys(summary.cirurgias.bySubtype || {}).length > 0 && (
            <div className={cardCls}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Cirurgias por Tipo</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(summary.cirurgias.bySubtype).map(([key, val]: [string, any]) => (
                  <div key={key} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{key}</div>
                    <div className="text-lg font-bold">{val.qty || val}</div>
                    {val.value && <div className="text-xs text-green-700">{fmtCurrency(val.value)}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">Selecione uma competência para ver o resumo</div>
      )}
    </div>
  );
}
