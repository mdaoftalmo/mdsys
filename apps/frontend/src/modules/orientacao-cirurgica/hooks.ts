// ═══════════════════════════════════════════════════════════════
// Hooks — data fetching + derived state
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from './api';
import type {
  KanbanResponse, SurgicalLead, FunnelStat, QueueItem,
  PathologyAnalysis, PathologyAlert, LeadStatus, LeadFilters,
  CreateLeadPayload, ChangeStatusPayload, RegisterContactPayload,
} from './types';
import { daysSince, getContactUrgency, KANBAN_COLUMNS } from './constants';

// ── Generic fetch hook ──

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

function useFetch<T>(fetcher: () => Promise<T>, deps: any[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Erro desconhecido'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, loading, error, refetch };
}

// ══════════════════════════════════
// KANBAN HOOK
// ══════════════════════════════════

export function useKanban() {
  const state = useFetch<KanbanResponse>(() => api.getKanban());

  const overdueCount = useMemo(() => {
    if (!state.data) return 0;
    let count = 0;
    for (const col of KANBAN_COLUMNS) {
      for (const lead of state.data.columns[col] || []) {
        const ds = daysSince(lead.last_contact_at);
        if (ds !== null && ds > 30) count++;
        else if (ds === null) count++;
      }
    }
    return count;
  }, [state.data]);

  return { ...state, overdueCount };
}

// ══════════════════════════════════
// LEAD DETAIL HOOK
// ══════════════════════════════════

export function useLeadDetail(id: string | null) {
  const state = useFetch<SurgicalLead>(
    () => id ? api.getLeadById(id) : Promise.resolve(null as any),
    [id],
  );

  return state;
}

// ══════════════════════════════════
// FILA DO DIA (client-side queue)
// ══════════════════════════════════

export function useFilaDoDia() {
  const kanban = useFetch<KanbanResponse>(() => api.getKanban());

  const queue = useMemo<QueueItem[]>(() => {
    if (!kanban.data) return [];
    const items: QueueItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // Flatten all non-terminal columns
    const activeCols: LeadStatus[] = ['PRIMEIRA', 'PROPENSO', 'INDECISO', 'RETORNO', 'PACIENTE'];
    const allLeads: SurgicalLead[] = [];
    for (const col of activeCols) {
      allLeads.push(...(kanban.data.columns[col] || []));
    }

    for (const lead of allLeads) {
      const dsc = daysSince(lead.last_contact_at);
      const urgency = getContactUrgency(dsc);

      // Contact registered today? → done
      const lastContact = lead.contacts?.[0];
      const lastContactToday = lastContact &&
        new Date(lastContact.date).toISOString().slice(0, 10) === todayStr;

      if (lastContactToday) {
        items.push({ lead, section: 'done', days_since_contact: dsc ?? 999, urgency: 'ok' });
        continue;
      }

      // Overdue: >30 days without contact OR followup overdue >7 days
      const followupDate = lead.next_followup ? new Date(lead.next_followup) : null;
      const followupDaysOverdue = followupDate
        ? Math.floor((today.getTime() - followupDate.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      if ((dsc !== null && dsc > 30) || (dsc === null) ||
          (followupDaysOverdue !== null && followupDaysOverdue > 7)) {
        items.push({ lead, section: 'overdue', days_since_contact: dsc ?? 999, urgency });
        continue;
      }

      // Follow-up today or slightly overdue (≤7 days)
      if (followupDate && followupDaysOverdue !== null && followupDaysOverdue >= 0) {
        items.push({ lead, section: 'today', days_since_contact: dsc ?? 0, urgency: 'warning' });
        continue;
      }

      // High score without recent contact
      if (lead.score >= 30 && dsc !== null && dsc > 5) {
        items.push({ lead, section: 'high_score', days_since_contact: dsc, urgency: 'ok' });
      }
    }

    // Sort within sections
    items.sort((a, b) => {
      const sectionOrder = { overdue: 0, today: 1, high_score: 2, done: 3 };
      const diff = sectionOrder[a.section] - sectionOrder[b.section];
      if (diff !== 0) return diff;
      if (a.section === 'overdue') return b.days_since_contact - a.days_since_contact;
      return b.lead.score - a.lead.score;
    });

    return items;
  }, [kanban.data]);

  const counts = useMemo(() => {
    const c = { overdue: 0, today: 0, high_score: 0, done: 0 };
    for (const item of queue) c[item.section]++;
    return c;
  }, [queue]);

  const pendingCount = counts.overdue + counts.today;

  return {
    queue,
    counts,
    pendingCount,
    loading: kanban.loading,
    error: kanban.error,
    refetch: kanban.refetch,
  };
}

// ══════════════════════════════════
// PATOLOGIAS (client-side aggregation)
// ══════════════════════════════════

export function usePatologias() {
  const kanban = useFetch<KanbanResponse>(() => api.getKanban());
  const funnel = useFetch<FunnelStat[]>(() => api.getFunnel());

  const analyses = useMemo<PathologyAnalysis[]>(() => {
    if (!kanban.data) return [];

    // Flatten all leads
    const allLeads: SurgicalLead[] = [];
    for (const leads of Object.values(kanban.data.columns)) {
      allLeads.push(...leads);
    }

    // Group by pathology (normalize)
    const groups: Record<string, SurgicalLead[]> = {};
    for (const lead of allLeads) {
      const key = lead.pathology.split('–')[0].split('-')[0].trim();
      if (!groups[key]) groups[key] = [];
      groups[key].push(lead);
    }

    return Object.entries(groups).map(([pathology, leads]): PathologyAnalysis => {
      const byStatus: Record<LeadStatus, number> = {} as any;
      for (const s of [...KANBAN_COLUMNS, 'POS_OP', 'PERDIDO'] as LeadStatus[]) {
        byStatus[s] = leads.filter((l) => l.status === s).length;
      }

      const fechou = byStatus.FECHOU || 0;
      const total = leads.length;
      const scores = leads.map((l) => l.score);
      const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      // Average days in funnel
      const daysInFunnel = leads.map((l) => daysSince(l.created_at) || 0);
      const avgDays = daysInFunnel.length
        ? Math.round(daysInFunnel.reduce((a, b) => a + b, 0) / daysInFunnel.length)
        : 0;

      // Overdue: >30 days without contact
      const overdueCount = leads.filter((l) => {
        if (l.status === 'FECHOU' || l.status === 'PERDIDO') return false;
        const ds = daysSince(l.last_contact_at);
        return ds === null || ds > 30;
      }).length;

      // Generate alerts
      const alerts: PathologyAlert[] = [];
      if (overdueCount >= 2) {
        alerts.push({
          type: 'overdue', severity: 'warning',
          message: `${overdueCount} leads sem contato há 30+ dias`,
        });
      }
      const indeciso = byStatus.INDECISO || 0;
      if (total > 2 && indeciso / total >= 0.5) {
        alerts.push({
          type: 'stuck', severity: 'danger',
          message: `${indeciso} indecisos — possível barreira sistêmica`,
        });
      }
      const convPct = total > 0 ? Math.round((fechou / total) * 100) : 0;
      if (convPct < 10 && total >= 5) {
        alerts.push({
          type: 'low_conversion', severity: 'danger',
          message: `Conversão abaixo de 10% — revisar abordagem`,
        });
      }
      if (avgScore < 20 && total >= 3) {
        alerts.push({
          type: 'low_score', severity: 'warning',
          message: `Score médio baixo — leads pouco qualificados`,
        });
      }

      return {
        pathology, total, by_status: byStatus, fechou,
        conversion_pct: convPct, avg_score: avgScore,
        avg_days_in_funnel: avgDays, overdue_count: overdueCount,
        alerts,
      };
    }).sort((a, b) => b.total - a.total);
  }, [kanban.data]);

  return {
    analyses,
    loading: kanban.loading || funnel.loading,
    error: kanban.error || funnel.error,
    refetch: () => { kanban.refetch(); funnel.refetch(); },
  };
}

// ══════════════════════════════════
// MUTATIONS
// ══════════════════════════════════

export function useMutations(onSuccess?: () => void) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrap = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      onSuccess?.();
      return result;
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading, error,
    createLead: (data: CreateLeadPayload) => wrap(() => api.createLead(data)),
    updateLead: (id: string, data: any) => wrap(() => api.updateLead(id, data)),
    changeStatus: (id: string, data: ChangeStatusPayload) => wrap(() => api.changeStatus(id, data)),
    registerContact: (leadId: string, data: RegisterContactPayload) => wrap(() => api.registerContact(leadId, data)),
    scheduleFollowup: (leadId: string, date: string) => wrap(() => api.scheduleFollowup(leadId, date)),
  };
}
