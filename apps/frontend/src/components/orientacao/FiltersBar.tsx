'use client';

import { useState, useEffect, useRef } from 'react';

interface FiltersBarProps {
  pathologies: string[];
  responsaveis: string[];
  pathology: string;
  responsavel: string;
  search: string;
  onPathologyChange: (v: string) => void;
  onResponsavelChange: (v: string) => void;
  onSearchChange: (v: string) => void;
}

export default function FiltersBar({
  pathologies, responsaveis,
  pathology, responsavel, search,
  onPathologyChange, onResponsavelChange, onSearchChange,
}: FiltersBarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localSearch), 300);
    return () => clearTimeout(debounceRef.current);
  }, [localSearch, onSearchChange]);

  const hasFilters = pathology || responsavel || search;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
      {/* Pathology */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Patologia:</label>
        <select
          value={pathology}
          onChange={(e) => onPathologyChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none"
        >
          <option value="">Todas</option>
          {pathologies.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Responsavel */}
      <div className="flex items-center gap-1.5">
        <label className="text-xs text-gray-500 font-medium">Responsável:</label>
        <select
          value={responsavel}
          onChange={(e) => onResponsavelChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none"
        >
          <option value="">Todos</option>
          {responsaveis.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Nome, telefone ou CPF..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 outline-none placeholder:text-gray-400"
        />
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => {
            onPathologyChange('');
            onResponsavelChange('');
            onSearchChange('');
            setLocalSearch('');
          }}
          className="text-xs text-brand-600 hover:text-brand-800 font-medium underline"
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
