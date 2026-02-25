'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { previewRepasse, runRepasse, fetchUnits } from '@/modules/abasus/api';
import type { RepasseResponse, RepasseRun, MissingRule, SemVinculo, UnitOption } from '@/modules/abasus/types';

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getCurrentComp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function RepassePage() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [competence, setCompetence] = useState(getCurrentComp());
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [data, setData] = useState<RepasseResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchUnits().then(u => {
      setUnits(u);
      const sus = u.find(x => x.name.toUpperCase().includes('SUS'));
      if (sus) setUnitId(sus.id);
    });
  }, []);

  const loadPreview = async () => {
    if (!unitId || !competence) return;
    setLoading(true); setError(''); setSuccess('');
    try { setData(await previewRepasse(unitId, competence)); }
    catch (e: any) { setError(e.message || 'Erro'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (unitId && competence) loadPreview(); }, [unitId, competence]);

  const handleRun = async () => {
    if (!confirm(`Confirmar cálculo e geração de Payables para ${competence}?\n\nEsta ação é idempotente: se já existir, retorna o resultado anterior.`)) return;
    setRunning(true); setError(''); setSuccess('');
    try {
      const result = await runRepasse(unitId, competence);
      setData(result);
      if (result.status === 'CREATED') {
        setSuccess(`Repasses gerados: ${result.payablesCreated} payable(s), total ${fmtCurrency(result.totalRepasse)}`);
      } else if (result.status === 'ALREADY_EXISTS') {
        setSuccess(result.message || 'Repasses já existem.');
      } else if (result.status === 'NO_DATA') {
        setError(result.message || 'Nenhuma produção confirmada.');
      }
    } catch (e: any) { setError(e.message || 'Erro ao calcular'); }
    finally { setRunning(false); }
  };

  const toggle = (key: string) => {
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  };

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none';
  const isAlreadyRun = data && (data.status === 'ALREADY_RUN' || data.status === 'ALREADY_EXISTS');

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/abasus" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Repasses Médicos SUS</h1>
            <p className="text-sm text-gray-500">Cálculo consolidado por competência</p>
          </div>
        </div>
        <Link href="/abasus/regras-repasse" className="text-sm text-blue-600 hover:underline font-medium">
          ⚙ Regras de Repasse
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Unidade SUS</label>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls + ' w-56'}>
              {units.filter(u => u.name.toUpperCase().includes('SUS')).map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Competência</label>
            <input type="month" value={competence} onChange={(e) => setCompetence(e.target.value)} className={inputCls + ' w-44'} />
          </div>
          <button onClick={handleRun} disabled={running || !unitId}
            className="bg-purple-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-purple-700 text-sm disabled:opacity-50 transition">
            {running ? 'Calculando…' : '🔄 Calcular e Gerar Payables'}
          </button>
        </div>
        {isAlreadyRun && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Repasses de {competence} já foram calculados. Os valores abaixo são do cálculo existente.
          </div>
        )}
      </div>

      {loading && <div className="text-center py-8 text-gray-400">Carregando…</div>}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
              <div className="text-xs text-gray-400 uppercase font-medium mb-1">Funcionários</div>
              <div className="text-3xl font-bold text-gray-900">{data.runs.length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
              <div className="text-xs text-gray-400 uppercase font-medium mb-1">Payables</div>
              <div className="text-3xl font-bold text-blue-700">{data.runs.filter(r => r.payable_id).length}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
              <div className="text-xs text-gray-400 uppercase font-medium mb-1">Total Repasse</div>
              <div className="text-3xl font-bold text-purple-800">{fmtCurrency(data.totalRepasse)}</div>
            </div>
          </div>

          {/* Runs Table */}
          {data.runs.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Repasses por Funcionário</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {data.runs.map((run, i) => {
                  const key = `${run.employee_id}:${run.role}`;
                  const isOpen = expanded.has(key);
                  return (
                    <div key={key}>
                      <button onClick={() => toggle(key)}
                        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/50 transition text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{isOpen ? '▾' : '▸'}</span>
                          <div>
                            <div className="font-semibold text-gray-900">{run.employee_name}</div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${run.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                {run.role === 'DOCTOR' ? 'Médico' : 'Secretária'}
                              </span>
                              {run.payable_id && (
                                <Link href="/financeiro" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                                  Payable #{(run.payable_id || '').slice(0, 8)}
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-xl font-bold text-purple-800">{fmtCurrency(run.total_value)}</div>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 pl-14">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-400 text-xs uppercase border-b border-gray-100">
                                <th className="pb-2 font-medium">Procedimento</th>
                                <th className="pb-2 font-medium text-center">Qtd</th>
                                <th className="pb-2 font-medium text-right">Valor Unit.</th>
                                <th className="pb-2 font-medium text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {Object.entries(run.breakdown).map(([procKey, item]) => (
                                <tr key={procKey}>
                                  <td className="py-2 font-medium text-gray-700">{procKey}</td>
                                  <td className="py-2 text-center">{item.qty}</td>
                                  <td className="py-2 text-right text-gray-500">{fmtCurrency(item.unit_value)}</td>
                                  <td className="py-2 text-right font-semibold">{fmtCurrency(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Missing Rules */}
          {data.missingRules.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-3">⚠ Sem Regra Configurada</h3>
              <p className="text-xs text-amber-600 mb-3">
                Estes procedimentos não entraram no cálculo por falta de regra. 
                <Link href="/abasus/regras-repasse" className="underline ml-1">Criar regras →</Link>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {data.missingRules.map((m, i) => (
                  <div key={i} className="bg-white/60 border border-amber-100 rounded-lg p-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium text-amber-900">{m.procedure_key}</span>
                      <span className="text-amber-500 ml-2 text-xs">{m.role}</span>
                    </div>
                    <span className="text-amber-700 font-semibold">{m.qty} proc.</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sem Vínculo */}
          {data.semVinculo.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-red-800 mb-3">❌ Sem Vínculo (doctor_id null)</h3>
              <p className="text-xs text-red-500 mb-3">
                Estes registros não têm doctor_id associado. Edite a produção para vincular ao Employee.
              </p>
              <div className="space-y-1">
                {data.semVinculo.map((sv, i) => (
                  <div key={i} className="text-sm flex items-center gap-3">
                    <span className="px-2 py-0.5 bg-red-100 rounded text-xs font-medium text-red-700">{sv.type}</span>
                    <span className="text-gray-700">{sv.doctor_name}</span>
                    <span className="text-gray-400 text-xs">({sv.qty} proc.)</span>
                    <Link href={`/abasus/producao/${sv.id}`} className="text-blue-600 text-xs hover:underline">Editar →</Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {data.runs.length === 0 && data.missingRules.length === 0 && data.semVinculo.length === 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
              Nenhuma produção confirmada encontrada para {competence}.
            </div>
          )}
        </>
      )}
    </div>
  );
}
