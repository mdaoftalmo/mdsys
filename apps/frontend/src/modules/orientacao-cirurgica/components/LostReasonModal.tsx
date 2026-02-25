'use client';

import { useState } from 'react';

interface Props {
  leadName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const COMMON_REASONS = [
  'Preço alto',
  'Medo da cirurgia',
  'Mudou de cidade',
  'Optou por outro médico',
  'Não atende ligações',
  'Condição de saúde não permite',
  'Desistiu sem motivo',
];

export function LostReasonModal({ leadName, onConfirm, onClose, loading }: Props) {
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState('');

  const finalReason = reason === '__custom' ? custom.trim() : reason;
  const canSubmit = finalReason.length >= 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          Marcar como Perdido
        </h2>
        <p className="text-sm text-slate-500 mb-5">
          Por que <strong>{leadName}</strong> não vai operar?
        </p>

        <div className="space-y-2 mb-4">
          {COMMON_REASONS.map((r) => (
            <label
              key={r}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                reason === r
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="reason"
                checked={reason === r}
                onChange={() => setReason(r)}
                className="w-4 h-4 text-red-600 focus:ring-red-400"
              />
              <span className="text-sm">{r}</span>
            </label>
          ))}

          {/* Custom reason */}
          <label
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
              reason === '__custom'
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="reason"
              checked={reason === '__custom'}
              onChange={() => setReason('__custom')}
              className="w-4 h-4 text-red-600 focus:ring-red-400"
            />
            <span className="text-sm">Outro motivo...</span>
          </label>
          {reason === '__custom' && (
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Descreva o motivo"
              autoFocus
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
            />
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => canSubmit && onConfirm(finalReason)}
            disabled={!canSubmit || loading}
            className="flex-1 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {loading ? 'Salvando...' : 'Confirmar perda'}
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
