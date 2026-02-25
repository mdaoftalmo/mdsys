// apps/frontend/src/app/(authenticated)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import Link from 'next/link';

const NAV_ITEMS = [
  { label: 'Dashboards', href: '/dashboards', icon: '📊', roles: ['FULL', 'FINANCEIRO'] },
  { label: 'Financeiro', href: '/financeiro', icon: '💰', roles: ['FULL', 'FINANCEIRO'] },
  { label: 'Estoque', href: '/estoque', icon: '📦', roles: ['FULL', 'FINANCEIRO', 'SECRETARIA'] },
  { label: 'RH', href: '/rh', icon: '👥', roles: ['FULL', 'FINANCEIRO'] },
  { label: 'Orientação Cirúrgica', href: '/orientacao-cirurgica', icon: '🏥', roles: ['FULL', 'FINANCEIRO', 'SECRETARIA'] },
  { label: 'Pacientes', href: '/pacientes', icon: '🧑‍⚕️', roles: ['FULL', 'FINANCEIRO', 'SECRETARIA'] },
  { label: 'PDV', href: '/pdv', icon: '🧾', roles: ['FULL', 'FINANCEIRO', 'SECRETARIA'] },
  { label: 'ABASUS', href: '/abasus', icon: '🏛️', roles: ['FULL', 'FINANCEIRO'] },
];

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, checkAuth, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) return null;

  const filteredNav = NAV_ITEMS.filter(
    (item) => user.access_level === 'FULL' || item.roles.includes(user.access_level),
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-brand-900 text-white flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <h1 className="text-xl font-bold">ERP MDV</h1>
          <p className="text-xs text-blue-300 mt-1">Oftalmologia</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {filteredNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="text-sm font-medium">{user.name}</div>
          <div className="text-xs text-blue-300">{user.access_level}</div>
          <button
            onClick={logout}
            className="mt-2 text-xs text-blue-300 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
