// apps/backend/src/modules/financeiro/report.service.ts
// ═══════════════════════════════════════════════════════════════
// Relatórios gerenciais: DRE (competência) e Fluxo de Caixa (realizado + projeção)
// Ambos lêem de LedgerEntry e CashMovement — nunca direto de AP/AR.
// ═══════════════════════════════════════════════════════════════

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  DreReportResponse, DreLineResponse,
  CashFlowReportResponse, CashFlowDayResponse,
} from './dto/engine.dto';

// Ordem fixa das seções da DRE (espelho do enum DreSection)
const DRE_SECTION_ORDER = [
  'RECEITA_BRUTA',
  'DEDUCOES_RECEITA',
  'CUSTO_SERVICO',
  'DESPESA_PESSOAL',
  'DESPESA_ADMINISTRATIVA',
  'DESPESA_COMERCIAL',
  'DESPESA_OCUPACAO',
  'DESPESA_FINANCEIRA',
  'RECEITA_FINANCEIRA',
  'OUTRAS_RECEITAS',
  'OUTRAS_DESPESAS',
  'DEPRECIACAO_AMORTIZACAO',
  'IMPOSTOS_RESULTADO',
] as const;

// Seções que são "positivas" na DRE (somam ao resultado)
const POSITIVE_SECTIONS = new Set([
  'RECEITA_BRUTA',
  'RECEITA_FINANCEIRA',
  'OUTRAS_RECEITAS',
]);

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ══════════════════════════════════════════════
  // DRE — Demonstração do Resultado do Exercício
  //
  // Lê LedgerEntry agrupado por master_account.dre_section.
  // Se consolidated=true ou unit_id omitido, soma todas as unidades.
  // Período: competências de `from` até `to` (inclusive).
  // ══════════════════════════════════════════════

  async getDre(
    from: string, to: string,
    unitId?: string, consolidated = false,
  ): Promise<DreReportResponse> {
    const competences = this.expandCompetences(from, to);

    const where: Prisma.LedgerEntryWhereInput = {
      status: 'POSTED',
      competence: { in: competences },
      ...(unitId && !consolidated ? { unit_id: unitId } : {}),
    };

    // Buscar lançamentos com join até master_account
    const entries = await this.prisma.ledgerEntry.findMany({
      where,
      include: {
        unit_account: {
          include: {
            master_account: { select: { dre_section: true, nature: true } },
          },
        },
      },
    });

    // Agrupar por dre_section
    const sectionMap = new Map<string, { total: number; count: number; nature: string }>();

    for (const e of entries) {
      const section = e.unit_account.master_account.dre_section;
      const nature = e.unit_account.master_account.nature;
      if (section === 'NAO_DRE') continue;

      const current = sectionMap.get(section) || { total: 0, count: 0, nature };
      const amount = Number(e.amount);

      // DEBIT aumenta despesas, CREDIT aumenta receitas
      if (e.type === 'CREDIT') {
        current.total += amount;
      } else {
        current.total += amount;
      }
      current.count++;
      sectionMap.set(section, current);
    }

    // Montar array ordenado
    const sections: DreLineResponse[] = DRE_SECTION_ORDER.map((section) => {
      const data = sectionMap.get(section);
      return {
        dre_section: section,
        nature: data?.nature || (POSITIVE_SECTIONS.has(section) ? 'RECEITA' : 'DESPESA'),
        total: data?.total || 0,
        entries_count: data?.count || 0,
      };
    });

    // Calcular resumo
    const get = (s: string) => sectionMap.get(s)?.total || 0;

    const receita_bruta = get('RECEITA_BRUTA');
    const deducoes = get('DEDUCOES_RECEITA');
    const receita_liquida = receita_bruta - deducoes;
    const custos = get('CUSTO_SERVICO');
    const lucro_bruto = receita_liquida - custos;

    const despesas_operacionais =
      get('DESPESA_PESSOAL') +
      get('DESPESA_ADMINISTRATIVA') +
      get('DESPESA_COMERCIAL') +
      get('DESPESA_OCUPACAO') +
      get('DESPESA_FINANCEIRA') -
      get('RECEITA_FINANCEIRA') -
      get('OUTRAS_RECEITAS') +
      get('OUTRAS_DESPESAS');

    const ebitda = lucro_bruto - despesas_operacionais;
    const depreciacao = get('DEPRECIACAO_AMORTIZACAO');
    const resultado_antes_ir = ebitda - depreciacao;
    const impostos = get('IMPOSTOS_RESULTADO');
    const resultado_liquido = resultado_antes_ir - impostos;

    return {
      from, to,
      unit_id: unitId || null,
      consolidated: consolidated || !unitId,
      generated_at: new Date().toISOString(),
      sections,
      summary: {
        receita_bruta,
        deducoes,
        receita_liquida,
        custos,
        lucro_bruto,
        despesas_operacionais,
        ebitda,
        depreciacao,
        resultado_antes_ir,
        impostos,
        resultado_liquido,
      },
    };
  }

  // ══════════════════════════════════════════════
  // FLUXO DE CAIXA — Realizado + Projeção
  //
  // Realizado: CashMovement entre from..to
  // Projeção: Payables (due_date) e Receivables (expected_date)
  //           com status pendente, nos próximos projection_days
  //           após `to`.
  // ══════════════════════════════════════════════

  async getCashFlow(
    from: string, to: string,
    unitId?: string, projectionDays = 30,
  ): Promise<CashFlowReportResponse> {
    const dateFrom = new Date(from);
    const dateTo = new Date(to);

    const unitFilter = unitId ? { unit_id: unitId } : {};

    // ── Realizado: CashMovement ──
    const movements = await this.prisma.cashMovement.findMany({
      where: {
        ...unitFilter,
        movement_date: { gte: dateFrom, lte: dateTo },
      },
      include: {
        unit_account: {
          include: {
            master_account: { select: { code: true, name: true } },
          },
        },
      },
      orderBy: { movement_date: 'asc' },
    });

    // Agrupar por dia
    const dailyMap = new Map<string, { in: number; out: number }>();
    const accountMap = new Map<string, { code: string; name: string; in: number; out: number }>();

    for (const m of movements) {
      const dateKey = m.movement_date.toISOString().slice(0, 10);
      const day = dailyMap.get(dateKey) || { in: 0, out: 0 };
      const amount = Number(m.amount);

      if (m.direction === 'IN') day.in += amount;
      else day.out += amount;
      dailyMap.set(dateKey, day);

      // By account
      const acctKey = m.unit_account.master_account.code;
      const acct = accountMap.get(acctKey) || {
        code: m.unit_account.master_account.code,
        name: m.unit_account.master_account.name,
        in: 0, out: 0,
      };
      if (m.direction === 'IN') acct.in += amount;
      else acct.out += amount;
      accountMap.set(acctKey, acct);
    }

    // ── Projeção: Payables/Receivables pendentes ──
    if (projectionDays > 0) {
      const projStart = new Date(dateTo);
      projStart.setDate(projStart.getDate() + 1);
      const projEnd = new Date(projStart);
      projEnd.setDate(projEnd.getDate() + projectionDays);

      const [projPayables, projReceivables] = await Promise.all([
        this.prisma.payable.findMany({
          where: {
            ...unitFilter,
            status: { in: ['PENDENTE', 'APROVADO', 'AJUSTADO'] },
            due_date: { gte: projStart, lte: projEnd },
          },
          select: { due_date: true, value: true },
        }),
        this.prisma.receivable.findMany({
          where: {
            ...unitFilter,
            status: { in: ['PREVISTO', 'ATRASADO'] },
            expected_date: { gte: projStart, lte: projEnd },
          },
          select: { expected_date: true, net_value: true },
        }),
      ]);

      for (const p of projPayables) {
        const dateKey = p.due_date.toISOString().slice(0, 10);
        const day = dailyMap.get(dateKey) || { in: 0, out: 0 };
        day.out += Number(p.value);
        dailyMap.set(dateKey, day);
      }

      for (const r of projReceivables) {
        const dateKey = r.expected_date.toISOString().slice(0, 10);
        const day = dailyMap.get(dateKey) || { in: 0, out: 0 };
        day.in += Number(r.net_value);
        dailyMap.set(dateKey, day);
      }
    }

    // Montar array diário ordenado com acumulado
    const sortedDates = [...dailyMap.keys()].sort();
    let cumulative = 0;
    let totalIn = 0;
    let totalOut = 0;

    const daily: CashFlowDayResponse[] = sortedDates.map((date) => {
      const day = dailyMap.get(date)!;
      const balance = day.in - day.out;
      cumulative += balance;
      totalIn += day.in;
      totalOut += day.out;

      return {
        date,
        entries_in: Math.round(day.in * 100) / 100,
        entries_out: Math.round(day.out * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        cumulative: Math.round(cumulative * 100) / 100,
        is_projection: date > to,
      };
    });

    const by_account = [...accountMap.values()]
      .map((a) => ({
        account_code: a.code,
        account_name: a.name,
        total_in: Math.round(a.in * 100) / 100,
        total_out: Math.round(a.out * 100) / 100,
      }))
      .sort((a, b) => a.account_code.localeCompare(b.account_code));

    return {
      from, to,
      unit_id: unitId || null,
      projection_days: projectionDays,
      generated_at: new Date().toISOString(),
      total_in: Math.round(totalIn * 100) / 100,
      total_out: Math.round(totalOut * 100) / 100,
      net_balance: Math.round((totalIn - totalOut) * 100) / 100,
      daily,
      by_account,
    };
  }

  // ══════════════════════════════════════════════
  // Helper: expandir range de competências
  // "2026-01" → "2026-03" = ["2026-01", "2026-02", "2026-03"]
  // ══════════════════════════════════════════════

  private expandCompetences(from: string, to: string): string[] {
    const result: string[] = [];
    const [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);

    let year = fy;
    let month = fm;

    while (year < ty || (year === ty && month <= tm)) {
      result.push(`${year}-${String(month).padStart(2, '0')}`);
      month++;
      if (month > 12) { month = 1; year++; }
    }

    return result;
  }
}
