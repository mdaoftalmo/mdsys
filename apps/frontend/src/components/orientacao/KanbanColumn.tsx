'use client';

import type { SurgicalLead, LeadStatus } from '@/types/orientacao';
import { LEAD_STATUS_CONFIG } from '@/types/orientacao';
import LeadCard from './LeadCard';

interface KanbanColumnProps {
  status: LeadStatus;
  leads: SurgicalLead[];
  onLeadClick: (lead: SurgicalLead) => void;
}

export default function KanbanColumn({ status, leads, onLeadClick }: KanbanColumnProps) {
  const config = LEAD_STATUS_CONFIG[status];

  return (
    <div className="w-72 shrink-0 flex flex-col max-h-full">
      {/* Column header */}
      <div
        className="rounded-t-xl px-3 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: config.bgColor, borderTop: `3px solid ${config.color}` }}
      >
        <span className="text-sm font-semibold" style={{ color: config.color }}>
          {config.label}
        </span>
        <span
          className="text-xs font-bold rounded-full px-2 py-0.5 min-w-[24px] text-center"
          style={{ backgroundColor: config.color, color: '#fff' }}
        >
          {leads.length}
        </span>
      </div>

      {/* Cards container */}
      <div
        className="flex-1 overflow-y-auto px-2 pb-2 pt-2 space-y-2 bg-gray-50/70 rounded-b-xl border border-t-0"
        style={{ borderColor: config.borderColor }}
      >
        {leads.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-8 italic">
            Nenhum lead
          </p>
        )}
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
        ))}
      </div>
    </div>
  );
}
