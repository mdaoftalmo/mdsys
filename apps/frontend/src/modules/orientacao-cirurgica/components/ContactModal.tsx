'use client';

import { useState } from 'react';
import type { ContactChannel, RegisterContactPayload } from '../types';

interface Props {
  leadName: string;
  onSubmit: (data: RegisterContactPayload & { next_followup?: string }) => void;
  onClose: () => void;
  loading?: boolean;
}

const CHANNELS: ContactChannel[] = ['Telefone', 'WhatsApp', 'Presencial', 'Email'];

export function ContactModal({ leadName, onSubmit, onClose, loading }: Props) {
  const [contacted_by, setContactedBy] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('Telefone');
  const [result, setResult] = useState('');
  const [notes, setNotes] = useState('');
  const [surgery_date, setSurgeryDate] = useState('');
  const [next_followup, setNextFollowup] = useState('');

  const canSubmit = contacted_by.trim().length >= 2 && result.trim().length >= 3;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      contacted_by: contacted_by.trim(),
      channel,
      result: result.trim(),
      notes: notes.trim() || undefined,
      scheduled_surgery_date: surgery_date || undefined,
      next_followup: next_followup || undefined,
    });
  };

  // Quick follow-up shortcuts
  const addDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    setNextFollowup(d.toISOString().slice(0, 10));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-scale-in">
        <h2 className="text-lg font-bold text-slate-800 mb-1">
          Registrar Contato
        </h2>
        <p className="text-sm text-slate-500 mb-5">{leadName}</p>

        <div className="space-y-4">
          {/* Quem ligou */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Quem ligou *
            </label>
            <input
              type="text"
              value={contacted_by}
              onChange={(e) => setContactedBy(e.target.value)}
              placeholder="Nome da funcionária"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          {/* Canal */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Canal *
            </label>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                    channel === ch
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Resultado da ligação *
            </label>
            <textarea
              value={result}
              onChange={(e) => setResult(e.target.value)}
              placeholder="Ex: Paciente pediu para ligar na semana que vem"
              rows={3}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Observações <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes adicionais"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Cirurgia agendada */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Cirurgia agendada? <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <input
              type="date"
              value={surgery_date}
              onChange={(e) => setSurgeryDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {/* Próximo follow-up */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Próximo follow-up
            </label>
            <div className="flex gap-2 mb-2">
              {[3, 7, 15, 30].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => addDays(n)}
                  className="px-3 py-1.5 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-700 transition-colors font-medium"
                >
                  +{n}d
                </button>
              ))}
            </div>
            <input
              type="date"
              value={next_followup}
              onChange={(e) => setNextFollowup(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="flex-1 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {loading ? 'Salvando...' : 'Salvar contato'}
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
