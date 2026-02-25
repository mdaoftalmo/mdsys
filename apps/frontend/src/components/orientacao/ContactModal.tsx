'use client';

import { useState, useRef, useEffect } from 'react';
import type { RegisterContactDto } from '@/types/orientacao';

interface ContactModalProps {
  leadName: string;
  defaultContactedBy?: string;
  onSave: (dto: RegisterContactDto & { next_followup?: string }) => Promise<void>;
  onClose: () => void;
}

const CHANNELS = ['Telefone', 'WhatsApp', 'Presencial', 'Email'] as const;

export default function ContactModal({ leadName, defaultContactedBy, onSave, onClose }: ContactModalProps) {
  const [contactedBy, setContactedBy] = useState(defaultContactedBy || '');
  const [channel, setChannel] = useState<typeof CHANNELS[number]>('Telefone');
  const [result, setResult] = useState('');
  const [nextFollowup, setNextFollowup] = useState('');
  const [saving, setSaving] = useState(false);
  const resultRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on result for speed
  useEffect(() => { resultRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        contacted_by: contactedBy,
        channel,
        result: result || undefined,
        next_followup: nextFollowup || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  // Quick follow-up presets
  function setFollowupDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setNextFollowup(d.toISOString().split('T')[0]);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Registrar Contato</h3>
          <p className="text-sm text-gray-500 mt-0.5">{leadName}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Row 1: Contacted by + Channel */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 font-medium block mb-1">Quem ligou</label>
              <input
                type="text"
                value={contactedBy}
                onChange={(e) => setContactedBy(e.target.value)}
                placeholder="Maria Santos"
                required
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none"
              />
            </div>
            <div className="w-36">
              <label className="text-xs text-gray-500 font-medium block mb-1">Canal</label>
              <div className="flex gap-1">
                {CHANNELS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    title={ch}
                    className={`flex-1 py-2 rounded-lg text-base transition-all ${
                      channel === ch
                        ? 'bg-brand-100 ring-2 ring-brand-400 scale-105'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {{ Telefone: '📞', WhatsApp: '📱', Presencial: '🏥', Email: '📧' }[ch]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Result */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Resultado</label>
            <textarea
              ref={resultRef}
              value={result}
              onChange={(e) => setResult(e.target.value)}
              rows={2}
              placeholder="Ex: Paciente pediu para ligar na semana que vem"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none"
            />
          </div>

          {/* Row 3: Next follow-up with quick presets */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Próximo follow-up</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={nextFollowup}
                onChange={(e) => setNextFollowup(e.target.value)}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none"
              />
              <div className="flex gap-1">
                {[3, 7, 15, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setFollowupDays(d)}
                    className="px-2 py-1.5 text-xs bg-gray-100 hover:bg-brand-100 hover:text-brand-700 rounded-md transition-colors font-medium"
                  >
                    +{d}d
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!contactedBy || saving}
            className="px-5 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar contato'}
          </button>
        </div>
      </form>
    </div>
  );
}
