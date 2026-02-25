// apps/frontend/src/app/(authenticated)/rh/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatBRL, formatDate, daysFromNow } from '@/hooks/use-api';

interface Employee {
  id: string;
  name: string;
  cpf: string;
  role: string;
  department: string;
  type: 'CLT' | 'PJ' | 'AUTONOMO';
  status: 'ATIVO' | 'FERIAS' | 'AFASTADO' | 'DESLIGADO';
  salary: number;
  admission_date: string;
  unit: { name: string };
}

interface ExpiringDoc {
  id: string;
  type: string;
  number: string | null;
  expires_at: string;
  employee: { name: string; role: string };
}

interface PayrollSummary {
  total_employees: number;
  total_payroll: number;
  by_type: Record<string, { count: number; total: number }>;
  by_department: Record<string, { count: number; total: number }>;
}

type Tab = 'employees' | 'documents' | 'payroll';

const TYPE_BADGE: Record<string, string> = {
  CLT: 'bg-blue-100 text-blue-800',
  PJ: 'bg-purple-100 text-purple-800',
  AUTONOMO: 'bg-gray-100 text-gray-800',
};

const STATUS_BADGE: Record<string, string> = {
  ATIVO: 'bg-green-100 text-green-800',
  FERIAS: 'bg-yellow-100 text-yellow-800',
  AFASTADO: 'bg-orange-100 text-orange-800',
  DESLIGADO: 'bg-red-100 text-red-800',
};

export default function RhPage() {
  const [tab, setTab] = useState<Tab>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDoc[]>([]);
  const [payroll, setPayroll] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);
  const unitParam = user?.unit_id ? `?unit_id=${user.unit_id}` : '?unit_id=';

  useEffect(() => {
    setLoading(true);
    const p: Promise<any>[] = [];

    if (tab === 'employees') {
      p.push(api.get<Employee[]>(`/rh/employees${unitParam}`).then(setEmployees));
    } else if (tab === 'documents') {
      p.push(api.get<ExpiringDoc[]>(`/rh/documents/expiring${unitParam}&days=60`).then(setExpiringDocs));
    } else if (tab === 'payroll') {
      p.push(api.get<PayrollSummary>(`/rh/payroll-summary${unitParam}`).then(setPayroll));
    }

    Promise.all(p).catch(console.error).finally(() => setLoading(false));
  }, [tab, unitParam]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'employees', label: 'Colaboradores' },
    { key: 'documents', label: 'Documentos Vencendo' },
    { key: 'payroll', label: 'Resumo Folha' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Recursos Humanos</h1>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-500">Carregando...</div>}

      {/* ── Colaboradores ── */}
      {!loading && tab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cargo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Departamento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Salário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Admissão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.role}</td>
                  <td className="px-4 py-3 text-gray-600">{e.department}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[e.type]}`}>{e.type}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[e.status]}`}>{e.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{formatBRL(e.salary)}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.admission_date)}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum colaborador</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Documentos Vencendo ── */}
      {!loading && tab === 'documents' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Colaborador</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cargo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Número</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Vencimento</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Urgência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expiringDocs.map((d) => {
                const days = daysFromNow(d.expires_at);
                const isExpired = days !== null && days < 0;
                const isUrgent = days !== null && days <= 15;
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.employee.name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.employee.role}</td>
                    <td className="px-4 py-3 font-medium">{d.type}</td>
                    <td className="px-4 py-3 text-gray-500">{d.number || '—'}</td>
                    <td className={`px-4 py-3 ${isExpired ? 'text-red-600 font-medium' : ''}`}>
                      {formatDate(d.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        isExpired ? 'bg-red-100 text-red-800' :
                        isUrgent ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {isExpired ? `Vencido ${Math.abs(days!)}d` : `${days}d`}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {expiringDocs.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum documento vencendo</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Resumo Folha ── */}
      {!loading && tab === 'payroll' && payroll && (
        <div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-6">
              <div className="text-sm text-blue-700 font-medium">Total Colaboradores</div>
              <div className="text-3xl font-bold text-blue-800 mt-2">{payroll.total_employees}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-6">
              <div className="text-sm text-green-700 font-medium">Folha Mensal</div>
              <div className="text-3xl font-bold text-green-800 mt-2">{formatBRL(payroll.total_payroll)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* By Type */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold mb-4">Por Tipo</h3>
              {Object.entries(payroll.by_type).map(([type, data]) => (
                <div key={type} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium">{type}</span>
                  <span className="text-gray-600">{data.count} pessoas · {formatBRL(data.total)}</span>
                </div>
              ))}
            </div>

            {/* By Department */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-semibold mb-4">Por Departamento</h3>
              {Object.entries(payroll.by_department).map(([dept, data]) => (
                <div key={dept} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="font-medium">{dept}</span>
                  <span className="text-gray-600">{data.count} · {formatBRL(data.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
