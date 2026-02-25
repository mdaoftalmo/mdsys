'use client';

import { useState, useEffect } from 'react';
import type { SurgicalLead, LeadStatus, RegisterContactPayload } from '../types';
import { useLeadDetail, useMutations } from '../hooks';
import { STATUS_CONFIG, formatDateBR, formatRelativeDate, daysSince, getScoreColor } from '../constants';
import { ScoreBadge } from './ScoreBadge';
import { Timeline } from './Timeline';
import { ContactModal } from './ContactModal';
import { LostReasonModal } from './LostReasonModal';
import { Toast } from './EmptyState';

interface Props {
  leadId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function LeadDrawer({ leadId, onClose, onRefresh }: Props) {
  const { data: lead, loading, error, refetch } = useLeadDetail(leadId);
  const mutations = useMutations(() => { refetch(); onRefresh(); });

  const [showContactModal, setShowContactModal] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Sync notes when lead loads
  useEffect(() => {
    if (lead?.notes) setNotesValue(lead.notes);
  }, [lead?.notes]);

  // Close with ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!leadId) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleStatusChange = async (newStatus: LeadStatus) => {
    if (!lead) return;
    if (newStatus === 'PERDIDO') {
      setShowLostModal(true);
      return;
    }
    await mutations.changeStatus(lead.id, { status: newStatus });
    showToast(`${lead.name} movido para ${STATUS_CONFIG[newStatus].label}`);
  };

  const handleLostConfirm = async (reason: string) => {
    if (!lead) return;
    await mutations.changeStatus(lead.id, { status: 'PERDIDO', lost_reason: reason });
    setShowLostModal(false);
    showToast(`${lead.name} marcado como Perdido`);
  };

  const handleContact = async (data: RegisterContactPayload & { next_followup?: string }) => {
    if (!lead) return;
    const { next_followup, ...contactData } = data;
    await mutations.registerContact(lead.id, contactData);
    if (next_followup) {
      await mutations.scheduleFollowup(lead.id, next_followup);
    }
    setShowContactModal(false);
    showToast(`Contato com ${lead.name} registrado`);
  };

  const handleSaveNotes = async () => {
    if (!lead) return;
    await mutations.updateLead(lead.id, { notes: notesValue });
    setEditingNotes(false);
    showToast('Observações salvas');
  };

  const handleReschedule = async () => {
    if (!lead) return;
    // Quick reschedule +7 days
    const d = new Date();
    d.setDate(d.getDate() + 7);
    await mutations.scheduleFollowup(lead.id, d.toISOString().slice(0, 10));
    showToast('Follow-up reagendado para +7 dias');
  };

  // Score breakdown — use score_factors_json if available, else compute client-side
  const scoreBreakdown = lead ? (() => {
    const f = lead.score_factors_json;
    if (f) {
      return [
        { label: `Interesse (${lead.interest || '—'})`, value: f.interest },
        { label: `Prazo (${lead.desired_timeframe || '—'})`, value: f.timeframe },
        { label: lead.had_return ? 'Fez retorno' : 'Sem retorno', value: f.had_return },
        { label: 'Contato recente', value: f.contact_recency },
        { label: lead.has_insurance ? `Convênio (${lead.insurance_name || 'Sim'})` : 'Sem convênio', value: f.insurance },
        ...(f.barriers_price !== 0 ? [{ label: 'Barreira: Preço', value: f.barriers_price }] : []),
        ...(f.barriers_fear !== 0 ? [{ label: 'Barreira: Medo', value: f.barriers_fear }] : []),
        ...(f.barriers_other !== 0 ? [{ label: 'Outras barreiras', value: f.barriers_other }] : []),
      ].filter((item) => item.value !== 0);
    }
    // Fallback: client-side estimate (old format, no had_return/recency)
    return [
      { label: `Interesse (${lead.interest || '—'})`, value: lead.interest === 'alto' ? 25 : lead.interest === 'medio' ? 15 : lead.interest === 'baixo' ? 5 : 0 },
      { label: lead.has_insurance ? `Convênio (${lead.insurance_name || 'Sim'})` : 'Sem convênio', value: lead.has_insurance ? 10 : 0 },
      { label: `Prazo (${lead.desired_timeframe || '—'})`, value: lead.desired_timeframe === '0-30' ? 20 : lead.desired_timeframe === '30-60' ? 10 : 0 },
      { label: `Barreiras (${lead.barriers?.length || 0})`, value: lead.barriers?.some((b) => b.toLowerCase().includes('preç')) ? -15 : 0 },
    ].filter((item) => item.value !== 0);
  })() : [];

  // Follow-up info
  const followupDays = lead?.next_followup ? daysSince(lead.next_followup) : null;
  const followupOverdue = followupDays !== null && followupDays > 0;

  const isTerminal = lead?.status === 'FECHOU' || lead?.status === 'PERDIDO';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 z-40 h-full w-full max-w-[440px] bg-white shadow-2xl border-l border-slate-200 overflow-y-auto animate-slide-left">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && (
          <div className="p-6">
            <p className="text-red-600 text-sm mb-3">{error}</p>
            <button onClick={refetch} className="text-indigo-600 text-sm font-medium underline">
              Tentar novamente
            </button>
          </div>
        )}

        {lead && !loading && (
          <div className="flex flex-col">
            {/* ── HEADER ── */}
            <div className={`px-5 pt-5 pb-4 ${
              lead.status === 'FECHOU' ? 'bg-emerald-50' :
              lead.status === 'PERDIDO' ? 'bg-red-50' : 'bg-slate-50'
            }`}>
              {/* Top bar */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
                >
                  ← Voltar
                </button>
              </div>

              {/* Name + Score */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-slate-800 leading-tight mb-1">
                    {lead.name}
                  </h2>
                  <p className="text-sm text-slate-500">{lead.pathology}</p>
                </div>
                <ScoreBadge score={lead.score} size="lg" />
              </div>

              {/* Status dropdown */}
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs font-semibold text-slate-500">Status:</label>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  disabled={mutations.loading}
                  className={`px-3 py-1.5 text-sm font-semibold rounded-lg border ${STATUS_CONFIG[lead.status].color} ${STATUS_CONFIG[lead.status].text} border-current/20 focus:outline-none`}
                >
                  {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Lost reason */}
              {lead.status === 'PERDIDO' && lead.lost_reason && (
                <p className="text-xs text-red-600 bg-red-100 rounded-lg px-3 py-2 mb-3">
                  Motivo: {lead.lost_reason}
                </p>
              )}

              {/* Quick action buttons */}
              <div className="flex gap-2">
                <a
                  href={`tel:${lead.phone}`}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  📞 Ligar
                </a>
                <a
                  href={`https://wa.me/55${lead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  💬 WhatsApp
                </a>
                <button
                  onClick={() => setShowContactModal(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-600 rounded-xl text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                >
                  📝 Registrar
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* ── DADOS DO PACIENTE ── */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Dados do Paciente
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                  <div>
                    <span className="text-slate-400 text-xs">Telefone</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 font-medium">{lead.phone}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(lead.phone)}
                        className="text-slate-400 hover:text-indigo-600 text-xs"
                        title="Copiar"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Email</span>
                    <p className="text-slate-700">{lead.email || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">CPF</span>
                    <p className="text-slate-700">{lead.cpf || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Convênio</span>
                    <p className={lead.has_insurance ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                      {lead.has_insurance ? `🟢 ${lead.insurance_name}` : 'Particular'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Olho</span>
                    <p className="text-slate-700">{lead.eye || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Procedimento</span>
                    <p className="text-slate-700">{lead.procedure || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Interesse</span>
                    <p className="text-slate-700 capitalize">{lead.interest || '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Prazo</span>
                    <p className="text-slate-700">{lead.desired_timeframe ? `${lead.desired_timeframe} dias` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Barreiras</span>
                    <p className={`${(lead.barriers?.length || 0) >= 3 ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
                      {lead.barriers?.length ? lead.barriers.join(', ') : 'Nenhuma'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Indicação</span>
                    <p className="text-slate-700">{formatDateBR(lead.indication_date)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 text-xs">Responsável</span>
                    <p className="text-slate-700">{lead.responsavel || '—'}</p>
                  </div>
                </div>
              </section>

              {/* ── SCORE DETALHADO ── */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Score Detalhado
                </h3>
                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-500">0</span>
                    <span className="font-bold text-slate-700">{lead.score}/100</span>
                    <span className="text-slate-500">50</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getScoreColor(lead.score).split(' ')[0]}`}
                      style={{ width: `${lead.score}%` }}
                    />
                  </div>
                </div>
                {/* Breakdown */}
                <div className="space-y-1">
                  {scoreBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{item.label}</span>
                      <span className={`font-semibold ${item.value > 0 ? 'text-emerald-600' : item.value < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {item.value > 0 ? '+' : ''}{item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── FOLLOW-UP ── */}
              {!isTerminal && (
                <section>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Próximo Follow-up
                  </h3>
                  {lead.next_followup ? (
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${
                      followupOverdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div>
                        <span className={`text-sm font-semibold ${followupOverdue ? 'text-red-700' : 'text-slate-700'}`}>
                          📅 {formatDateBR(lead.next_followup)}
                        </span>
                        {followupOverdue && (
                          <span className="ml-2 text-xs text-red-500 font-medium">
                            ⚠ Vencido há {followupDays} dias
                          </span>
                        )}
                        {!followupOverdue && followupDays !== null && (
                          <span className="ml-2 text-xs text-slate-500">
                            (em {Math.abs(followupDays)} dias)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={handleReschedule}
                        className="text-xs text-indigo-600 font-medium hover:text-indigo-800"
                      >
                        Reagendar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleReschedule}
                      className="w-full py-2.5 text-sm text-indigo-600 font-medium border border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition-colors"
                    >
                      + Agendar follow-up
                    </button>
                  )}
                </section>
              )}

              {/* ── TIMELINE ── */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Timeline de Contatos
                </h3>
                <Timeline
                  contacts={lead.contacts || []}
                  createdAt={lead.created_at}
                  onRegisterContact={() => setShowContactModal(true)}
                />
              </section>

              {/* ── OBSERVAÇÕES ── */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Observações
                </h3>
                {editingNotes ? (
                  <div>
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2">
                      <button onClick={handleSaveNotes} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        Salvar
                      </button>
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingNotes(true)}
                    className="p-3 bg-slate-50 rounded-xl text-sm text-slate-600 cursor-pointer hover:bg-slate-100 transition-colors min-h-[60px]"
                  >
                    {lead.notes || <span className="text-slate-400 italic">Clique para adicionar observações...</span>}
                  </div>
                )}
              </section>

              {/* ── AÇÕES ── */}
              <section className="pb-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Ações
                </h3>
                <div className="space-y-2">
                  {!isTerminal && (
                    <>
                      <button
                        onClick={() => setShowContactModal(true)}
                        className="w-full py-2.5 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        📞 Registrar Contato
                      </button>
                      <button
                        onClick={() => handleStatusChange('FECHOU')}
                        className="w-full py-2.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-xl hover:bg-emerald-100 transition-colors"
                      >
                        ✅ Marcar como Fechou
                      </button>
                      <button
                        onClick={() => setShowLostModal(true)}
                        className="w-full py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors"
                      >
                        ❌ Marcar como Perdido
                      </button>
                    </>
                  )}
                  {isTerminal && (
                    <button
                      onClick={() => handleStatusChange('PRIMEIRA')}
                      className="w-full py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      🔄 Reabrir Lead
                    </button>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showContactModal && lead && (
        <ContactModal
          leadName={lead.name}
          onSubmit={handleContact}
          onClose={() => setShowContactModal(false)}
          loading={mutations.loading}
        />
      )}
      {showLostModal && lead && (
        <LostReasonModal
          leadName={lead.name}
          onConfirm={handleLostConfirm}
          onClose={() => setShowLostModal(false)}
          loading={mutations.loading}
        />
      )}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}
