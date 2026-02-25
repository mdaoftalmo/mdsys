'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { SurgicalLead, LeadStatus, KanbanResponse, CreateLeadDto } from '@/types/orientacao';
import { COLUMN_ORDER, LEAD_STATUS_CONFIG, daysSince } from '@/types/orientacao';
import {
  KanbanColumn, FiltersBar, LeadDrawer, NewLeadModal,
  EmptyState, ErrorBanner, SkeletonColumn, Toast,
} from '@/components/orientacao';

export default function BoardPage() {
  const user = useAuthStore((s) => s.user);
  const unitId = user?.unit_id || '';
  const unitParam = unitId ? `?unit_id=${unitId}` : '';

  // ── Data state ──
  const [data, setData] = useState<KanbanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── UI state ──
  const [pathologyFilter, setPathologyFilter] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // ── Fetch kanban ──
  const fetchKanban = useCallback(async () => {
    if (!unitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<KanbanResponse>(`/orientacao-cirurgica/kanban${unitParam}`);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar board');
    } finally {
      setLoading(false);
    }
  }, [unitId, unitParam]);

  useEffect(() => { fetchKanban(); }, [fetchKanban]);

  // ── Derive filter options from data ──
  const allLeads = useMemo(() => {
    if (!data) return [];
    return Object.values(data.columns).flat();
  }, [data]);

  const pathologies = useMemo(
    () => [...new Set(allLeads.map((l) => l.pathology).filter(Boolean))].sort(),
    [allLeads],
  );
  const responsaveis = useMemo(
    () => [...new Set(allLeads.map((l) => l.responsavel).filter(Boolean) as string[])].sort(),
    [allLeads],
  );

  // ── Filter leads per column ──
  const filteredColumns = useMemo(() => {
    if (!data) return {} as Record<LeadStatus, SurgicalLead[]>;

    const result: Record<string, SurgicalLead[]> = {};
    for (const status of COLUMN_ORDER) {
      let leads = data.columns[status] || [];

      if (pathologyFilter) {
        leads = leads.filter((l) => l.pathology === pathologyFilter);
      }
      if (responsavelFilter) {
        leads = leads.filter((l) => l.responsavel === responsavelFilter);
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        leads = leads.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.phone?.includes(q) ||
            l.cpf?.includes(q),
        );
      }

      result[status] = leads;
    }
    return result as Record<LeadStatus, SurgicalLead[]>;
  }, [data, pathologyFilter, responsavelFilter, searchFilter]);

  // ── Computed stats ──
  const stats = useMemo(() => {
    if (!data) return null;
    const all = Object.values(data.columns).flat();
    const pipeline = all.filter((l) => l.status !== 'FECHOU' && l.status !== 'PERDIDO');
    const fechou = data.columns.FECHOU?.length || 0;
    const perdido = data.columns.PERDIDO?.length || 0;
    const overdueCount = pipeline.filter((l) => {
      const d = daysSince(l.last_contact_at);
      return d !== null && d > 30;
    }).length;
    const total = all.length;
    const convRate = total > 0 ? Math.round((fechou / total) * 100) : 0;
    return { pipeline: pipeline.length, fechou, perdido, convRate, overdueCount };
  }, [data]);

  // ── Actions ──
  async function handleCreateLead(dto: CreateLeadDto) {
    await api.post(`/orientacao-cirurgica${unitParam}`, dto);
    setShowNewLead(false);
    showToast('Lead criado com sucesso');
    fetchKanban();
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Render ──
  if (!unitId) {
    return (
      <EmptyState
        title="Unidade não selecionada"
        description="Selecione uma unidade para visualizar o board."
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Top row: filters + new lead */}
      <div className="shrink-0 flex items-start gap-3">
        <div className="flex-1">
          <FiltersBar
            pathologies={pathologies}
            responsaveis={responsaveis}
            pathology={pathologyFilter}
            responsavel={responsavelFilter}
            search={searchFilter}
            onPathologyChange={setPathologyFilter}
            onResponsavelChange={setResponsavelFilter}
            onSearchChange={setSearchFilter}
          />
        </div>
        <button
          onClick={() => setShowNewLead(true)}
          className="shrink-0 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
        >
          + Novo Lead
        </button>
      </div>

      {/* Summary strip */}
      {stats && (
        <div className="shrink-0 flex items-center gap-6 bg-white border border-gray-200 rounded-xl px-5 py-2.5 text-sm">
          <div>
            <span className="text-gray-500">Pipeline: </span>
            <span className="font-semibold text-gray-800">{stats.pipeline}</span>
          </div>
          <div>
            <span className="text-gray-500">Fecharam: </span>
            <span className="font-semibold text-green-700">{stats.fechou}</span>
          </div>
          <div>
            <span className="text-gray-500">Perdidos: </span>
            <span className="font-semibold text-gray-600">{stats.perdido}</span>
          </div>
          <div>
            <span className="text-gray-500">Conversão: </span>
            <span className="font-semibold text-brand-700">{stats.convRate}%</span>
          </div>
          {stats.overdueCount > 0 && (
            <div className="text-red-600 font-medium">
              ⚠ {stats.overdueCount} atrasado{stats.overdueCount > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <ErrorBanner message={error} onRetry={fetchKanban} />
      )}

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden kanban-scroll">
        {loading ? (
          <div className="flex gap-3 pb-4 h-full">
            {COLUMN_ORDER.map((s) => <SkeletonColumn key={s} />)}
          </div>
        ) : allLeads.length === 0 ? (
          <EmptyState
            title="Nenhum lead na unidade"
            description="Comece adicionando o primeiro paciente indicado para cirurgia."
            action={{ label: '+ Novo Lead', onClick: () => setShowNewLead(true) }}
          />
        ) : (
          <div className="flex gap-3 pb-4 h-full">
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={filteredColumns[status] || []}
                onLeadClick={(lead) => setSelectedLeadId(lead.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedLeadId && (
        <LeadDrawer
          leadId={selectedLeadId}
          unitId={unitId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={fetchKanban}
        />
      )}

      {/* New lead modal */}
      {showNewLead && (
        <NewLeadModal
          onSave={handleCreateLead}
          onClose={() => setShowNewLead(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
