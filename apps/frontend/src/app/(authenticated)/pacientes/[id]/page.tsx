// app/(authenticated)/pacientes/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { fetchPatient, updatePatient, fetchUnits } from '@/modules/patients/api';
import PatientForm from '@/modules/patients/components/PatientForm';
import type { Patient, PatientFormData, UnitOption } from '@/modules/patients/types';

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function age(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let a = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) a--;
  return a;
}

const STATUS_COLORS: Record<string, string> = {
  PRIMEIRA: 'bg-indigo-100 text-indigo-700',
  RETORNO: 'bg-blue-100 text-blue-700',
  EXAMES: 'bg-amber-100 text-amber-700',
  ORCAMENTO: 'bg-purple-100 text-purple-700',
  FECHOU: 'bg-emerald-100 text-emerald-700',
  PERDIDO: 'bg-red-100 text-red-700',
};

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    Promise.all([fetchPatient(id), fetchUnits()])
      .then(([p, u]) => { setPatient(p); setUnits(u); })
      .catch((err) => setError(err.message || 'Erro ao carregar paciente'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdate = async (data: PatientFormData) => {
    const updated = await updatePatient(id, data);
    setPatient(updated);
    setEditing(false);
    setSaveMsg('Dados salvos com sucesso');
    setTimeout(() => setSaveMsg(''), 3000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700" />
          <span className="ml-3 text-sm text-gray-500">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-medium">Erro ao carregar paciente</p>
          <p className="text-sm mt-1">{error || 'Paciente não encontrado'}</p>
          <button
            onClick={() => router.push('/pacientes')}
            className="mt-3 text-sm underline"
          >
            ← Voltar para lista
          </button>
        </div>
      </div>
    );
  }

  const formInitial: Partial<PatientFormData> = {
    name: patient.name,
    cpf: patient.cpf,
    rg: patient.rg || '',
    dob: patient.dob?.split('T')[0] || '',
    phone: patient.phone || '',
    email: patient.email || '',
    address: patient.address || '',
    source_channel: patient.source_channel || '',
    notes: patient.notes || '',
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/pacientes')}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
          >
            ← Pacientes
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500 font-mono">{patient.cpf}</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">{age(patient.dob)} anos</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-xs text-gray-400 mr-1">Origem:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
              {patient.unit?.name}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            editing
              ? 'text-gray-700 bg-gray-100 hover:bg-gray-200'
              : 'text-white bg-slate-800 hover:bg-slate-700'
          }`}
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {/* Save success */}
      {saveMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-md text-sm mb-4">
          {saveMsg}
        </div>
      )}

      {editing ? (
        /* ── Edit Mode ── */
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <PatientForm
            initial={formInitial}
            units={units}
            selectedUnitId={patient.origin_unit_id}
            onSubmit={handleUpdate}
            submitLabel="Salvar Alterações"
            showUnitSelector={false}
          />
        </div>
      ) : (
        /* ── View Mode ── */
        <div className="space-y-4">
          {/* Info Card */}
          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Dados Pessoais</h2>
            </div>
            <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
              <InfoRow label="Nome" value={patient.name} />
              <InfoRow label="CPF" value={patient.cpf} mono />
              <InfoRow label="RG" value={patient.rg} />
              <InfoRow label="Data Nasc." value={`${fmtDate(patient.dob)} (${age(patient.dob)} anos)`} />
              <InfoRow label="Telefone" value={patient.phone} />
              <InfoRow label="E-mail" value={patient.email} />
              <InfoRow label="Endereço" value={patient.address} span2 />
              {patient.source_channel && (
                <InfoRow label="Como Conheceu" value={patient.source_channel} />
              )}
              {patient.prontuario_code && (
                <InfoRow label="Prontuário" value={patient.prontuario_code} mono />
              )}
            </div>
          </div>

          {/* Notes */}
          {patient.notes && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Observações</h2>
              </div>
              <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-wrap">
                {patient.notes}
              </div>
            </div>
          )}

          {/* Surgical Leads */}
          {patient.surgical_leads && patient.surgical_leads.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">
                  Leads Cirúrgicos ({patient.surgical_leads.length})
                </h2>
              </div>
              <div className="divide-y divide-gray-50">
                {patient.surgical_leads.map((lead) => (
                  <div key={lead.id} className="px-6 py-3 flex items-center gap-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-700'
                    }`}>
                      {lead.status}
                    </span>
                    <span className="text-sm text-gray-700">{lead.pathology}</span>
                    <span className="text-xs text-gray-400 ml-auto">{fmtDate(lead.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="text-xs text-gray-400 flex gap-4 px-1">
            <span>Criado em {fmtDate(patient.created_at)}</span>
            <span>Atualizado em {fmtDate(patient.updated_at)}</span>
            <span className="font-mono">{patient.id}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono, span2 }: {
  label: string; value: string | null; mono?: boolean; span2?: boolean;
}) {
  return (
    <div className={span2 ? 'md:col-span-2' : ''}>
      <dt className="text-xs text-gray-400 uppercase tracking-wider">{label}</dt>
      <dd className={`text-sm mt-0.5 ${value ? 'text-gray-900' : 'text-gray-300'} ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}
