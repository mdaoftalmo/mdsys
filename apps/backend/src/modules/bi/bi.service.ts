import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BiService {
  constructor(private readonly prisma: PrismaService) {}

  /** Consolidated dashboard: one call, all KPIs */
  async getDashboard(unitIds: string[]) {
    const unitFilter = unitIds.length > 0 ? { unit_id: { in: unitIds } } : {};

    const [
      payablesPending, receivablesPending, salesThisMonth,
      criticalStockCount, overdueLeads, totalEmployees,
    ] = await Promise.all([
      this.prisma.payable.aggregate({
        where: { ...unitFilter, status: 'PENDENTE' } as any,
        _sum: { value: true }, _count: true,
      }),
      this.prisma.receivable.aggregate({
        where: { ...unitFilter, status: 'PREVISTO' } as any,
        _sum: { net_value: true }, _count: true,
      }),
      this.prisma.sale.aggregate({
        where: {
          ...unitFilter,
          created_at: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        } as any,
        _sum: { total: true }, _count: true,
      }),
      // FIX: Prisma-native query instead of broken nested $queryRaw
      this.countCriticalStock(unitIds),
      this.prisma.surgicalLead.count({
        where: {
          ...unitFilter,
          status: { notIn: ['FECHOU', 'PERDIDO'] },
          next_followup: { lte: new Date() },
        } as any,
      }),
      this.prisma.employee.count({
        where: { ...unitFilter, status: 'ATIVO' } as any,
      }),
    ]);

    return {
      finance: {
        payables_pending: { count: payablesPending._count, value: payablesPending._sum.value || 0 },
        receivables_pending: { count: receivablesPending._count, value: receivablesPending._sum.net_value || 0 },
        sales_this_month: { count: salesThisMonth._count, value: salesThisMonth._sum.total || 0 },
      },
      stock: { critical_items: criticalStockCount },
      surgical: { overdue_followups: overdueLeads },
      rh: { active_employees: totalEmployees },
    };
  }

  /** Count stock items below min_stock (Prisma-native, no raw SQL) */
  private async countCriticalStock(unitIds: string[]): Promise<number> {
    const levels = await this.prisma.stockLevel.findMany({
      where: unitIds.length > 0 ? { unit_id: { in: unitIds } } : {},
      select: { quantity: true, item: { select: { min_stock: true } } },
    });

    return levels.filter((l) => l.quantity < l.item.min_stock).length;
  }

  /** Revenue by unit for comparison */
  async getRevenueByUnit(month: string) {
    // FIX: parse month "2026-01" into safe date range with parameterized bindings
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    return this.prisma.$queryRaw<
      { unit_name: string; unit_id: string; revenue: number; sale_count: number }[]
    >(
      Prisma.sql`
        SELECT u.name AS unit_name, u.id AS unit_id,
          COALESCE(SUM(s.total), 0) AS revenue,
          COUNT(s.id)::int AS sale_count
        FROM units u
        LEFT JOIN sales s ON s.unit_id = u.id
          AND s.created_at >= ${startDate}
          AND s.created_at < ${endDate}
        WHERE u.deleted_at IS NULL
        GROUP BY u.id, u.name
        ORDER BY revenue DESC
      `,
    );
  }

  /** Surgical funnel consolidated */
  async getSurgicalFunnelAll() {
    return this.prisma.surgicalLead.groupBy({
      by: ['status'],
      _count: true,
      _avg: { score: true },
    });
  }
}
