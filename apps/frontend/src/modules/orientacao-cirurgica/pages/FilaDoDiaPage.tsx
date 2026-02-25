'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { OrientacaoLayout } from '../layout/OrientacaoLayout';
import {
  CallRow, LeadDrawer, ContactModal, EmptyState, ErrorBanner,
  ListSkeleton, Toast,
} from '../components';
import { useFilaDoDia, useMutations } from '../hooks';
import type { SurgicalLead, RegisterContactPayload, QueueItem } from '../types';

const SECTION_CONFIG = {
  overdue: {
    title: 'ATRASADOS',
    color: 'text-red-700 bg-red-50 border-red-200',
    icon: '🔴',
    description: 'Leads sem contato há 30+ dias ou follow-up muito vencido',
  },
  today: {
    title: 'FOLLOW-UP HOJE',
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    icon: '🟡',
    description: 'Follow-up agendado para hoje ou recentemente vencido',
  },
  high_score: {
    title: 'ALTO SCORE SEM CONTATO RECENTE',
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    icon: '🔵',
    description: 'Score ≥ 30 sem contato há 5+ dias',
  },
  done: {
    title: 'FEITAS HOJE ✅',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    icon: '✅',
    description: '',
  },
};

type Section = keyof typeof SECTION_CONFIG;
const SECTION_ORDER: Section[] = ['overdue', 'today', 'high_score', 'done'];

export default function FilaDoDiaPage() {
  const { queue, counts, pendingCount, loading, error, refetch } = useFilaDoDia();
  const mutations = useMutations(refetch);
  const router = useRouter();

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [contactTarget, setContactTarget] = useState<SurgicalLead | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [doneCollapsed, setDoneCollapsed] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Group items by section
  const grouped = useMemo(() => {
    const groups: Record<Section, QueueItem[]> = {
      overdue: [], today: [], high_score: [], done: [],
    };
    for (const item of queue) {
      groups[item.section as Section]?.push(item);
    }
    return groups;
  }, [queue]);

  const handleRegisterContact = async (data: RegisterContactPayload & { next_followup?: string }) => {
    if (!contactTarget) return;
    const { next_followup, ...contactData } = data;
    await mutations.registerContact(contactTarget.id, contactData);
    if (next_followup) {
      await mutations.scheduleFollowup(contactTarget.id, next_followup);
    }
    setContactTarget(null);
    showToast(`✅ Contato com ${contactTarget.name} registrado`);
  };

  const handleReschedule = async (lead: SurgicalLead) => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    await mutations.scheduleFollowup(lead.id, d.toISOString().slice(0, 10));
    showToast(`⏰ ${lead.name} reagendado para +7 dias`);
  };

  const totalPending = counts.overdue + counts.today;
  const allDone = totalPending === 0 && counts.done > 0;

  return (
    <OrientacaoLayout filaPendingCount={pendingCount}>
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Day summary */}
      {!loading && (
        <div className="flex flex-wrap items-center gap-6 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl px-5 py-3 mb-5">
          <div className="text-sm">
            📞 <strong className="text-slate-800">{totalPending}</strong>
            <span className="text-slate-500"> ligações pendentes</span>
          </div>
          <div className="text-sm">
            ✅ <strong className="text-emerald-700">{counts.done}</strong>
            <span className="text-slate-500"> feitas hoje</span>
          </div>
          {counts.high_score > 0 && (
            <div className="text-sm">
              🔵 <strong className="text-blue-700">{counts.high_score}</strong>
              <span className="text-slate-500"> alto score para contatar</span>
            </div>
          )}
        </div>
      )}

      {loading && <ListSkeleton rows={6} />}

      {/* All done state */}
      {!loading && allDone && (
        <div className="text-center py-12">
          <span className="text-5xl mb-4 block">🎉</span>
          <h3 className="text-lg font-bold text-slate-700 mb-1">
            Todas as ligações do dia foram feitas!
          </h3>
          <p className="text-sm text-slate-500">Volte amanhã ou confira o board para novos leads.</p>
        </div>
      )}

      {/* Completely empty */}
      {!loading && !error && queue.length === 0 && (
        <EmptyState
          icon="📞"
          title="Nenhuma ligação pendente"
          description="Quando houver leads que precisam de contato, eles aparecerão aqui automaticamente."
        />
      )}

      {/* Sections */}
      {!loading && (
        <div className="space-y-6">
          {SECTION_ORDER.map((section) => {
            const items = grouped[section];
            if (!items || items.length === 0) return null;
            const cfg = SECTION_CONFIG[section];
            const isCollapsible = section === 'done';
            const isCollapsed = isCollapsible && doneCollapsed;

            return (
              <div key={section}>
                {/* Section header */}
                <div
                  className={`flex items-center justify-between ${cfg.color} border rounded-xl px-4 py-2.5 mb-3 ${isCollapsible ? 'cursor-pointer' : ''}`}
                  onClick={isCollapsible ? () => setDoneCollapsed(!doneCollapsed) : undefined}
                >
                  <div className="flex items-center gap-2">
                    <span>{cfg.icon}</span>
                    <h3 className="text-sm font-bold">{cfg.title} ({items.length})</h3>
                  </div>
                  {isCollapsible && (
                    <span className="text-xs">{isCollapsed ? '▸ Expandir' : '▾ Recolher'}</span>
                  )}
                </div>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <CallRow
                        key={item.lead.id}
                        item={item}
                        onRegisterContact={setContactTarget}
                        onReschedule={handleReschedule}
                        onOpenDrawer={(lead) => setSelectedLeadId(lead.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onRefresh={refetch}
        />
      )}

      {/* Contact Modal */}
      {contactTarget && (
        <ContactModal
          leadName={contactTarget.name}
          onSubmit={handleRegisterContact}
          onClose={() => setContactTarget(null)}
          loading={mutations.loading}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </OrientacaoLayout>
  );
}
