// app/(authenticated)/financeiro/page.tsx
// ═══════════════════════════════════════════════════════════
// Executive Finance Module — Shell + 5 Tabs
// Threads: filters, units list, unitRequired flag
// ═══════════════════════════════════════════════════════════
'use client';

import FinanceShell from '@/modules/financeiro/components/FinanceShell';
import { useFinanceFilters } from '@/modules/financeiro/hooks';
import { DashboardTab, PayablesTab, ReceivablesTab, DreTab, CashFlowTab } from '@/modules/financeiro/tabs';

export default function FinanceiroPage() {
  const {
    filters, updateFilter, activeTab, setActiveTab,
    units, unitsLoading, unitRequired,
  } = useFinanceFilters();

  return (
    <FinanceShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      filters={filters}
      onFilterUpdate={updateFilter}
      units={units}
      unitsLoading={unitsLoading}
    >
      {activeTab === 'dashboard' && <DashboardTab filters={filters} unitRequired={unitRequired} />}
      {activeTab === 'pagar'     && <PayablesTab filters={filters} unitRequired={unitRequired} />}
      {activeTab === 'receber'   && <ReceivablesTab filters={filters} unitRequired={unitRequired} />}
      {activeTab === 'dre'       && <DreTab filters={filters} />}
      {activeTab === 'caixa'     && <CashFlowTab filters={filters} />}
    </FinanceShell>
  );
}
