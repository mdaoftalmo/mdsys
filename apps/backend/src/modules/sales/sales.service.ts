// apps/backend/src/modules/sales/sales.service.ts
import {
  Injectable, BadRequestException, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { LedgerService } from '../financeiro/ledger.service';
import { CreateSaleDto, AddItemDto, UpdateItemDto, ReceiveSaleDto } from './sales.dto';

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
    private readonly ledger: LedgerService,
  ) {}

  // ══════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════

  /** Recalculate sale totals from items */
  private async recalcTotals(saleId: string) {
    const items = await this.prisma.saleItem.findMany({ where: { sale_id: saleId } });
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const discount = items.reduce((s, i) => s + Number(i.discount), 0);
    const total = subtotal - discount;
    await this.prisma.sale.update({
      where: { id: saleId },
      data: {
        subtotal: Math.max(0, subtotal + discount), // subtotal = qty*price (before discount)
        discount: Math.max(0, discount),
        total: Math.max(0, total),
      },
    });
  }

  /** Find revenue UnitAccount for a given unit */
  private async findRevenueAccount(unitId: string, isConvenio: boolean): Promise<string | null> {
    // Try specific account: 3.1.01.001 (Particular) or 3.1.01.002 (Convênio)
    const code = isConvenio ? '3.1.01.002' : '3.1.01.001';
    const ua = await this.prisma.unitAccount.findFirst({
      where: { unit_id: unitId, master_account: { code } },
    });
    if (ua) return ua.id;

    // Fallback: any RECEITA_BRUTA analytic account in this unit
    const fallback = await this.prisma.unitAccount.findFirst({
      where: {
        unit_id: unitId,
        master_account: { dre_section: 'RECEITA_BRUTA', is_group: false },
      },
    });
    if (fallback) return fallback.id;

    this.logger.warn(`No revenue UnitAccount found for unit ${unitId}`);
    return null;
  }

  // ══════════════════════════════════════════════
  // LIST
  // ══════════════════════════════════════════════

  async list(filters: {
    search?: string; unitId?: string; from?: string; to?: string;
    type?: string; status?: string; page: number; limit: number;
  }) {
    const where: any = {};

    if (filters.unitId) where.unit_id = filters.unitId;
    if (filters.status) where.status = filters.status;
    if (filters.type === 'PARTICULAR') where.convenio_id = null;
    if (filters.type === 'CONVENIO') where.convenio_id = { not: null };

    if (filters.from || filters.to) {
      where.created_at = {};
      if (filters.from) where.created_at.gte = new Date(filters.from);
      if (filters.to) where.created_at.lte = new Date(filters.to + 'T23:59:59Z');
    }

    if (filters.search) {
      where.OR = [
        { patient: { name: { contains: filters.search, mode: 'insensitive' } } },
        { patient: { cpf: { contains: filters.search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        include: {
          patient: { select: { id: true, name: true, cpf: true } },
          unit: { select: { id: true, name: true } },
          convenio: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) },
    };
  }

  // ══════════════════════════════════════════════
  // GET BY ID
  // ══════════════════════════════════════════════

  async findById(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, name: true, cpf: true, phone: true } },
        unit: { select: { id: true, name: true } },
        convenio: { select: { id: true, name: true } },
        receivable: { select: { id: true, status: true, net_value: true, received_at: true } },
        items: {
          include: { service: { select: { id: true, name: true, category: true } } },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!sale) throw new NotFoundException(`Venda ${id} não encontrada`);
    return sale;
  }

  // ══════════════════════════════════════════════
  // CREATE SALE (DRAFT)
  // ══════════════════════════════════════════════

  async create(unitId: string, dto: CreateSaleDto) {
    // Validate patient exists
    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patient_id, deleted_at: null },
    });
    if (!patient) throw new BadRequestException('Paciente não encontrado');

    // Validate convenio if provided
    if (dto.convenio_id) {
      const conv = await this.prisma.convenio.findUnique({ where: { id: dto.convenio_id } });
      if (!conv) throw new BadRequestException('Convênio não encontrado');
    }

    return this.prisma.sale.create({
      data: {
        unit_id: unitId,
        patient_id: dto.patient_id,
        convenio_id: dto.convenio_id || null,
        payment_method: dto.payment_method as any,
        visit_type: dto.visit_type || 'primeira',
        status: 'DRAFT',
        subtotal: 0,
        discount: 0,
        total: 0,
        notes: dto.notes || null,
        is_coparticipacao: !!dto.convenio_id,
      },
      include: {
        patient: { select: { id: true, name: true, cpf: true } },
        unit: { select: { id: true, name: true } },
        convenio: { select: { id: true, name: true } },
      },
    });
  }

  // ══════════════════════════════════════════════
  // ITEMS CRUD
  // ══════════════════════════════════════════════

  async addItem(saleId: string, dto: AddItemDto) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status !== 'DRAFT') throw new BadRequestException('Só é possível editar vendas em rascunho');

    const itemDiscount = dto.discount || 0;
    const subtotal = dto.quantity * dto.unit_price;
    if (itemDiscount > subtotal) throw new BadRequestException('Desconto não pode exceder o subtotal do item');

    const item = await this.prisma.saleItem.create({
      data: {
        sale_id: saleId,
        service_id: dto.service_id || null,
        description: dto.description,
        quantity: dto.quantity,
        unit_price: dto.unit_price,
        discount: itemDiscount,
        subtotal: subtotal - itemDiscount,
      },
      include: { service: { select: { id: true, name: true, category: true } } },
    });

    await this.recalcTotals(saleId);
    return item;
  }

  async updateItem(saleId: string, itemId: string, dto: UpdateItemDto) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status !== 'DRAFT') throw new BadRequestException('Só é possível editar vendas em rascunho');

    const item = await this.prisma.saleItem.findFirst({ where: { id: itemId, sale_id: saleId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    const qty = dto.quantity ?? item.quantity;
    const price = dto.unit_price ?? Number(item.unit_price);
    const disc = dto.discount ?? Number(item.discount);
    const subtotal = qty * price;
    if (disc > subtotal) throw new BadRequestException('Desconto não pode exceder o subtotal do item');

    const updated = await this.prisma.saleItem.update({
      where: { id: itemId },
      data: {
        quantity: qty,
        unit_price: price,
        discount: disc,
        subtotal: subtotal - disc,
      },
      include: { service: { select: { id: true, name: true, category: true } } },
    });

    await this.recalcTotals(saleId);
    return updated;
  }

  async removeItem(saleId: string, itemId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status !== 'DRAFT') throw new BadRequestException('Só é possível editar vendas em rascunho');

    const item = await this.prisma.saleItem.findFirst({ where: { id: itemId, sale_id: saleId } });
    if (!item) throw new NotFoundException('Item não encontrado');

    await this.prisma.saleItem.delete({ where: { id: itemId } });
    await this.recalcTotals(saleId);
    return { deleted: true };
  }

  // ══════════════════════════════════════════════
  // CONFIRM (creates Receivable)
  // ══════════════════════════════════════════════

  async confirm(saleId: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, patient: true },
    });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status !== 'DRAFT') throw new BadRequestException(`Venda em status ${sale.status}, esperado DRAFT`);
    if (sale.items.length === 0) throw new BadRequestException('Adicione pelo menos um item antes de confirmar');
    if (!sale.patient_id) throw new BadRequestException('Paciente obrigatório');

    // Idempotency: check if receivable already exists
    if (sale.receivable_id) {
      throw new ConflictException('Venda já possui recebível vinculado');
    }

    const isConvenio = !!sale.convenio_id;
    const unitAccountId = await this.findRevenueAccount(sale.unit_id, isConvenio);

    const now = new Date();
    const competence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Create Receivable via FinanceiroService
    const receivable = await this.financeiro.createReceivable(sale.unit_id, {
      source: `Venda ${sale.patient?.name || ''} #${saleId.slice(0, 8)}`,
      unit_account_id: unitAccountId ?? undefined,
      competence,
      expected_date: now.toISOString().split('T')[0],
      gross_value: Number(sale.subtotal),
      discount: Number(sale.discount),
      net_value: Number(sale.total),
      is_convenio: isConvenio,
    });

    // Update sale: CONFIRMED + link receivable
    const confirmed = await this.prisma.sale.update({
      where: { id: saleId },
      data: { status: 'CONFIRMED', receivable_id: receivable.id },
      include: {
        patient: { select: { id: true, name: true, cpf: true } },
        unit: { select: { id: true, name: true } },
        convenio: { select: { id: true, name: true } },
        receivable: { select: { id: true, status: true, net_value: true } },
        items: { include: { service: { select: { id: true, name: true } } } },
      },
    });

    this.logger.log(`Sale ${saleId} CONFIRMED → Receivable ${receivable.id}`);
    return confirmed;
  }

  // ══════════════════════════════════════════════
  // CANCEL
  // ══════════════════════════════════════════════

  async cancel(saleId: string) {
    const sale = await this.prisma.sale.findUnique({ where: { id: saleId } });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status === 'CANCELED') throw new BadRequestException('Venda já está cancelada');
    if (sale.status === 'PAID') throw new BadRequestException('Venda já paga, não pode ser cancelada');

    // If receivable exists and is PREVISTO, we mark it cancelled (update status)
    if (sale.receivable_id) {
      const recv = await this.prisma.receivable.findUnique({ where: { id: sale.receivable_id } });
      if (recv && recv.status === 'PREVISTO') {
        await this.prisma.receivable.update({
          where: { id: sale.receivable_id },
          data: { status: 'GLOSADO', gloss_value: recv.net_value }, // using GLOSADO as "cancelled" equivalent
        });
      }
    }

    return this.prisma.sale.update({
      where: { id: saleId },
      data: { status: 'CANCELED' },
      include: {
        patient: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true } },
      },
    });
  }

  // ══════════════════════════════════════════════
  // RECEIVE (shortcut to engine)
  // ══════════════════════════════════════════════

  async receive(saleId: string, userId: string, dto: ReceiveSaleDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { receivable: true },
    });
    if (!sale) throw new NotFoundException('Venda não encontrada');
    if (sale.status === 'PAID') throw new BadRequestException('Venda já foi recebida');
    if (sale.status !== 'CONFIRMED') throw new BadRequestException('Confirme a venda antes de receber');
    if (!sale.receivable_id) throw new BadRequestException('Venda sem recebível vinculado');

    // Post the receivable (LedgerEntry) if not yet posted
    try {
      await this.ledger.postAR(sale.receivable_id, userId);
    } catch (e) {
      // Already posted is fine (idempotent)
      this.logger.log(`postAR idempotent: ${e.message}`);
    }

    // Receive (CashMovement IN)
    const pm = dto.payment_method || sale.payment_method || 'PIX';
    const cashMovement = await this.ledger.receiveAR(sale.receivable_id, userId, pm);

    // Mark sale as PAID
    await this.prisma.sale.update({
      where: { id: saleId },
      data: { status: 'PAID' },
    });

    return {
      sale_id: saleId,
      status: 'PAID',
      receivable_id: sale.receivable_id,
      cash_movement: cashMovement,
    };
  }
}
