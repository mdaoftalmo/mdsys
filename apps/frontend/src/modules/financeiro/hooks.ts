// src/modules/financeiro/hooks.ts
'use client';
// ═══════════════════════════════════════════════
// Finance Hooks — filter state + unit discovery
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { fetchUnits } from './api';
import { currentYearMonth } from './format';
import type { FinanceFilters, FinanceTab, UnitOption } from './types';

const CURRENT = currentYearMonth();

// ────────────────────────────────────────────
// useFinanceFilters
// Manages tab state, filter state, and unit list
// ────────────────────────────────────────────
export function useFinanceFilters() {
  const user = useAuthStore((s) => s.user);

  // Unit dropdown list (fetched from /bi/revenue-by-unit)
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);

  // Active tab
  const [activeTab, setActiveTab] = useState<FinanceTab>('dashboard');

  // Filters
  const [filters, setFilters] = useState<FinanceFilters>({
    unitId: user?.unit_id || null,  // null = "Todas as unidades"
    competence: CURRENT,
    competenceEnd: CURRENT,
    consolidated: !user?.unit_id,   // true if user is multi-unit (FULL)
    statusFilter: '',
  });

  // Fetch units on mount
  useEffect(() => {
    let cancelled = false;
    setUnitsLoading(true);
    fetchUnits()
      .then((list) => {
        if (!cancelled) setUnits(list);
      })
      .catch(() => {
        // Silently fail — dropdown just stays empty, user can still type UUID
        if (!cancelled) setUnits([]);
      })
      .finally(() => {
        if (!cancelled) setUnitsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Generic filter updater
  const updateFilter = useCallback(<K extends keyof FinanceFilters>(
    key: K,
    value: FinanceFilters[K],
  ) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };

      // When unitId changes: auto-set consolidated
      if (key === 'unitId') {
        next.consolidated = value === null;
      }
      // When consolidated toggles on: clear unitId
      if (key === 'consolidated' && value === true) {
        next.unitId = null;
      }

      return next;
    });
  }, []);

  // Derived: does the current tab require a specific unit?
  const needsUnitId = activeTab === 'pagar' || activeTab === 'receber' || activeTab === 'dashboard';
  const unitRequired = needsUnitId && !filters.unitId;

  return {
    filters,
    updateFilter,
    activeTab,
    setActiveTab,
    units,
    unitsLoading,
    unitRequired,  // true → show "Selecione uma unidade" warning
  };
}
