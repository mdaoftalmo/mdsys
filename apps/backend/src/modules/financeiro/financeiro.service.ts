// ═══════════════════════════════════════════════════════════════
// apps/backend/src/modules/financeiro/financeiro.service.ts
// ═══════════════════════════════════════════════════════════════
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Payables (Contas a Pagar) ──

  /** Validates that unit_account_id belongs to the given unit_id */
  private async validateUnitAccount(unitAccountId: string, unitId: string): Promise<void> {
    const ua = await this.prisma.unitAccount.findFirst({
      where: { id: unitAccountId, unit_id: unitId },
    });
    if (!ua) {
      throw new BadRequestException(
        `UnitAccount ${unitAccountId} não pertence à unidade ${unitId}`,
      );
    }
  }

  async createPayable(unitId: string, dto: {
    supplier_id: string;
    unit_account_id?: string;
    cost_center_id?: string;
    description: string;
    competence: string;
    due_date: string;
    value: number;
    payment_method?: string;
    installments?: number;
    is_recurring?: boolean;
  }) {
    if (dto.unit_account_id) {
      await this.validateUnitAccount(dto.unit_account_id, unitId);
    }

    return this.prisma.payable.create({
      data: {
        unit_id: unitId,
        supplier_id: dto.supplier_id,
        unit_account_id: dto.unit_account_id || null,
        cost_center_id: dto.cost_center_id || null,
        description: dto.description,
        competence: dto.competence,
        due_date: new Date(dto.due_date),
        value: dto.value,
        payment_method: (dto.payment_method as any) || 'BOLETO',
        installments: dto.installments ?? 1,
        is_recurring: dto.is_recurring ?? false,
        status: 'PENDENTE',
      },
      include: {
        supplier: { select: { name: true } },
        unit_account: { select: { id: true, custom_name: true, master_account: { select: { code: true, name: true } } } },
        cost_center: { select: { full_path: true } },
      },
    });
  }

  async listPayables(unitId: string, filters: { status?: string; competence?: string }, page = 1, limit = 50) {
    const where = {
      unit_id: unitId,
      ...(filters.status && { status: filters.status as any }),
      ...(filters.competence && { competence: filters.competence }),
    };

    const [data, total] = await Promise.all([
      this.prisma.payable.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          unit_account: { select: { id: true, custom_name: true, master_account: { select: { code: true, name: true } } } },
          cost_center: { select: { full_path: true } },
        },
        orderBy: { due_date: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payable.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async approvePayable(id: string, unitId: string, userId: string) {
    const payable = await this.prisma.payable.findFirst({ where: { id, unit_id: unitId } });
    if (!payable) throw new NotFoundException('Conta a pagar não encontrada');
    if (payable.status !== 'PENDENTE') throw new BadRequestException('Apenas contas PENDENTE podem ser aprovadas');

    const [updated] = await this.prisma.$transaction([
      this.prisma.payable.update({ where: { id }, data: { status: 'APROVADO' } }),
      this.prisma.approvalLog.create({
        data: {
          payable_id: id,
          action: 'APROVADO',
          user_id: userId,
          value: payable.value,
        },
      }),
    ]);
    return updated;
  }

  async adjustPayable(
    id: string, unitId: string, userId: string,
    newValue: number, justification: string, authorizedBy: string,
  ) {
    const payable = await this.prisma.payable.findFirst({ where: { id, unit_id: unitId } });
    if (!payable) throw new NotFoundException('Conta a pagar não encontrada');

    const [updated] = await this.prisma.$transaction([
      this.prisma.payable.update({
        where: { id },
        data: {
          status: 'AJUSTADO',
          original_value: payable.original_value ?? payable.value, // preserve first original
          value: newValue,
          adjustment_justification: justification,
          authorized_by: authorizedBy,
        },
      }),
      this.prisma.approvalLog.create({
        data: {
          payable_id: id,
          action: 'AJUSTADO',
          user_id: userId,
          value: newValue,
          original_value: payable.original_value ?? payable.value,
          justification,
          authorized_by: authorizedBy,
        },
      }),
    ]);
    return updated;
  }

  // ── Receivables (Contas a Receber) ──

  async createReceivable(unitId: string, dto: {
    source: string;
    unit_account_id?: string;
    competence: string;
    expected_date: string;
    gross_value: number;
    discount?: number;
    net_value: number;
    is_convenio?: boolean;
  }) {
    if (dto.unit_account_id) {
      await this.validateUnitAccount(dto.unit_account_id, unitId);
    }

    return this.prisma.receivable.create({
      data: {
        unit_id: unitId,
        source: dto.source,
        unit_account_id: dto.unit_account_id || null,
        competence: dto.competence,
        expected_date: new Date(dto.expected_date),
        gross_value: dto.gross_value,
        discount: dto.discount ?? 0,
        net_value: dto.net_value,
        is_convenio: dto.is_convenio ?? false,
        status: 'PREVISTO',
      },
      include: {
        unit_account: { select: { id: true, custom_name: true, master_account: { select: { code: true, name: true } } } },
      },
    });
  }

  async listReceivables(unitId: string, filters: { status?: string; competence?: string }) {
    return this.prisma.receivable.findMany({
      where: {
        unit_id: unitId,
        ...(filters.status && { status: filters.status as any }),
        ...(filters.competence && { competence: filters.competence }),
      },
      orderBy: { expected_date: 'asc' },
    });
  }

  // ── Cash Flow — Projetado (por due_date / expected_date) ──

  async getCashFlowProjected(unitId: string, month: string) {
    const startDate = new Date(`${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const [receivables, payables] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: {
          unit_id: unitId,
          expected_date: { gte: startDate, lt: endDate },
          status: { not: 'GLOSADO' },
        },
        _sum: { gross_value: true, net_value: true, gloss_value: true },
        _count: true,
      }),
      this.prisma.payable.aggregate({
        where: {
          unit_id: unitId,
          due_date: { gte: startDate, lt: endDate },
          status: { notIn: ['CANCELADO', 'REPROVADO'] },
        },
        _sum: { value: true },
        _count: true,
      }),
    ]);

    return {
      month,
      type: 'projected',
      total_receivable: receivables._sum.net_value || 0,
      total_payable: payables._sum.value || 0,
      balance: Number(receivables._sum.net_value || 0) - Number(payables._sum.value || 0),
      receivable_count: receivables._count,
      payable_count: payables._count,
      gloss_total: receivables._sum.gloss_value || 0,
    };
  }

  // ── Cash Flow — DRE / Competência (mantido para DRE) ──

  async getCashFlowByCompetence(unitId: string, month: string) {
    const [receivables, payables] = await Promise.all([
      this.prisma.receivable.aggregate({
        where: { unit_id: unitId, competence: month },
        _sum: { gross_value: true, net_value: true, gloss_value: true },
        _count: true,
      }),
      this.prisma.payable.aggregate({
        where: { unit_id: unitId, competence: month, status: { not: 'CANCELADO' } },
        _sum: { value: true },
        _count: true,
      }),
    ]);
    return {
      month,
      total_receivable: receivables._sum.net_value || 0,
      total_payable: payables._sum.value || 0,
      balance: Number(receivables._sum.net_value || 0) - Number(payables._sum.value || 0),
      receivable_count: receivables._count,
      payable_count: payables._count,
      gloss_total: receivables._sum.gloss_value || 0,
    };
  }

  // ── DRE ──

  async getDreValues(unitId: string, month: string) {
    return this.prisma.dreValue.findMany({
      where: { unit_id: unitId, month_key: month },
    });
  }
}
