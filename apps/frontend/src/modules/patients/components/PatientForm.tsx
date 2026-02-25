// modules/patients/components/PatientForm.tsx
'use client';

import { useState } from 'react';
import type { PatientFormData, UnitOption } from '../types';

// ── CPF Mask: 123.456.789-09 ──
function maskCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// ── Phone Mask: (11) 99999-1234 ──
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const EMPTY: PatientFormData = {
  name: '', cpf: '', rg: '', dob: '', phone: '', email: '', address: '', source_channel: '', notes: '',
};

interface Props {
  initial?: Partial<PatientFormData>;
  units: UnitOption[];
  selectedUnitId?: string;
  onSubmit: (data: PatientFormData, unitId: string) => Promise<void>;
  submitLabel: string;
  showUnitSelector?: boolean;
}

export default function PatientForm({
  initial, units, selectedUnitId, onSubmit, submitLabel, showUnitSelector = true,
}: Props) {
  const [form, setForm] = useState<PatientFormData>({ ...EMPTY, ...initial });
  const [unitId, setUnitId] = useState(selectedUnitId || (units[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof PatientFormData, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    if (!form.cpf || form.cpf.replace(/\D/g, '').length !== 11) {
      setError('CPF deve ter 11 dígitos'); return;
    }
    if (!form.dob) { setError('Data de nascimento é obrigatória'); return; }
    if (showUnitSelector && !unitId) { setError('Selecione uma unidade'); return; }

    setLoading(true);
    try {
      await onSubmit(form, unitId);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm ' +
    'focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* ── Unit Selector ── */}
      {showUnitSelector && (
        <div>
          <label className={labelCls}>Unidade de Origem *</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecione...</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Row 1: Name + CPF ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className={labelCls}>Nome Completo *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputCls}
            placeholder="Nome completo do paciente"
          />
        </div>
        <div>
          <label className={labelCls}>CPF *</label>
          <input
            type="text"
            value={form.cpf}
            onChange={(e) => set('cpf', maskCpf(e.target.value))}
            className={inputCls}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        </div>
      </div>

      {/* ── Row 2: DOB + RG + Phone ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Data de Nascimento *</label>
          <input
            type="date"
            value={form.dob}
            onChange={(e) => set('dob', e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>RG</label>
          <input
            type="text"
            value={form.rg}
            onChange={(e) => set('rg', e.target.value)}
            className={inputCls}
            placeholder="Opcional"
          />
        </div>
        <div>
          <label className={labelCls}>Telefone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => set('phone', maskPhone(e.target.value))}
            className={inputCls}
            placeholder="(00) 00000-0000"
            maxLength={15}
          />
        </div>
      </div>

      {/* ── Row 3: Email + Address ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>E-mail</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputCls}
            placeholder="email@exemplo.com"
          />
        </div>
        <div>
          <label className={labelCls}>Endereço</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
            className={inputCls}
            placeholder="Rua, número, bairro, cidade/UF"
          />
        </div>
      </div>

      {/* ── Como Conheceu ── */}
      <div>
        <label className={labelCls}>Como Conheceu a Clínica</label>
        <select
          value={form.source_channel}
          onChange={(e) => set('source_channel', e.target.value)}
          className={inputCls}
        >
          <option value="">Não informado</option>
          <option value="Indicação médico">Indicação — Médico</option>
          <option value="Indicação paciente">Indicação — Paciente</option>
          <option value="Google">Google</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Convenio">Convênio</option>
          <option value="Plano de saúde">Plano de saúde</option>
          <option value="Mutirão SUS">Mutirão SUS</option>
          <option value="Outro">Outro</option>
        </select>
      </div>

      {/* ── Notes ── */}
      <div>
        <label className={labelCls}>Observações</label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          className={inputCls + ' resize-none'}
          rows={3}
          placeholder="Observações clínicas, alergias, etc."
        />
      </div>

      {/* ── Submit ── */}
      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 text-sm font-medium text-white bg-slate-800 rounded-md hover:bg-slate-700 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
