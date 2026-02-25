'use client';

import type { LeadContact } from '../types';
import { CHANNEL_ICONS, formatDateBR } from '../constants';

interface Props {
  contacts: LeadContact[];
  createdAt: string;
  onRegisterContact?: () => void;
}

export function Timeline({ contacts, createdAt, onRegisterContact }: Props) {
  if (contacts.length === 0 && !createdAt) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-slate-500 mb-3">Nenhum contato registrado.</p>
        {onRegisterContact && (
          <button
            onClick={onRegisterContact}
            className="text-sm text-indigo-600 font-medium hover:text-indigo-800"
          >
            📞 Registrar primeiro contato
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-slate-200" />

      <div className="space-y-4">
        {contacts.map((contact) => {
          const icon = CHANNEL_ICONS[contact.channel as keyof typeof CHANNEL_ICONS] || '📌';
          return (
            <div key={contact.id} className="relative pl-10">
              {/* Dot */}
              <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />

              <div className="bg-slate-50 rounded-lg px-3.5 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{icon}</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {formatDateBR(contact.date)}
                  </span>
                  <span className="text-xs text-slate-500">
                    — {contact.contacted_by} via {contact.channel}
                  </span>
                </div>
                {contact.result && (
                  <p className="text-sm text-slate-600 leading-relaxed">
                    &ldquo;{contact.result}&rdquo;
                  </p>
                )}
                {contact.notes && (
                  <p className="text-xs text-slate-400 mt-1 italic">{contact.notes}</p>
                )}
                {contact.scheduled_surgery_date && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                    <span>🗓</span>
                    <span>Cirurgia agendada: {formatDateBR(contact.scheduled_surgery_date)}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Lead creation (bottom of timeline) */}
        <div className="relative pl-10">
          <div className="absolute left-2.5 top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white shadow-sm" />
          <div className="bg-white border border-dashed border-slate-200 rounded-lg px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs font-semibold text-slate-500">
                {formatDateBR(createdAt)} — INDICAÇÃO MÉDICA
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Lead criado no sistema</p>
          </div>
        </div>
      </div>
    </div>
  );
}
