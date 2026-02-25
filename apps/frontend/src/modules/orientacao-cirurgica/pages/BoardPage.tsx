'use client';

import { useState, useMemo, useCallback } from 'react';
import { OrientacaoLayout } from '../layout/OrientacaoLayout';
import {
  KanbanColumn, FiltersBar, LeadDrawer, NewLeadModal, LostReasonModal,
  EmptyState, ErrorBanner, KanbanSkeleton, Toast,
} from '../components';
import { useKanban, useFilaDoDia, useMutations } from '../hooks';
import { KANBAN_COLUMNS, ARCHIVE_COLUMNS, STATUS_CONFIG } from '../constants';
import type { SurgicalLead, LeadStatus, CreateLeadPayload } from '../types';

export default function BoardPage() {
  const { data, loading, error, refetch, overdueCount } = useKanban();
  const { pendingCount } = useFilaDoDia();
  const mutations = useMutations(refetch);

  // UI state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [lostTarget, setLostTarget] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({ search: '', pathology: '', responsavel: '' });

  // Extract unique pathologies and responsáveis from data
  const { pathologies, responsaveis } = useMemo(() => {
    if (!data) return { pathologies: [], responsaveis: [] };
    const allLeads: SurgicalLead[] = [];
    for (const leads of Object.values(data.columns)) allLeads.push(...leads);
    return {
      pathologies: [...new Set(allLeads.map((l) => l.pathology.split('–')[0].split('-')[0].trim()))].sort(),
      responsaveis: [...new Set(allLeads.map((l) => l.responsavel).filter(Boolean) as string[])].sort(),
    };
  }, [data]);

  // Apply client-side filters
  const filteredColumns = useMemo(() => {
    if (!data) return null;

    const filtered: Record<string, SurgicalLead[]> = {};
    for (const [status, leads] of Object.entries(data.columns)) {
      filtered[status] = leads.filter((lead) => {
        if (filters.search) {
          const s = filters.search.toLowerCase();
          if (!lead.name.toLowerCase().includes(s) &&
              !lead.phone.includes(s) &&
              !(lead.cpf || '').includes(s)) return false;
        }
        if (filters.pathology) {
          if (!lead.pathology.toLowerCase().includes(filters.pathology.toLowerCase())) return false;
        }
        if (filters.responsavel) {
          if (lead.responsavel !== filters.responsavel) return false;
        }
        return true;
      });
    }
    return filtered;
  }, [data, filters]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleQuickStatus = useCallback(async (leadId: string, status: 'FECHOU' | 'PERDIDO') => {
    if (status === 'PERDIDO') {
      setLostTarget(leadId);
      return;
    }
    const lead = findLead(leadId);
    await mutations.changeStatus(leadId, { status });
    if (lead) showToast(`${lead.name} movido para ${STATUS_CONFIG[status].label}`);
  }, [data]);

  const handleLostConfirm = async (reason: string) => {
    if (!lostTarget) return;
    const lead = findLead(lostTarget);
    await mutations.changeStatus(lostTarget, { status: 'PERDIDO', lost_reason: reason });
    setLostTarget(null);
    if (lead) showToast(`${lead.name} marcado como Perdido`);
  };

  const handleNewLead = async (payload: CreateLeadPayload) => {
    const result = await mutations.createLead(payload);
    if (result) {
      setShowNewLead(false);
      setSelectedLeadId(result.id);
      showToast(`${result.name} criado com sucesso`);
    }
  };

  // Helper to find lead by id across all columns
  function findLead(id: string): SurgicalLead | undefined {
    if (!data) return undefined;
    for (const leads of Object.values(data.columns)) {
      const found = leads.find((l) => l.id === id);
      if (found) return found;
    }
    return undefined;
  }

  const lostLeadName = lostTarget ? findLead(lostTarget)?.name || 'Lead' : '';

  const hasActiveFilters = filters.search || filters.pathology || filters.responsavel;

  // Pipeline total for filtered view
  const filteredTotal = filteredColumns
    ? Object.values(filteredColumns).reduce((sum, leads) => sum + leads.length, 0)
    : 0;

  return (
    <OrientacaoLayout filaPendingCount={pendingCount}>
      {/* Error */}
      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {/* Filters + New Lead button */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-1">
          <FiltersBar
            pathologies={pathologies}
            responsaveis={responsaveis}
            onFilterChange={setFilters}
          />
        </div>
        <button
          onClick={() => setShowNewLead(true)}
          className="shrink-0 px-5 py-[11px] bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md"
        >
          + Novo Lead
        </button>
      </div>

      {/* Summary strip */}
      {data && !loading && (
        <div className="flex flex-wrap items-center gap-6 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl px-5 py-3 mb-5">
          <div className="text-sm">
            <span className="text-slate-500">Pipeline: </span>
            <strong className="text-slate-800">{hasActiveFilters ? filteredTotal : data.stats.em_pipeline}</strong>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Fecharam: </span>
            <strong className="text-emerald-700">{data.stats.fechou}</strong>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Perdidos: </span>
            <strong className="text-red-600">{data.stats.perdido}</strong>
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Conversão: </span>
            <strong className="text-indigo-700">{data.stats.conversion_rate_pct}%</strong>
          </div>
          {overdueCount > 0 && (
            <div className="text-sm text-red-600 font-semibold">
              ⚠ {overdueCount} atrasados
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && <KanbanSkeleton />}

      {/* Empty */}
      {!loading && !error && data && data.stats.total === 0 && (
        <EmptyState
          icon="🏥"
          title="Nenhum lead na unidade"
          description="Comece adicionando o primeiro paciente para orientação cirúrgica."
          action={{ label: '+ Novo Lead', onClick: () => setShowNewLead(true) }}
        />
      )}

      {/* Empty after filter */}
      {!loading && !error && hasActiveFilters && filteredTotal === 0 && data && data.stats.total > 0 && (
        <EmptyState
          icon="🔍"
          title="Nenhum lead encontrado para esse filtro"
          description="Tente ajustar os filtros ou limpar a busca."
        />
      )}

      {/* Kanban board */}
      {!loading && filteredColumns && filteredTotal > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2">
          {/* Main columns */}
          {KANBAN_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={filteredColumns[status] || []}
              onLeadClick={(lead) => setSelectedLeadId(lead.id)}
              onQuickStatus={handleQuickStatus}
            />
          ))}

          {/* Separator */}
          <div className="w-px bg-slate-200 shrink-0 mx-1" />

          {/* Archive columns */}
          {ARCHIVE_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              leads={filteredColumns[status] || []}
              onLeadClick={(lead) => setSelectedLeadId(lead.id)}
            />
          ))}
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

      {/* New Lead Modal */}
      {showNewLead && (
        <NewLeadModal
          onSubmit={handleNewLead}
          onClose={() => setShowNewLead(false)}
          loading={mutations.loading}
        />
      )}

      {/* Lost Reason Modal */}
      {lostTarget && (
        <LostReasonModal
          leadName={lostLeadName}
          onConfirm={handleLostConfirm}
          onClose={() => setLostTarget(null)}
          loading={mutations.loading}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </OrientacaoLayout>
  );
}
