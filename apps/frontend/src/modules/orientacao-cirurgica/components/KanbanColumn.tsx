'use client';

import type { SurgicalLead, LeadStatus } from '../types';
import { STATUS_CONFIG } from '../constants';
import { LeadCard } from './LeadCard';

interface Props {
  status: LeadStatus;
  leads: SurgicalLead[];
  onLeadClick: (lead: SurgicalLead) => void;
  onQuickStatus?: (leadId: string, status: 'FECHOU' | 'PERDIDO') => void;
}

export function KanbanColumn({ status, leads, onLeadClick, onQuickStatus }: Props) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="w-[272px] shrink-0 flex flex-col max-h-full">
      {/* Column header */}
      <div className={`rounded-xl ${config.color} border-t-[3px] ${config.border} px-3.5 py-2.5 mb-2.5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{config.icon}</span>
            <h3 className={`text-sm font-semibold ${config.text}`}>{config.label}</h3>
          </div>
          <span className={`text-xs font-bold ${config.text} bg-white/60 px-2 py-0.5 rounded-full`}>
            {leads.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-2 min-h-[120px] scrollbar-thin">
        {leads.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400">
            Nenhum lead
          </div>
        )}
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={onLeadClick}
            onQuickStatus={onQuickStatus}
          />
        ))}
      </div>
    </div>
  );
}
