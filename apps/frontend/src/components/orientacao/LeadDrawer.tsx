'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/hooks/use-api';
import type { SurgicalLead, LeadStatus, LeadContact, RegisterContactDto, ChangeStatusDto } from '@/types/orientacao';
import {
  LEAD_STATUS_CONFIG, COLUMN_ORDER,
  daysSince, daysUntil, contactUrgencyClass, scoreBadgeClass,
} from '@/types/orientacao';
import ScoreBadge from './ScoreBadge';
import Timeline from './Timeline';
import ContactModal from './ContactModal';
import LostReasonModal from './LostReasonModal';

interface LeadDrawerProps {
  leadId: string;
  unitId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function LeadDrawer({ leadId, unitId, onClose, onUpdate }: LeadDrawerProps) {
  const [lead, setLead] = useState<SurgicalLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SurgicalLead>(`/orientacao-cirurgica/${leadId}?unit_id=${unitId}`);
      setLead(res);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar lead');
    } finally {
      setLoading(false);
    }
  }, [leadId, unitId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  // ── Actions ──

  async function handleStatusChange(newStatus: LeadStatus) {
    if (newStatus === 'PERDIDO') { setShowLostModal(true); return; }
    await api.patch(`/orientacao-cirurgica/${leadId}/status?unit_id=${unitId}`, { status: newStatus });
    fetchLead();
    onUpdate();
  }

  async function handleLostConfirm(reason: string) {
    await api.patch(`/orientacao-cirurgica/${leadId}/status?unit_id=${unitId}`, { status: 'PERDIDO', lost_reason: reason });
    setShowLostModal(false);
    fetchLead();
    onUpdate();
  }

  async function handleContactSave(dto: RegisterContactDto & { next_followup?: string }) {
    const { next_followup, ...contactDto } = dto;
    await api.post(`/orientacao-cirurgica/${leadId}/contacts?unit_id=${unitId}`, contactDto);
    if (next_followup) {
      await api.patch(`/orientacao-cirurgica/${leadId}/followup?unit_id=${unitId}`, { date: next_followup });
    }
    setShowContact(false);
    fetchLead();
    onUpdate();
  }

  async function handleFollowupReschedule(date: string) {
    await api.patch(`/orientacao-cirurgica/${leadId}/followup?unit_id=${unitId}`, { date });
    fetchLead();
    onUpdate();
  }

  function copyPhone() {
    if (lead?.phone) navigator.clipboard.writeText(lead.phone.replace(/\D/g, ''));
  }

  // ── Render ──

  const isClosed = lead?.status === 'FECHOU';
  const isLost = lead?.status === 'PERDIDO';
  const sinceContact = daysSince(lead?.last_contact_at);
  const followupDays = daysUntil(lead?.next_followup);
  const followupOverdue = followupDays !== null && followupDays < 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-[440px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className={`shrink-0 px-5 pt-4 pb-3 border-b ${isClosed ? 'bg-green-50 border-green-200' : isLost ? 'bg-red-50 border-red-100' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800 font-medium">&larr; Voltar</button>
          </div>

          {loading ? (
            <div className="h-16 animate-pulse bg-gray-200 rounded-lg" />
          ) : lead ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{lead.name}</h2>
                  <p className="text-sm text-gray-500">{lead.pathology}</p>
                </div>
                <ScoreBadge score={lead.score} size="md" />
              </div>

              {/* Status selector */}
              <div className="mt-3 flex items-center gap-2">
                <label className="text-xs text-gray-500">Status:</label>
                <select
                  value={lead.status}
                  onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
                  className="text-sm font-semibold border rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500/30"
                  style={{ color: LEAD_STATUS_CONFIG[lead.status].color, borderColor: LEAD_STATUS_CONFIG[lead.status].borderColor }}
                >
                  {COLUMN_ORDER.map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>

              {isLost && lead.lost_reason && (
                <p className="text-xs text-red-600 mt-1">Motivo: {lead.lost_reason}</p>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 mt-3">
                <a href={`tel:${lead.phone?.replace(/\D/g, '')}`} className="flex-1 py-2 text-center text-sm font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors">
                  📞 Ligar
                </a>
                <a href={`https://wa.me/55${lead.phone?.replace(/\D/g, '')}`} target="_blank" rel="noopener" className="flex-1 py-2 text-center text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                  📱 WhatsApp
                </a>
                <button onClick={() => setShowContact(true)} className="flex-1 py-2 text-center text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                  📅 Contato
                </button>
              </div>
            </>
          ) : null}
        </div>

        {/* Body - scrollable */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="m-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error} <button onClick={fetchLead} className="underline ml-2">Tentar novamente</button>
            </div>
          )}

          {lead && !loading && (
            <div className="px-5 py-4 space-y-5">
              {/* Patient data */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Dados do Paciente</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <span className="text-gray-400 text-xs">Telefone</span>
                    <p className="text-gray-800 font-medium flex items-center gap-1">
                      {lead.phone}
                      <button onClick={copyPhone} title="Copiar" className="text-gray-400 hover:text-gray-600 text-xs">📋</button>
                    </p>
                  </div>
                  {lead.email && (
                    <div>
                      <span className="text-gray-400 text-xs">Email</span>
                      <p className="text-gray-700">{lead.email}</p>
                    </div>
                  )}
                  {lead.cpf && (
                    <div>
                      <span className="text-gray-400 text-xs">CPF</span>
                      <p className="text-gray-700">{lead.cpf}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 text-xs">Convênio</span>
                    <p className="text-gray-700">
                      {lead.has_insurance ? (
                        <><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />{lead.insurance_name}</>
                      ) : 'Particular'}
                    </p>
                  </div>
                  {lead.eye && (
                    <div>
                      <span className="text-gray-400 text-xs">Olho</span>
                      <p className="text-gray-700">{lead.eye}</p>
                    </div>
                  )}
                  {lead.procedure && (
                    <div>
                      <span className="text-gray-400 text-xs">Procedimento</span>
                      <p className="text-gray-700">{lead.procedure}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 text-xs">Interesse</span>
                    <p className="text-gray-700 capitalize">{lead.interest || '—'}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Prazo desejado</span>
                    <p className="text-gray-700">{lead.desired_timeframe ? `${lead.desired_timeframe} dias` : '—'}</p>
                  </div>
                  {lead.barriers && lead.barriers.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-400 text-xs">Barreiras</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {lead.barriers.map((b) => (
                          <span key={b} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{b}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 text-xs">Indicação</span>
                    <p className="text-gray-700">{formatDate(lead.indication_date)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Responsável</span>
                    <p className="text-gray-700">{lead.responsavel || '—'}</p>
                  </div>
                </div>
              </section>

              {/* Score breakdown */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Score Detalhado</h4>
                <div className="bg-gray-50 rounded-xl p-3">
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-gray-200 rounded-full mb-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${lead.score >= 35 ? 'bg-green-500' : lead.score >= 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${(lead.score / 50) * 100}%` }} />
                  </div>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>Interesse ({lead.interest || 'n/a'})</span>
                      <span className="font-medium">+{{ alto: 15, medio: 10, baixo: 5 }[lead.interest || ''] || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Convênio</span>
                      <span className="font-medium">{lead.has_insurance ? '+10' : '+0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Prazo ({lead.desired_timeframe || 'n/a'})</span>
                      <span className="font-medium">+{{ '0-30': 15, '30-60': 10, '60+': 5 }[lead.desired_timeframe || ''] || 0}</span>
                    </div>
                    {lead.barriers && lead.barriers.length > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>{lead.barriers.length} barreira(s)</span>
                        <span className="font-medium">-{lead.barriers.length * 2}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold text-gray-800">
                      <span>Total</span>
                      <span>{lead.score}/50</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Follow-up */}
              {!isClosed && !isLost && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Próximo Follow-up</h4>
                  <div className={`rounded-xl p-3 border ${followupOverdue ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                    {lead.next_followup ? (
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${followupOverdue ? 'text-red-700' : 'text-gray-700'}`}>
                          📅 {formatDate(lead.next_followup)}
                          {followupOverdue
                            ? ` (vencido ${Math.abs(followupDays!)}d)`
                            : followupDays === 0 ? ' (HOJE!)' : ` (em ${followupDays}d)`
                          }
                        </span>
                        <input
                          type="date"
                          onChange={(e) => { if (e.target.value) handleFollowupReschedule(e.target.value); }}
                          className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                          title="Reagendar"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400 italic">Nenhum follow-up agendado</span>
                        <input
                          type="date"
                          onChange={(e) => { if (e.target.value) handleFollowupReschedule(e.target.value); }}
                          className="text-xs border border-gray-300 rounded px-2 py-1 outline-none"
                          title="Agendar"
                        />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Timeline */}
              <section>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Timeline ({lead.contacts?.length || 0} contatos)
                </h4>
                <Timeline contacts={lead.contacts || []} indicationDate={lead.indication_date} />
              </section>

              {/* Notes */}
              {lead.notes && (
                <section>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Observações</h4>
                  <p className="text-sm text-gray-600 bg-yellow-50 border border-yellow-200 rounded-xl p-3 italic">
                    {lead.notes}
                  </p>
                </section>
              )}

              {/* Action buttons */}
              <section className="space-y-2 pb-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Ações</h4>
                <button
                  onClick={() => setShowContact(true)}
                  className="w-full py-2.5 text-sm font-semibold bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                >
                  📞 Registrar Contato
                </button>
                {!isClosed && !isLost && (
                  <div className="flex gap-2">
                    <button onClick={() => handleStatusChange('FECHOU')}
                      className="flex-1 py-2.5 text-sm font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                      ✅ Fechou
                    </button>
                    <button onClick={() => setShowLostModal(true)}
                      className="flex-1 py-2.5 text-sm font-semibold bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors">
                      ❌ Perdido
                    </button>
                  </div>
                )}
                {(isClosed || isLost) && (
                  <button onClick={() => handleStatusChange('PRIMEIRA')}
                    className="w-full py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    Reabrir lead
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showContact && lead && (
        <ContactModal
          leadName={lead.name}
          defaultContactedBy={lead.responsavel}
          onSave={handleContactSave}
          onClose={() => setShowContact(false)}
        />
      )}
      {showLostModal && lead && (
        <LostReasonModal
          leadName={lead.name}
          onConfirm={handleLostConfirm}
          onClose={() => setShowLostModal(false)}
        />
      )}
    </>
  );
}
