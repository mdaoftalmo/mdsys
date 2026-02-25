// apps/frontend/src/app/(authenticated)/dashboards/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

interface DashboardData {
  finance: {
    payables_pending: { count: number; value: number };
    receivables_pending: { count: number; value: number };
    sales_this_month: { count: number; value: number };
  };
  stock: { critical_items: number };
  surgical: { overdue_followups: number };
  rh: { active_employees: number };
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    api.get<DashboardData>('/bi/dashboard')
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Carregando dashboard...</div>;
  if (!data) return <div className="text-red-500">Erro ao carregar dashboard</div>;

  const balance = Number(data.finance.receivables_pending.value) - Number(data.finance.payables_pending.value);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Vendas do Mês"
          value={fmt(Number(data.finance.sales_this_month.value))}
          subtext={`${data.finance.sales_this_month.count} vendas`}
          color="bg-green-50 text-green-700"
        />
        <KpiCard
          label="A Receber (Previsto)"
          value={fmt(Number(data.finance.receivables_pending.value))}
          subtext={`${data.finance.receivables_pending.count} títulos`}
          color="bg-blue-50 text-blue-700"
        />
        <KpiCard
          label="A Pagar (Pendente)"
          value={fmt(Number(data.finance.payables_pending.value))}
          subtext={`${data.finance.payables_pending.count} contas`}
          color="bg-orange-50 text-orange-700"
        />
        <KpiCard
          label="Saldo Projetado"
          value={fmt(balance)}
          subtext={balance >= 0 ? 'Positivo' : 'Negativo'}
          color={balance >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          icon="📦"
          label="Estoque Crítico"
          value={data.stock.critical_items}
          unit="itens"
          alert={data.stock.critical_items > 0}
        />
        <MetricCard
          icon="📞"
          label="Follow-ups Pendentes"
          value={data.surgical.overdue_followups}
          unit="leads"
          alert={data.surgical.overdue_followups > 5}
        />
        <MetricCard
          icon="👥"
          label="Colaboradores Ativos"
          value={data.rh.active_employees}
          unit="pessoas"
          alert={false}
        />
      </div>

      {/* Quick Links */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Ações Rápidas</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <QuickLink href="/financeiro" label="Ver Contas a Pagar" icon="💰" />
          <QuickLink href="/orientacao-cirurgica" label="Pipeline Cirúrgico" icon="🏥" />
          <QuickLink href="/estoque/criticos" label="Estoque Crítico" icon="📦" />
          <QuickLink href="/rh/colaboradores" label="Colaboradores" icon="👥" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, subtext, color }: {
  label: string; value: string; subtext: string; color: string;
}) {
  return (
    <div className={`rounded-xl p-5 ${color}`}>
      <div className="text-sm font-medium opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs opacity-60 mt-1">{subtext}</div>
    </div>
  );
}

function MetricCard({ icon, label, value, unit, alert }: {
  icon: string; label: string; value: number; unit: string; alert: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border p-5 ${alert ? 'border-red-200' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-xl font-bold">
            {value} <span className="text-sm font-normal text-gray-400">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm transition-colors"
    >
      <span>{icon}</span> {label}
    </a>
  );
}
