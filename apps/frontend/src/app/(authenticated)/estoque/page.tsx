// apps/frontend/src/app/(authenticated)/estoque/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import type { StockAlert } from '@/types';

export default function EstoquePage() {
  const [critical, setCritical] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'CRITICO' | 'REPOR' | 'VENCENDO'>('all');
  const user = useAuthStore((s) => s.user);
  const unitParam = user?.unit_id ? `?unit_id=${user.unit_id}` : '?unit_id=';

  useEffect(() => {
    api.get<StockAlert[]>(`/estoque/critical${unitParam}`)
      .then(setCritical)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [unitParam]);

  const filtered = filter === 'all' ? critical : critical.filter((c) => c.alert_type === filter);

  const alertConfig = {
    CRITICO:  { label: 'Crítico',  color: 'bg-red-100 text-red-800',    dot: 'bg-red-500' },
    REPOR:    { label: 'Repor',    color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
    VENCENDO: { label: 'Vencendo', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  };

  if (loading) return <div className="text-gray-500">Carregando estoque...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Estoque</h1>
      <p className="text-sm text-gray-500 mb-6">
        {critical.length} itens requerem atenção
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['CRITICO', 'REPOR', 'VENCENDO'] as const).map((type) => {
          const count = critical.filter((c) => c.alert_type === type).length;
          const cfg = alertConfig[type];
          return (
            <button
              key={type}
              onClick={() => setFilter(filter === type ? 'all' : type)}
              className={`p-4 rounded-xl border-2 transition-colors ${
                filter === type ? 'border-gray-800' : 'border-transparent'
              } ${cfg.color}`}
            >
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-sm">{cfg.label}</div>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">SKU</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Item</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Categoria</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Qtd</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Mínimo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Lote</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Validade</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((item) => {
              const cfg = alertConfig[item.alert_type];
              const isExpired = item.expiry && new Date(item.expiry) < new Date();
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.item.sku}</td>
                  <td className="px-4 py-3 font-medium">{item.item.name}</td>
                  <td className="px-4 py-3 text-gray-500">{item.item.category}</td>
                  <td className="px-4 py-3 text-right font-bold">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{item.item.min_stock}</td>
                  <td className="px-4 py-3 text-gray-500">{item.lot || '—'}</td>
                  <td className={`px-4 py-3 ${isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                    {item.expiry ? new Date(item.expiry).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  Nenhum item nesta categoria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
