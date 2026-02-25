'use client';

import { useState, useRef, useEffect } from 'react';

interface LostReasonModalProps {
  leadName: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}

const COMMON_REASONS = [
  'Preço alto',
  'Optou por outro médico/clínica',
  'Medo do procedimento',
  'Não atende mais',
  'Mudou de cidade',
  'Problema de saúde (não pode operar)',
];

export default function LostReasonModal({ leadName, onConfirm, onClose }: LostReasonModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try { await onConfirm(reason.trim()); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4"
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-gray-800">Marcar como Perdido</h3>
          <p className="text-sm text-gray-500 mt-0.5">{leadName}</p>
        </div>

        <div className="px-5 pb-4">
          <label className="text-xs text-gray-500 font-medium block mb-2">
            Por que este paciente não vai operar?
          </label>

          {/* Quick reasons */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {COMMON_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                  reason === r
                    ? 'bg-red-100 border-red-300 text-red-700 font-medium'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Custom reason */}
          <input
            ref={inputRef}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ou descreva o motivo..."
            required
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-400/30 focus:border-red-300 outline-none"
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50 rounded-b-2xl">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 font-medium">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!reason.trim() || saving}
            className="px-5 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Salvando...' : 'Confirmar perda'}
          </button>
        </div>
      </form>
    </div>
  );
}
