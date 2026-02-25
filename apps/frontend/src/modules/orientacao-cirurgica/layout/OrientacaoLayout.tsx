'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';

const TABS = [
  { href: '/orientacao-cirurgica',         label: '🏥 Board',         key: 'board' },
  { href: '/orientacao-cirurgica/fila-do-dia', label: '📞 Fila do Dia', key: 'fila' },
  { href: '/orientacao-cirurgica/patologias',  label: '🔬 Patologias',  key: 'patologias' },
] as const;

interface Props {
  children: ReactNode;
  filaPendingCount?: number;
}

export function OrientacaoLayout({ children, filaPendingCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === '/orientacao-cirurgica') return pathname === href;
    return pathname?.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Page header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <h1 className="text-lg font-bold text-slate-800 tracking-tight">
              Orientação Cirúrgica
            </h1>
          </div>

          {/* Tabs */}
          <nav className="flex gap-0.5 -mb-px">
            {TABS.map((tab) => {
              const active = isActive(tab.href);
              return (
                <button
                  key={tab.key}
                  onClick={() => router.push(tab.href)}
                  className={`relative px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                    active
                      ? 'text-indigo-700 border-indigo-600'
                      : 'text-slate-500 border-transparent hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                  {tab.key === 'fila' && filaPendingCount !== undefined && filaPendingCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold bg-red-500 text-white rounded-full">
                      {filaPendingCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        {children}
      </main>
    </div>
  );
}
