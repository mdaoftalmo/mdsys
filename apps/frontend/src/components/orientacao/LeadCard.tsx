'use client';

import type { SurgicalLead } from '@/types/orientacao';
import { daysSince, daysUntil, contactUrgencyClass, LEAD_STATUS_CONFIG } from '@/types/orientacao';
import ScoreBadge from './ScoreBadge';

interface LeadCardProps {
  lead: SurgicalLead;
  onClick: (lead: SurgicalLead) => void;
  compact?: boolean;
}

export default function LeadCard({ lead, onClick, compact }: LeadCardProps) {
  const sinceLast = daysSince(lead.last_contact_at);
  const urgency = contactUrgencyClass(sinceLast);
  const followupDays = daysUntil(lead.next_followup);
  const followupOverdue = followupDays !== null && followupDays < 0;

  const isClosed = lead.status === 'FECHOU';
  const isLost = lead.status === 'PERDIDO';

  return (
    <button
      onClick={() => onClick(lead)}
      className={`w-full text-left bg-white rounded-lg border p-3 transition-all duration-150 hover:shadow-md hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/40 group ${
        isClosed ? 'border-green-200 bg-green-50/30' :
        isLost ? 'border-red-100 bg-red-50/20 opacity-75' :
        'border-gray-150'
      }`}
    >
      {/* Row 1: Name + Score */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-1 group-hover:text-brand-700">
          {lead.name}
        </span>
        <ScoreBadge score={lead.score} />
      </div>

      {/* Row 2: Pathology */}
      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{lead.pathology}</p>

      {/* Row 3: Insurance */}
      {lead.has_insurance && lead.insurance_name && (
        <p className="text-xs mt-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 relative top-[-1px]" />
          <span className="text-gray-600">{lead.insurance_name}</span>
        </p>
      )}
      {!lead.has_insurance && !compact && (
        <p className="text-xs text-gray-400 mt-1.5">Particular</p>
      )}

      {/* Row 4: Barriers */}
      {lead.barriers && lead.barriers.length > 0 && !compact && (
        <p className={`text-xs mt-1.5 ${lead.barriers.length >= 3 ? 'text-red-600 font-medium' : 'text-yellow-600'}`}>
          {lead.barriers.length >= 3 ? '🔴' : '🟡'} {lead.barriers.length} barreira{lead.barriers.length > 1 ? 's' : ''}
          {lead.barriers.length <= 2 && (
            <span className="text-gray-400 font-normal"> ({lead.barriers.join(', ')})</span>
          )}
        </p>
      )}

      {/* Row 5: Contact urgency + Follow-up */}
      {!isClosed && !isLost && (
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          {/* Last contact */}
          <span className={`text-xs ${urgency.textClass}`}>
            {urgency.icon} {urgency.label}
          </span>

          {/* Next follow-up */}
          {lead.next_followup && (
            <span className={`text-xs ${followupOverdue ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
              {followupOverdue
                ? `⏰ vencido ${Math.abs(followupDays!)}d`
                : `⏰ ${followupDays}d`}
            </span>
          )}
        </div>
      )}

      {/* Closed indicator */}
      {isClosed && (
        <p className="text-xs text-green-600 mt-2 pt-2 border-t border-green-100 font-medium">
          ✓ Operou
        </p>
      )}

      {/* Lost indicator */}
      {isLost && lead.lost_reason && (
        <p className="text-xs text-red-400 mt-2 pt-2 border-t border-red-100 line-clamp-1">
          {lead.lost_reason}
        </p>
      )}
    </button>
  );
}
