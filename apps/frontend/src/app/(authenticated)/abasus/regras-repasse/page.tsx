'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchRepasseRules, createRepasseRule, updateRepasseRule,
  fetchProcedureKeys, fetchUnits,
} from '@/modules/abasus/api';
import type { RepasseRule, UnitOption } from '@/modules/abasus/types';

function fmtCurrency(v: number | string) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ROLES = [
  { value: 'DOCTOR', label: 'Médico' },
  { value: 'SECRETARY', label: 'Secretária' },
];

export default function RegrasRepassePage() {
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState('');
  const [rules, setRules] = useState<RepasseRule[]>([]);
  const [procedureKeys, setProcedureKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    procedure_key: 'CONSULTA', role: 'DOCTOR', unit_value: '',
    valid_from: new Date().toISOString().split('T')[0], valid_to: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchUnits(), fetchProcedureKeys()]).then(([u, pk]) => {
      setUnits(u);
      setProcedureKeys(pk);
      const sus = u.find(x => x.name.toUpperCase().includes('SUS'));
      if (sus) setUnitId(sus.id);
    });
  }, []);

  const loadRules = async () => {
    if (!unitId) return;
    setLoading(true); setError('');
    try { setRules(await fetchRepasseRules(unitId)); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (unitId) loadRules(); }, [unitId]);

  const resetForm = () => {
    setForm({ procedure_key: 'CONSULTA', role: 'DOCTOR', unit_value: '', valid_from: new Date().toISOString().split('T')[0], valid_to: '', description: '' });
    setEditingId(null); setShowForm(false);
  };

  const startEdit = (rule: RepasseRule) => {
    setForm({
      procedure_key: rule.procedure_key, role: rule.role,
      unit_value: String(Number(rule.unit_value)),
      valid_from: rule.valid_from.split('T')[0],
      valid_to: rule.valid_to ? rule.valid_to.split('T')[0] : '',
      description: rule.description || '',
    });
    setEditingId(rule.id); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.unit_value || Number(form.unit_value) <= 0) { setError('Valor unitário obrigatório'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      if (editingId) {
        await updateRepasseRule(editingId, {
          unit_value: Number(form.unit_value),
          valid_from: form.valid_from,
          valid_to: form.valid_to || null,
          description: form.description || null,
        });
        setSuccess('Regra atualizada');
      } else {
        await createRepasseRule({
          unit_id: unitId,
          procedure_key: form.procedure_key,
          role: form.role,
          unit_value: Number(form.unit_value),
          valid_from: form.valid_from,
          valid_to: form.valid_to || undefined,
          description: form.description || undefined,
        });
        setSuccess('Regra criada');
      }
      resetForm();
      await loadRules();
    } catch (e: any) { setError(e.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const toggleActive = async (rule: RepasseRule) => {
    try {
      await updateRepasseRule(rule.id, { is_active: !rule.is_active });
      await loadRules();
    } catch (e: any) { setError(e.message); }
  };

  const inputCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none';

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/abasus/repasse" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Regras de Repasse SUS</h1>
            <p className="text-sm text-gray-500">Valor por procedimento × role × vigência</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Nova Regra
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">{success}</div>}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-blue-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">{editingId ? 'Editar Regra' : 'Nova Regra'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Procedimento</label>
              <select value={form.procedure_key} onChange={(e) => setForm({ ...form, procedure_key: e.target.value })}
                className={inputCls + ' w-full'} disabled={!!editingId}>
                {procedureKeys.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className={inputCls + ' w-full'} disabled={!!editingId}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Valor por Unidade (R$)</label>
              <input type="number" step="0.01" min="0" value={form.unit_value}
                onChange={(e) => setForm({ ...form, unit_value: e.target.value })}
                className={inputCls + ' w-full'} placeholder="15.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vigência Início</label>
              <input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                className={inputCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Vigência Fim (opcional)</label>
              <input type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })}
                className={inputCls + ' w-full'} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Descrição</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputCls + ' w-full'} placeholder="Opcional" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
              {saving ? 'Salvando…' : editingId ? 'Atualizar' : 'Criar Regra'}
            </button>
            <button onClick={resetForm} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Rules Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando…</div>
      ) : rules.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
          Nenhuma regra cadastrada. Clique em "+ Nova Regra" para começar.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Procedimento</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium text-right">Valor Unit.</th>
                <th className="px-5 py-3 font-medium">Vigência</th>
                <th className="px-5 py-3 font-medium text-center">Status</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rules.map(rule => (
                <tr key={rule.id} className={`hover:bg-gray-50/50 ${!rule.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-gray-900 font-mono text-xs">{rule.procedure_key}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rule.role === 'DOCTOR' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                      {rule.role === 'DOCTOR' ? 'Médico' : 'Secretária'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-gray-900">{fmtCurrency(rule.unit_value)}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {fmtDate(rule.valid_from)} → {rule.valid_to ? fmtDate(rule.valid_to) : 'Indefinido'}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <button onClick={() => toggleActive(rule)} className="text-xs hover:underline"
                      title={rule.is_active ? 'Desativar' : 'Ativar'}>
                      {rule.is_active
                        ? <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Ativa</span>
                        : <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inativa</span>}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => startEdit(rule)} className="text-blue-600 hover:underline text-xs">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <div><strong>procedure_key</strong>: CONSULTA, EXAME, EXAME:OCT, CIRURGIA:CATARATA, etc.</div>
        <div><strong>role</strong>: DOCTOR (obrigatório) ou SECRETARY (opcional, só consultas).</div>
        <div><strong>Valor</strong>: multiplicado pela quantidade de procedimentos confirmados no mês.</div>
        <div><strong>Vigência</strong>: a regra com valid_from mais recente dentro do mês é usada.</div>
      </div>
    </div>
  );
}
