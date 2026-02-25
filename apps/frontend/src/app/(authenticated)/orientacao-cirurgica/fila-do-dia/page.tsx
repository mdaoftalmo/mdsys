'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/hooks/use-api';
import type { SurgicalLead, RegisterContactDto } from '@/types/orientacao';
import {
  daysSince, daysUntil, contactUrgencyClass,
  scoreBadgeClass, CHANNEL_ICONS,
} from '@/types/orientacao';
import {
  ScoreBadge, LeadDrawer, ContactModal, Toast,
  EmptyState, ErrorBanner,
} from '@/components/orientacao';

// ── Priority section types ──
type Section = 'overdue' | 'followup_today' | 'high_score' | 'done_today';

interface QueueItem {
  lead: SurgicalLead;
  section: Section;
  sortKey: number; // lower = higher priority
  reason: string;
}

function categorize(lead: SurgicalLead): QueueItem | null {
  // Skip closed/lost
  if (lead.status === 'FECHOU' || lead.status === 'PERDIDO') return null;

  const sinceContact = daysSince(lead.last_contact_at);
  const followDays = daysUntil(lead.next_followup);

  // 1. OVERDUE: no contact 30d+ OR follow-up overdue > 7 days
  if (
    (sinceContact !== null && sinceContact > 30) ||
    (followDays !== null && followDays < -7)
  ) {
    return {
      lead,
      section: 'overdue',
      sortKey: sinceContact ?? 999, // more days = higher priority
      reason: sinceContact !== null && sinceContact > 30
        ? `Sem contato há ${sinceContact} dias`
        : `Follow-up vencido há ${Math.abs(followDays!)} dias`,
    };
  }

  // 2. FOLLOW-UP TODAY: due today or overdue ≤ 7 days
  if (followDays !== null && followDays <= 0 && followDays >= -7) {
    return {
      lead,
      section: 'followup_today',
      sortKey: -lead.score, // higher score first
      reason: followDays === 0
        ? 'Follow-up agendado para HOJE'
        : `Follow-up vencido há ${Math.abs(followDays)} dias`,
    };
  }

  // 3. HIGH SCORE: score ≥ 30, last contact > 5 days
  if (lead.score >= 30 && (sinceContact === null || sinceContact > 5)) {
    return {
      lead,
      section: 'high_score',
      sortKey: -lead.score,
      reason: `Score ${lead.score} — sem contato recente`,
    };
  }

  return null; // Not in queue today
}

// ── Section config ──
const SECTION_CONFIG: Record<Section, {
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  emptyText: string;
}> = {
  overdue: {
    title: '🔴 ATRASADOS',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    emptyText: 'Nenhum lead atrasado. Bom trabalho!',
  },
  followup_today: {
    title: '🟡 FOLLOW-UP HOJE',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    emptyText: 'Nenhum follow-up agendado para hoje.',
  },
  high_score: {
    title: '🔵 ALTO SCORE SEM CONTATO RECENTE',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    emptyText: 'Todos os leads de alto score foram contatados recentemente.',
  },
  done_today: {
    title: '✅ FEITAS HOJE',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    emptyText: 'Nenhum contato registrado hoje ainda.',
  },
};

export default function FilaDoDiaPage() {
  const user = useAuthStore((s) => s.user);
  const unitId = user?.unit_id || '';
  const unitParam = unitId ? `?unit_id=${unitId}` : '';

  // ── Data ──
  const [leads, setLeads] = useState<SurgicalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI ──
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [contactTarget, setContactTarget] = useState<SurgicalLead | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(false);

  // ── Fetch all pipeline leads ──
  const fetchLeads = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: SurgicalLead[] }>(
        `/orientacao-cirurgica${unitParam}&status_not=FECHOU,PERDIDO&limit=500`,
      );
      // Also fetch recently contacted for "done today" (all leads including FECHOU)
      const allRes = await api.get<{ data: SurgicalLead[] }>(
        `/orientacao-cirurgica${unitParam}&limit=500`,
      );
      setLeads(allRes.data || res.data || []);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar fila');
    } finally {
      setLoading(false);
    }
  }, [unitId, unitParam]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Build prioritized queue ──
  const { overdue, followup_today, high_score, done_today, totalPending } = useMemo(() => {
    const queue: Record<Section, QueueItem[]> = {
      overdue: [],
      followup_today: [],
      high_score: [],
      done_today: [],
    };

    const today = new Date().toISOString().split('T')[0];

    for (const lead of leads) {
      // Check if contacted today → "done" section
      const lastContactToday = lead.contacts?.some(
        (c) => c.date?.startsWith(today),
      );

      if (lastContactToday && lead.status !== 'FECHOU' && lead.status !== 'PERDIDO') {
        const lastContact = lead.contacts?.find((c) => c.date?.startsWith(today));
        queue.done_today.push({
          lead,
          section: 'done_today',
          sortKey: lastContact ? new Date(lastContact.date).getTime() : 0,
          reason: lastContact
            ? `Contato às ${new Date(lastContact.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — "${lastContact.result || 'registrado'}"`
            : 'Contato registrado hoje',
        });
        continue;
      }

      const item = categorize(lead);
      if (item) queue[item.section].push(item);
    }

    // Sort each section
    queue.overdue.sort((a, b) => b.sortKey - a.sortKey); // most overdue first
    queue.followup_today.sort((a, b) => a.sortKey - b.sortKey); // highest score first
    queue.high_score.sort((a, b) => a.sortKey - b.sortKey);
    queue.done_today.sort((a, b) => b.sortKey - a.sortKey); // most recent first

    const totalPending = queue.overdue.length + queue.followup_today.length + queue.high_score.length;

    return { ...queue, totalPending };
  }, [leads]);

  // ── Actions ──
  async function handleContactSave(dto: RegisterContactDto & { next_followup?: string }) {
    if (!contactTarget) return;
    const { next_followup, ...contactDto } = dto;
    await api.post(`/orientacao-cirurgica/${contactTarget.id}/contacts${unitParam}`, contactDto);
    if (next_followup) {
      await api.patch(`/orientacao-cirurgica/${contactTarget.id}/followup${unitParam}`, { date: next_followup });
    }
    setContactTarget(null);
    showToast(`Contato com ${contactTarget.name} registrado`);
    fetchLeads();
  }

  async function handleReschedule(lead: SurgicalLead, date: string) {
    await api.patch(`/orientacao-cirurgica/${lead.id}/followup${unitParam}`, { date });
    showToast(`Follow-up de ${lead.name} reagendado`);
    fetchLeads();
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Render a single call row ──
  function CallRow({ item }: { item: QueueItem }) {
    const { lead, reason } = item;
    const sinceContact = daysSince(lead.last_contact_at);
    const urgency = contactUrgencyClass(sinceContact);
    const lastContact = lead.contacts?.[0];

    return (
      <div className="py-3 border-b border-gray-100 last:border-0">
        {/* Row 1: Name + pathology + score */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedLeadId(lead.id)}
                className="text-sm font-semibold text-gray-800 hover:text-brand-700 truncate text-left"
              >
                {lead.name}
              </button>
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500 truncate">{lead.pathology}</span>
              <ScoreBadge score={lead.score} />
            </div>

            {/* Row 2: Context line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
              <span className={urgency.textClass}>
                {urgency.icon} {sinceContact !== null ? `Sem contato há ${sinceContact}d` : 'Sem contato'}
              </span>
              {lead.has_insurance && lead.insurance_name && (
                <span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-0.5 relative top-[-1px]" />
                  {lead.insurance_name}
                </span>
              )}
              {lead.barriers && lead.barriers.length > 0 && (
                <span className={lead.barriers.length >= 3 ? 'text-red-600' : 'text-yellow-600'}>
                  {lead.barriers.length} barreira{lead.barriers.length > 1 ? 's' : ''} ({lead.barriers.join(', ')})
                </span>
              )}
            </div>

            {/* Row 3: Last contact summary */}
            {lastContact && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                Último: {formatDate(lastContact.date)} por {lastContact.contacted_by} via {lastContact.channel}
                {lastContact.result && <> — &ldquo;{lastContact.result}&rdquo;</>}
              </p>
            )}

            {/* Reason tag */}
            <p className="text-xs font-medium mt-1" style={{ color: item.section === 'overdue' ? '#b91c1c' : item.section === 'followup_today' ? '#a16207' : '#1d4ed8' }}>
              {reason}
            </p>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex items-center gap-1.5">
            <button
              onClick={() => setContactTarget(lead)}
              className="px-3 py-1.5 text-xs font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              📞 Registrar
            </button>
            <div className="relative">
              <input
                type="date"
                onChange={(e) => {
                  if (e.target.value) handleReschedule(lead, e.target.value);
                }}
                className="w-8 h-8 opacity-0 absolute inset-0 cursor-pointer"
                title="Reagendar follow-up"
              />
              <span className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-gray-100 rounded-lg text-sm cursor-pointer">
                ⏰
              </span>
            </div>
            <button
              onClick={() => setSelectedLeadId(lead.id)}
              className="px-2 py-1.5 text-xs text-gray-500 hover:text-brand-700 font-medium"
            >
              Abrir →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done row (compact) ──
  function DoneRow({ item }: { item: QueueItem }) {
    return (
      <div className="py-2 border-b border-green-100 last:border-0 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          ✅ <strong>{item.lead.name}</strong> — {item.reason}
        </span>
        <button
          onClick={() => setSelectedLeadId(item.lead.id)}
          className="text-xs text-gray-400 hover:text-brand-700"
        >
          Abrir →
        </button>
      </div>
    );
  }

  // ── Section renderer ──
  function SectionBlock({ section, items }: { section: Section; items: QueueItem[] }) {
    const config = SECTION_CONFIG[section];
    const isDone = section === 'done_today';

    if (isDone && items.length === 0) return null; // Hide empty "done" section

    return (
      <div className={`rounded-xl border ${config.borderColor} overflow-hidden`}>
        <div
          className={`${config.bgColor} px-4 py-2.5 flex items-center justify-between ${isDone ? 'cursor-pointer' : ''}`}
          onClick={isDone ? () => setDoneCollapsed(!doneCollapsed) : undefined}
        >
          <h3 className={`text-sm font-bold ${config.color}`}>
            {config.title}
            <span className="ml-2 text-xs font-normal text-gray-500">({items.length})</span>
          </h3>
          {isDone && (
            <span className="text-xs text-gray-400">{doneCollapsed ? '▸ Expandir' : '▾ Recolher'}</span>
          )}
        </div>

        <div className={`bg-white px-4 ${isDone && doneCollapsed ? 'hidden' : ''}`}>
          {items.length === 0 ? (
            <p className="py-6 text-sm text-gray-400 text-center italic">{config.emptyText}</p>
          ) : isDone ? (
            items.map((item) => <DoneRow key={item.lead.id} item={item} />)
          ) : (
            items.map((item) => <CallRow key={item.lead.id} item={item} />)
          )}
        </div>
      </div>
    );
  }

  // ── Main render ──
  if (!unitId) {
    return <EmptyState title="Unidade não selecionada" description="Selecione uma unidade para ver a fila." />;
  }

  return (
    <div className="h-full overflow-y-auto pb-8">
      {/* Day summary */}
      <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-3 mb-4 text-sm">
        <div>
          <span className="text-gray-500">📞 </span>
          <span className="font-semibold text-gray-800">{totalPending} ligações pendentes</span>
        </div>
        <div>
          <span className="text-gray-500">✅ </span>
          <span className="font-semibold text-green-700">{done_today.length} feitas hoje</span>
        </div>
      </div>

      {error && <div className="mb-4"><ErrorBanner message={error} onRetry={fetchLeads} /></div>}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : totalPending === 0 && done_today.length === 0 ? (
        <EmptyState
          title="🎉 Todas as ligações do dia foram feitas!"
          description="Volte amanhã ou adicione novos leads no Board."
        />
      ) : (
        <div className="space-y-4">
          <SectionBlock section="overdue" items={overdue} />
          <SectionBlock section="followup_today" items={followup_today} />
          <SectionBlock section="high_score" items={high_score} />
          <SectionBlock section="done_today" items={done_today} />
        </div>
      )}

      {/* Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          unitId={unitId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={fetchLeads}
        />
      )}

      {/* Contact modal */}
      {contactTarget && (
        <ContactModal
          leadName={contactTarget.name}
          defaultContactedBy={contactTarget.responsavel || user?.name}
          onSave={handleContactSave}
          onClose={() => setContactTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
