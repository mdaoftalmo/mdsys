'use client';

import { useState } from 'react';
import type { CreateLeadPayload, Interest, Timeframe, Eye } from '../types';
import { BARRIER_OPTIONS, PATHOLOGY_OPTIONS } from '../constants';

interface Props {
  onSubmit: (data: CreateLeadPayload) => void;
  onClose: () => void;
  loading?: boolean;
}

export function NewLeadModal({ onSubmit, onClose, loading }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pathology, setPathology] = useState('');
  const [customPathology, setCustomPathology] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [showExtra, setShowExtra] = useState(false);

  // Extra fields
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [eye, setEye] = useState<Eye | ''>('');
  const [procedure, setProcedure] = useState('');
  const [interest, setInterest] = useState<Interest | ''>('');
  const [timeframe, setTimeframe] = useState<Timeframe | ''>('');
  const [insurance, setInsurance] = useState(false);
  const [insuranceName, setInsuranceName] = useState('');
  const [barriers, setBarriers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const finalPathology = pathology === '__custom' ? customPathology : pathology;
  const canSubmit = name.trim().length >= 3 && phone.trim().length >= 8 && finalPathology.trim().length >= 2;

  const toggleBarrier = (b: string) => {
    setBarriers((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const payload: CreateLeadPayload = {
      name: name.trim(),
      phone: phone.trim(),
      pathology: finalPathology.trim(),
      responsavel: responsavel.trim() || undefined,
      email: email.trim() || undefined,
      cpf: cpf.trim() || undefined,
      eye: (eye as Eye) || undefined,
      procedure: procedure.trim() || undefined,
      interest: (interest as Interest) || undefined,
      desired_timeframe: (timeframe as Timeframe) || undefined,
      has_insurance: insurance,
      insurance_name: insurance ? insuranceName.trim() : undefined,
      barriers: barriers.length > 0 ? barriers : undefined,
      notes: notes.trim() || undefined,
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 animate-scale-in">
        <h2 className="text-lg font-bold text-slate-800 mb-5">
          Novo Lead Cirúrgico
        </h2>

        <div className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Nome do paciente *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Telefone *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(41) 99999-0000"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Patologia */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Patologia *</label>
            <select
              value={pathology}
              onChange={(e) => setPathology(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="">Selecione...</option>
              {PATHOLOGY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom">Outra...</option>
            </select>
            {pathology === '__custom' && (
              <input
                type="text"
                value={customPathology}
                onChange={(e) => setCustomPathology(e.target.value)}
                placeholder="Nome da patologia"
                className="w-full mt-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            )}
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Responsável</label>
            <input
              type="text"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Nome da funcionária"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Toggle extra fields */}
          <button
            type="button"
            onClick={() => setShowExtra(!showExtra)}
            className="w-full text-left text-xs text-indigo-600 font-medium py-2 hover:text-indigo-800 flex items-center gap-1"
          >
            <span className={`transition-transform ${showExtra ? 'rotate-90' : ''}`}>▶</span>
            {showExtra ? 'Ocultar campos adicionais' : 'Mais campos (convênio, interesse, barreiras...)'}
          </button>

          {showExtra && (
            <div className="space-y-4 pl-3 border-l-2 border-indigo-100">
              {/* Email + CPF */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">CPF</label>
                  <input type="text" value={cpf} onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              {/* Olho + Procedimento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Olho</label>
                  <select value={eye} onChange={(e) => setEye(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">—</option>
                    <option value="OD">OD (Direito)</option>
                    <option value="OE">OE (Esquerdo)</option>
                    <option value="AO">AO (Ambos)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Procedimento</label>
                  <input type="text" value={procedure} onChange={(e) => setProcedure(e.target.value)}
                    placeholder="Facoemulsificação"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>

              {/* Interesse + Prazo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Interesse</label>
                  <select value={interest} onChange={(e) => setInterest(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">—</option>
                    <option value="alto">Alto</option>
                    <option value="medio">Médio</option>
                    <option value="baixo">Baixo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Prazo desejado</label>
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                    <option value="">—</option>
                    <option value="0-30">0-30 dias</option>
                    <option value="30-60">30-60 dias</option>
                    <option value="60+">60+ dias</option>
                  </select>
                </div>
              </div>

              {/* Convênio */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={insurance} onChange={(e) => setInsurance(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400" />
                  <span className="text-xs font-semibold text-slate-600">Tem convênio</span>
                </label>
                {insurance && (
                  <input type="text" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)}
                    placeholder="Nome do convênio (CASSI, Amil...)"
                    className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                )}
              </div>

              {/* Barreiras */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Barreiras</label>
                <div className="flex flex-wrap gap-2">
                  {BARRIER_OPTIONS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBarrier(b)}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                        barriers.includes(b)
                          ? 'bg-red-50 text-red-700 border-red-300 font-medium'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Observações</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  rows={2} placeholder="Detalhes relevantes..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? 'Criando...' : 'Criar e abrir'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
