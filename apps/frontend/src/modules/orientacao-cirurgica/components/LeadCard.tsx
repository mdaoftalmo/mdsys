'use client';

import type { SurgicalLead } from '../types';
import { ScoreBadge } from './ScoreBadge';
import {
  daysSince, formatRelativeDate, getContactUrgency,
  CONTACT_THRESHOLDS, formatDateBR,
} from '../constants';

interface Props {
  lead: SurgicalLead;
  onClick: (lead: SurgicalLead) => void;
  onQuickStatus?: (leadId: string, status: 'FECHOU' | 'PERDIDO') => void;
  compact?: boolean;
}

const urgencyStyles: Record<string, string> = {
  ok:       'text-slate-500',
  warning:  'text-amber-600',
  danger:   'text-orange-600 font-medium',
  critical: 'text-red-600 font-semibold',
};

export function LeadCard({ lead, onClick, onQuickStatus, compact }: Props) {
  const dsc = daysSince(lead.last_contact_at);
  const urgency = getContactUrgency(dsc);
  const contactText = formatRelativeDate(lead.last_contact_at);
  const barrierCount = lead.barriers?.length || 0;

  // Follow-up status
  const followupDays = lead.next_followup ? daysSince(lead.next_followup) : null;
  const followupOverdue = followupDays !== null && followupDays > 0;

  return (
    <div
      onClick={() => onClick(lead)}
      className="bg-white rounded-xl border border-slate-200 p-3.5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group"
    >
      {/* Row 1: Name + Score */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1 mr-2">
          <h4 className="text-sm font-semibold text-slate-800 truncate leading-tight">
            {lead.name}
          </h4>
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {lead.pathology}
          </p>
        </div>
        <ScoreBadge score={lead.score} size="sm" />
      </div>

      {/* Row 2: Insurance */}
      {lead.has_insurance && lead.insurance_name && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="text-xs text-emerald-700 truncate">{lead.insurance_name}</span>
        </div>
      )}
      {!lead.has_insurance && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
          <span className="text-xs text-slate-400">Particular</span>
        </div>
      )}

      {/* Row 3: Barriers */}
      {barrierCount > 0 && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={`text-xs ${barrierCount >= 3 ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
            {barrierCount >= 3 ? '🔴' : '🟡'} {barrierCount} {barrierCount === 1 ? 'barreira' : 'barreiras'}
          </span>
        </div>
      )}

      {/* Row 4: Last contact */}
      <div className={`flex items-center gap-1.5 text-xs ${urgencyStyles[urgency]} mb-1.5`}>
        <span>📞</span>
        <span>{contactText}</span>
      </div>

      {/* Row 5: Next follow-up */}
      {lead.next_followup && (
        <div className={`flex items-center gap-1.5 text-xs ${followupOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
          <span>⏰</span>
          <span className={followupOverdue ? 'line-through' : ''}>
            Follow-up: {formatDateBR(lead.next_followup)}
          </span>
          {followupOverdue && <span className="text-red-500 no-underline"> (vencido)</span>}
        </div>
      )}

      {/* Quick actions (visible on hover) */}
      {onQuickStatus && lead.status !== 'FECHOU' && lead.status !== 'PERDIDO' && (
        <div className="flex gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onQuickStatus(lead.id, 'FECHOU'); }}
            className="flex-1 text-xs py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors font-medium"
          >
            ✓ Fechou
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onQuickStatus(lead.id, 'PERDIDO'); }}
            className="flex-1 text-xs py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors font-medium"
          >
            ✗ Perdeu
          </button>
        </div>
      )}
    </div>
  );
}
