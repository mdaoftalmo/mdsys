// src/modules/financeiro/tabs/DreTab.tsx
'use client';
// ═══════════════════════════════════════════════
// DRE — Income Statement with margins
// ═══════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { fetchDre } from '../api';
import { fmtBRL, fmtPct } from '../format';
import type { FinanceFilters, DreReport } from '../types';
import { DRE_SECTION_LABELS } from '../types';
import { LoadingState, ErrorState, EmptyState, KpiCard, Table, Th, Td } from '../components/ui';

interface Props { filters: FinanceFilters; }

// Computed lines inserted after certain sections
const COMPUTED_LINES: Record<string, { label: string; key: keyof DreReport['summary'] }> = {
  after_DEDUCOES_RECEITA:       { label: '= Receita Líquida',       key: 'receita_liquida' },
  after_CUSTO_SERVICO:          { label: '= Lucro Bruto',           key: 'lucro_bruto' },
  after_OUTRAS_DESPESAS:        { label: '= EBITDA',                key: 'ebitda' },
  after_DEPRECIACAO_AMORTIZACAO:{ label: '= Resultado antes do IR', key: 'resultado_antes_ir' },
  after_IMPOSTOS_RESULTADO:     { label: '= RESULTADO LÍQUIDO',     key: 'resultado_liquido' },
};

export default function DreTab({ filters }: Props) {
  const [report, setReport] = useState<DreReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDre(
        filters.competence,
        filters.competenceEnd || filters.competence,
        filters.unitId,
        filters.consolidated,
      );
      setReport(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters.competence, filters.competenceEnd, filters.unitId, filters.consolidated]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!report) return <EmptyState message="Nenhum dado disponível para o período selecionado." />;

  const s = report.summary;
  const hasData = report.sections.some((sec) => sec.total > 0);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Receita Bruta" value={s.receita_bruta} accent="emerald" />
        <KpiCard label="Receita Líquida" value={s.receita_liquida} accent="sky" />
        <KpiCard label="Lucro Bruto" value={s.lucro_bruto} accent={s.lucro_bruto >= 0 ? 'emerald' : 'red'} />
        <KpiCard label="EBITDA" value={s.ebitda} accent={s.ebitda >= 0 ? 'violet' : 'red'} />
        <KpiCard label="Resultado Líquido" value={s.resultado_liquido} accent={s.resultado_liquido >= 0 ? 'emerald' : 'red'} />
      </div>

      {/* Period info */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span>Período: <strong className="text-gray-600">{report.from}</strong> a <strong className="text-gray-600">{report.to}</strong></span>
        <span>·</span>
        <span>{report.consolidated ? 'Consolidado (todas as unidades)' : report.unit_id ? `Unidade: ${report.unit_id.slice(0, 8)}…` : 'Todas as unidades'}</span>
        <span>·</span>
        <span>Gerado em {new Date(report.generated_at).toLocaleString('pt-BR')}</span>
      </div>

      {/* DRE Table */}
      {!hasData ? (
        <EmptyState message="Nenhum lançamento contábil no período. Execute o fluxo Contabilizar nas abas A Pagar / A Receber." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Seção DRE</Th>
              <Th align="right">Lançamentos</Th>
              <Th align="right">Total (R$)</Th>
            </tr>
          </thead>
          <tbody>
            {report.sections.map((sec) => {
              const label = DRE_SECTION_LABELS[sec.dre_section];
              if (!label) return null;

              const isPositive = label.sign === '+';
              const computed = COMPUTED_LINES[`after_${sec.dre_section}`];

              return (
                <tbody key={sec.dre_section}>
                  <tr className="hover:bg-gray-50/60">
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${isPositive ? 'text-emerald-500' : 'text-red-400'}`}>
                          {label.sign}
                        </span>
                        <span className="text-sm text-gray-800">{label.label}</span>
                      </div>
                    </Td>
                    <Td align="right" mono className="text-gray-400">{sec.entries_count || '—'}</Td>
                    <Td align="right" mono bold className={sec.total === 0 ? 'text-gray-300' : 'text-gray-900'}>
                      {sec.total === 0 ? '—' : fmtBRL(sec.total)}
                    </Td>
                  </tr>
                  {computed && (
                    <tr className="bg-slate-50 border-t-2 border-slate-200">
                      <Td bold className="text-slate-800 text-sm pl-6">{computed.label}</Td>
                      <Td align="right" />
                      <Td align="right" mono bold className={`text-base ${(s[computed.key] as number) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {fmtBRL(s[computed.key] as number)}
                      </Td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </tbody>
        </Table>
      )}

      {/* Margin analysis */}
      {hasData && s.receita_bruta > 0 && (
        <div className="bg-white border border-gray-200 p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-4">Análise de Margens</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Margem Bruta',    value: (s.lucro_bruto / s.receita_bruta) * 100 },
              { label: 'Margem EBITDA',   value: (s.ebitda / s.receita_bruta) * 100 },
              { label: 'Margem Líquida',  value: (s.resultado_liquido / s.receita_bruta) * 100 },
              { label: 'Carga Tributária', value: ((s.deducoes + s.impostos) / s.receita_bruta) * 100 },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-xs text-gray-500 mb-1">{m.label}</p>
                <div className="flex items-baseline gap-1">
                  <span className={`text-xl font-bold tabular-nums ${m.value >= 0 ? 'text-gray-900' : 'text-red-700'}`}>
                    {fmtPct(m.value)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.value >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(Math.abs(m.value), 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
