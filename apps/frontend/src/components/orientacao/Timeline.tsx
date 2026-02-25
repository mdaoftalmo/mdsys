'use client';

import type { LeadContact } from '@/types/orientacao';
import { CHANNEL_ICONS } from '@/types/orientacao';

interface TimelineProps {
  contacts: LeadContact[];
  indicationDate?: string;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Timeline({ contacts, indicationDate }: TimelineProps) {
  // Build items: contacts + indication event
  const items: Array<{
    id: string;
    date: string;
    icon: string;
    title: string;
    body?: string;
    type: 'contact' | 'event';
  }> = [];

  // Contacts (already sorted DESC from backend)
  for (const c of contacts) {
    items.push({
      id: c.id,
      date: c.date,
      icon: CHANNEL_ICONS[c.channel] || '📋',
      title: `${c.contacted_by} via ${c.channel}`,
      body: [c.result, c.notes].filter(Boolean).join(' — ') || undefined,
      type: 'contact',
    });
  }

  // Indication event at the end
  if (indicationDate) {
    items.push({
      id: 'indication',
      date: indicationDate,
      icon: '📋',
      title: 'INDICAÇÃO MÉDICA',
      body: 'Lead criado no sistema',
      type: 'event',
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-400 italic">Nenhum contato registrado.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" />

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="relative pl-10">
            {/* Dot */}
            <span className="absolute left-2.5 top-0.5 text-base leading-none">{item.icon}</span>

            {/* Content */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className={`text-xs font-medium ${item.type === 'event' ? 'text-brand-600' : 'text-gray-700'}`}>
                  {item.title}
                </span>
                <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
              </div>
              {item.body && (
                <p className="text-sm text-gray-600 mt-0.5 leading-snug">
                  &ldquo;{item.body}&rdquo;
                </p>
              )}
              {item.type === 'contact' && (item as any).scheduled_surgery_date && (
                <p className="text-xs text-green-600 font-medium mt-1">
                  🗓 Cirurgia agendada: {formatDate((item as any).scheduled_surgery_date)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
