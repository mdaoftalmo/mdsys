'use client';

import { useState, useRef, useEffect } from 'react';
import type { CreateLeadDto } from '@/types/orientacao';

interface NewLeadModalProps {
  onSave: (dto: CreateLeadDto) => Promise<void>;
  onClose: () => void;
}

const COMMON_PATHOLOGIES = [
  'Catarata – Lente Clareon',
  'Catarata – Lente Panoptix',
  'Catarata – Lente MA60',
  'Membrana Epirretiniana',
  'Descolamento de retina',
  'Glaucoma avançado',
  'Vitrectomia',
  'Injeção Intravítrea',
];

export default function NewLeadModal({ onSave, onClose }: NewLeadModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pathology, setPathology] = useState('');
  const [customPathology, setCustomPathology] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [hasInsurance, setHasInsurance] = useState(false);
  const [insuranceName, setInsuranceName] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const finalPathology = pathology === '__custom' ? customPathology : pathology;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !phone || !finalPathology) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        pathology: finalPathology.trim(),
        responsavel: responsavel.trim() || undefined,
        has_insurance: hasInsurance,
        insurance_name: hasInsurance ? insuranceName : undefined,
      });
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4"
      >
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Novo Lead Cirúrgico</h3>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Name */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Nome do paciente *</label>
            <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="João Silva" required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none" />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Telefone *</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(41) 99999-8888" required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none" />
          </div>

          {/* Pathology */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Patologia *</label>
            <select value={pathology} onChange={(e) => setPathology(e.target.value)} required
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 outline-none bg-white">
              <option value="">Selecione...</option>
              {COMMON_PATHOLOGIES.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="__custom">Outra (digitar)</option>
            </select>
            {pathology === '__custom' && (
              <input type="text" value={customPathology} onChange={(e) => setCustomPathology(e.target.value)}
                placeholder="Descreva a patologia..." required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 mt-2 focus:ring-2 focus:ring-brand-500/30 outline-none" />
            )}
          </div>

          {/* Responsavel */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Responsável</label>
            <input type="text" value={responsavel} onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Maria Santos"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 outline-none" />
          </div>

          {/* Insurance toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={hasInsurance} onChange={(e) => setHasInsurance(e.target.checked)}
                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              <span className="text-sm text-gray-700">Tem convênio</span>
            </label>
            {hasInsurance && (
              <input type="text" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)}
                placeholder="Nome do convênio"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-brand-500/30 outline-none" />
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">Cancelar</button>
          <button type="submit" disabled={!name || !phone || !finalPathology || saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? 'Criando...' : 'Criar lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
