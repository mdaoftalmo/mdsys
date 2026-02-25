'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useApi } from '@/hooks/use-api';
import { useAuthStore } from '@/lib/auth-store';

const BASE = '/orientacao-cirurgica';

interface OverdueCount {
  count: number;
}

export default function OrientacaoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const unitParam = user?.unit_id ? `unit_id=${user.unit_id}` : '';

  // Badge count for "Fila do Dia"
  const { data: overdue } = useApi<OverdueCount>(
    `/orientacao-cirurgica/overdue-count?${unitParam}`,
    [user?.unit_id],
  );

  const tabs = [
    {
      label: 'Board',
      href: BASE,
      icon: '🏥',
      active: pathname === BASE,
    },
    {
      label: 'Fila do Dia',
      href: `${BASE}/fila-do-dia`,
      icon: '📞',
      badge: overdue?.count ?? null,
      active: pathname === `${BASE}/fila-do-dia`,
    },
    {
      label: 'Patologias',
      href: `${BASE}/patologias`,
      icon: '🔬',
      active: pathname === `${BASE}/patologias`,
    },
  ];

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Module header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">Orientação Cirúrgica</h1>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-gray-200">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab.active
                  ? 'text-brand-700 after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-brand-600 after:rounded-full'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-red-500 text-white rounded-full">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 overflow-hidden mt-4">
        {children}
      </div>
    </div>
  );
}
