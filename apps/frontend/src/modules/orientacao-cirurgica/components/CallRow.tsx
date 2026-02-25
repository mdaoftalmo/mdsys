'use client';

import type { SurgicalLead, QueueItem } from '../types';
import { ScoreBadge } from './ScoreBadge';
import { formatRelativeDate, formatDateBR, CHANNEL_ICONS } from '../constants';

interface Props {
  item: QueueItem;
  onRegisterContact: (lead: SurgicalLead) => void;
  onReschedule: (lead: SurgicalLead) => void;
  onOpenDrawer: (lead: SurgicalLead) => void;
}

const sectionStyles = {
  overdue:    'border-l-red-500',
  today:      'border-l-amber-400',
  high_score: 'border-l-blue-400',
  done:       'border-l-emerald-400 opacity-60',
};

export function CallRow({ item, onRegisterContact, onReschedule, onOpenDrawer }: Props) {
  const { lead, section, days_since_contact } = item;
  const lastContact = lead.contacts?.[0];
  const channelIcon = lastContact
    ? CHANNEL_ICONS[lastContact.channel as keyof typeof CHANNEL_ICONS] || '📌'
    : null;

  const isDone = section === 'done';

  return (
    <div className={`bg-white rounded-xl border border-slate-200 border-l-4 ${sectionStyles[section]} p-4 transition-all ${isDone ? '' : 'hover:shadow-md'}`}>
      <div className="flex items-start gap-3">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Name, pathology, score */}
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="text-sm font-bold text-slate-800 truncate">{lead.name}</h4>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 truncate">{lead.pathology}</span>
            <ScoreBadge score={lead.score} size="sm" />
          </div>

          {/* Row 2: Context line */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mb-2">
            <span className={`font-medium ${
              days_since_contact > 30 ? 'text-red-600' :
              days_since_contact > 7 ? 'text-amber-600' : 'text-slate-600'
            }`}>
              {lead.last_contact_at
                ? `Sem contato ${formatRelativeDate(lead.last_contact_at)}`
                : 'Nunca contatado'
              }
            </span>

            {lead.has_insurance && lead.insurance_name && (
              <span className="text-emerald-600">{lead.insurance_name}</span>
            )}

            {(lead.barriers?.length || 0) > 0 && (
              <span className={(lead.barriers?.length || 0) >= 3 ? 'text-red-500 font-medium' : 'text-amber-600'}>
                {lead.barriers?.length} {(lead.barriers?.length || 0) === 1 ? 'barreira' : 'barreiras'} ({lead.barriers?.join(', ')})
              </span>
            )}

            {lead.desired_timeframe && (
              <span>Quer operar em {lead.desired_timeframe} dias</span>
            )}
          </div>

          {/* Row 3: Last contact detail */}
          {lastContact && (
            <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-2">
              <span className="shrink-0">{channelIcon}</span>
              <span>
                <strong>{formatDateBR(lastContact.date)}</strong> por {lastContact.contacted_by} via {lastContact.channel}
                {lastContact.result && <> — &ldquo;{lastContact.result}&rdquo;</>}
              </span>
            </div>
          )}

          {!lastContact && !isDone && (
            <p className="text-xs text-slate-400 italic mb-2">Nenhum contato registrado ainda</p>
          )}

          {/* Done state: show what was done */}
          {isDone && lastContact && (
            <p className="text-xs text-emerald-600 font-medium">
              ✅ Contato registrado às {new Date(lastContact.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              {lastContact.result && <> — &ldquo;{lastContact.result}&rdquo;</>}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={() => onRegisterContact(lead)}
            className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            📞 Registrar Contato
          </button>
          <button
            onClick={() => onReschedule(lead)}
            className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            ⏰ Reagendar
          </button>
          <button
            onClick={() => onOpenDrawer(lead)}
            className="px-3 py-2 text-xs font-medium bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Abrir →
          </button>
        </div>
      )}
    </div>
  );
}
