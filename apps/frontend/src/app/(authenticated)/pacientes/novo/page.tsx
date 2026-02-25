// app/(authenticated)/pacientes/novo/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPatient, fetchUnits } from '@/modules/patients/api';
import PatientForm from '@/modules/patients/components/PatientForm';
import type { PatientFormData, UnitOption } from '@/modules/patients/types';

export default function NovoPacientePage() {
  const router = useRouter();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnits()
      .then((u) => { setUnits(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSubmit = async (data: PatientFormData, unitId: string) => {
    const patient = await createPatient(unitId, data);
    router.push(`/pacientes/${patient.id}`);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700" />
          <span className="ml-3 text-sm text-gray-500">Carregando...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-block"
        >
          ← Voltar
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Novo Paciente</h1>
        <p className="text-sm text-gray-500 mt-1">Preencha os dados para cadastrar um paciente.</p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <PatientForm
          units={units}
          onSubmit={handleSubmit}
          submitLabel="Cadastrar Paciente"
          showUnitSelector={true}
        />
      </div>
    </div>
  );
}
