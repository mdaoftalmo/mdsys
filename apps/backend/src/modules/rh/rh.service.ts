import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RhService {
  constructor(private readonly prisma: PrismaService) {}

  async listEmployees(unitId: string, filters: { status?: string; type?: string; department?: string }) {
    return this.prisma.employee.findMany({
      where: {
        unit_id: unitId,
        ...(filters.status && { status: filters.status as any }),
        ...(filters.type && { type: filters.type as any }),
        ...(filters.department && { department: filters.department }),
      },
      include: { unit: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async getExpiringDocuments(unitId: string, daysAhead: number = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.employeeDocument.findMany({
      where: {
        employee: { unit_id: unitId },
        expires_at: { lte: cutoff },
      },
      include: { employee: { select: { name: true, role: true } } },
      orderBy: { expires_at: 'asc' },
    });
  }

  async getPayrollSummary(unitId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { unit_id: unitId, status: 'ATIVO' },
      select: { type: true, salary: true, department: true },
    });

    const byType: Record<string, { count: number; total: number }> = {};
    const byDept: Record<string, { count: number; total: number }> = {};

    for (const e of employees) {
      const t = byType[e.type] || { count: 0, total: 0 };
      t.count++;
      t.total += Number(e.salary);
      byType[e.type] = t;

      const d = byDept[e.department] || { count: 0, total: 0 };
      d.count++;
      d.total += Number(e.salary);
      byDept[e.department] = d;
    }

    return {
      total_employees: employees.length,
      total_payroll: employees.reduce((s, e) => s + Number(e.salary), 0),
      by_type: byType,
      by_department: byDept,
    };
  }
}
