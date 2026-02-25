'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  pathologies: string[];
  responsaveis: string[];
  onFilterChange: (filters: {
    search: string;
    pathology: string;
    responsavel: string;
  }) => void;
  onClear?: () => void;
}

export function FiltersBar({ pathologies, responsaveis, onFilterChange, onClear }: Props) {
  const [search, setSearch] = useState('');
  const [pathology, setPathology] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFilterChange({ search, pathology, responsavel });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search, pathology, responsavel]);

  const hasFilters = search || pathology || responsavel;

  const handleClear = () => {
    setSearch('');
    setPathology('');
    setResponsavel('');
    onClear?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white/70 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nome, telefone ou CPF..."
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
        />
      </div>

      {/* Pathology */}
      <select
        value={pathology}
        onChange={(e) => setPathology(e.target.value)}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[150px]"
      >
        <option value="">Todas patologias</option>
        {pathologies.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* Responsável */}
      <select
        value={responsavel}
        onChange={(e) => setResponsavel(e.target.value)}
        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-w-[150px]"
      >
        <option value="">Todos responsáveis</option>
        {responsaveis.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={handleClear}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline whitespace-nowrap"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
