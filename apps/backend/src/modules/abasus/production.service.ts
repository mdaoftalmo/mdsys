// apps/backend/src/modules/abasus/production.service.ts
import {
  Injectable, BadRequestException, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EstoqueService } from '../estoque/estoque.service';
import { CreateProductionDto, UpdateProductionDto, AddConsumptionDto, UpdateConsumptionDto } from './abasus.dto';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly estoque: EstoqueService,
  ) {}

  // ══════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════

  /** Validate unit is the SUS unit */
  async validateSusUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unidade não encontrada');
    if (!unit.name.toUpperCase().includes('SUS')) {
      throw new BadRequestException('ABASUS: Esta operação só é permitida na unidade SUS');
    }
    return unit;
  }

  /** Find revenue UnitAccount for SUS unit */
  private async findSusRevenueAccount(unitId: string): Promise<string | null> {
    // 3.1.03.003 = Cirurgias SUS
    const ua = await this.prisma.unitAccount.findFirst({
      where: { unit_id: unitId, master_account: { code: '3.1.03.003' } },
    });
    if (ua) return ua.id;
    // Fallback: any RECEITA_BRUTA in this unit
    const fallback = await this.prisma.unitAccount.findFirst({
      where: { unit_id: unitId, master_account: { dre_section: 'RECEITA_BRUTA', is_group: false } },
    });
    return fallback?.id || null;
  }

  /** Find cost UnitAccount for SUS insumos (DEBIT) */
  private async findSusCostAccount(unitId: string): Promise<string | null> {
    // Try specific: 4.1.01.001 = LIOs (Lentes Intraoculares)
    for (const code of ['4.1.01.001', '4.1.01.002', '4.1.01.003', '4.1.01', '4.1.02']) {
      const ua = await this.prisma.unitAccount.findFirst({
        where: { unit_id: unitId, master_account: { code } },
      });
      if (ua) return ua.id;
    }
    // Fallback: any CUSTO_SERVICO analytic account in this unit
    const fallback = await this.prisma.unitAccount.findFirst({
      where: { unit_id: unitId, master_account: { dre_section: 'CUSTO_SERVICO', is_group: false } },
    });
    return fallback?.id || null;
  }

  // ══════════════════════════════════════════════
  // LIST (unified across all 3 types)
  // ══════════════════════════════════════════════

  async list(unitId: string, filters: {
    type?: string; competence?: string; doctorId?: string;
    status?: string; search?: string; page: number; limit: number;
  }) {
    await this.validateSusUnit(unitId);

    const results: any[] = [];

    const shouldFetch = (t: string) => !filters.type || filters.type === t;

    // ── Consultas ──
    if (shouldFetch('CONSULTA')) {
      const where: any = { unit_id: unitId };
      if (filters.competence) where.month = filters.competence;
      if (filters.doctorId) where.doctor_id = filters.doctorId;
      if (filters.status) where.status = filters.status;
      if (filters.search) where.doctor_name = { contains: filters.search, mode: 'insensitive' };

      const rows = await this.prisma.susConsultation.findMany({
        where, include: { unit: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
      });
      results.push(...rows.map(r => ({
        ...r, _type: 'CONSULTA',
        _totalPatients: r.attendances + r.returns,
        _totalValue: Number(r.unit_value) * (r.attendances + r.returns),
      })));
    }

    // ── Exames ──
    if (shouldFetch('EXAME')) {
      const where: any = { unit_id: unitId };
      if (filters.competence) where.month = filters.competence;
      if (filters.doctorId) where.doctor_id = filters.doctorId;
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { doctor_name: { contains: filters.search, mode: 'insensitive' } },
          { exam_type: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const rows = await this.prisma.susExam.findMany({
        where, include: { unit: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
      });
      results.push(...rows.map(r => ({
        ...r, _type: 'EXAME',
        _totalPatients: r.quantity,
        _totalValue: Number(r.unit_value) * r.quantity,
      })));
    }

    // ── Cirurgias ──
    if (shouldFetch('CIRURGIA')) {
      const where: any = { unit_id: unitId };
      if (filters.competence) where.month = filters.competence;
      if (filters.doctorId) where.doctor_id = filters.doctorId;
      if (filters.status) where.status = filters.status;
      if (filters.search) {
        where.OR = [
          { doctor_name: { contains: filters.search, mode: 'insensitive' } },
          { procedure_type: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const rows = await this.prisma.susSurgery.findMany({
        where, include: { unit: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
      });
      results.push(...rows.map(r => ({
        ...r, _type: 'CIRURGIA',
        _totalPatients: r.quantity,
        _totalValue: Number(r.unit_value) * r.quantity,
      })));
    }

    // Sort by date desc, paginate
    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const total = results.length;
    const start = (filters.page - 1) * filters.limit;
    const data = results.slice(start, start + filters.limit);

    return { data, meta: { total, page: filters.page, limit: filters.limit, pages: Math.ceil(total / filters.limit) } };
  }

  // ══════════════════════════════════════════════
  // GET BY ID
  // ══════════════════════════════════════════════

  async findById(id: string) {
    // Try each table
    const consultation = await this.prisma.susConsultation.findUnique({ where: { id }, include: { unit: true } });
    if (consultation) {
      const consumptions = await this.prisma.susConsumption.findMany({
        where: { production_type: 'CONSULTA', production_id: id },
        include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
      });
      return { ...consultation, _type: 'CONSULTA', consumptions };
    }

    const exam = await this.prisma.susExam.findUnique({ where: { id }, include: { unit: true } });
    if (exam) {
      const consumptions = await this.prisma.susConsumption.findMany({
        where: { production_type: 'EXAME', production_id: id },
        include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
      });
      return { ...exam, _type: 'EXAME', consumptions };
    }

    const surgery = await this.prisma.susSurgery.findUnique({ where: { id }, include: { unit: true } });
    if (surgery) {
      const consumptions = await this.prisma.susConsumption.findMany({
        where: { production_type: 'CIRURGIA', production_id: id },
        include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
      });
      return { ...surgery, _type: 'CIRURGIA', consumptions };
    }

    throw new NotFoundException(`Produção ${id} não encontrada`);
  }

  // ══════════════════════════════════════════════
  // CREATE (DRAFT)
  // ══════════════════════════════════════════════

  async create(unitId: string, dto: CreateProductionDto) {
    await this.validateSusUnit(unitId);

    const baseDate = new Date(dto.date);
    const unitVal = dto.unit_value || 0;

    if (dto.type === 'CONSULTA') {
      return this.prisma.susConsultation.create({
        data: {
          unit_id: unitId, date: baseDate, month: dto.competence,
          doctor_name: dto.doctor_name, doctor_id: dto.doctor_id || null,
          secretary_id: dto.secretary_id || null,
          attendances: dto.attendances || 0, returns: dto.returns || 0,
          unit_value: unitVal, status: 'DRAFT',
        },
        include: { unit: { select: { id: true, name: true } } },
      }).then(r => ({ ...r, _type: 'CONSULTA' }));
    }

    if (dto.type === 'EXAME') {
      return this.prisma.susExam.create({
        data: {
          unit_id: unitId, date: baseDate, month: dto.competence,
          exam_type: dto.exam_type || 'Exame',
          doctor_name: dto.doctor_name, doctor_id: dto.doctor_id || null,
          quantity: dto.quantity || 1, unit_value: unitVal, status: 'DRAFT',
        },
        include: { unit: { select: { id: true, name: true } } },
      }).then(r => ({ ...r, _type: 'EXAME' }));
    }

    if (dto.type === 'CIRURGIA') {
      return this.prisma.susSurgery.create({
        data: {
          unit_id: unitId, date: baseDate, month: dto.competence,
          procedure_type: dto.procedure_type || 'Cirurgia',
          doctor_name: dto.doctor_name, doctor_id: dto.doctor_id || null,
          surgery_subtype: dto.surgery_subtype || null,
          quantity: dto.quantity || 1, unit_value: unitVal,
          technique: dto.technique || null, equipment: dto.equipment || null,
          status: 'DRAFT',
        },
        include: { unit: { select: { id: true, name: true } } },
      }).then(r => ({ ...r, _type: 'CIRURGIA' }));
    }

    throw new BadRequestException(`Tipo inválido: ${dto.type}`);
  }

  // ══════════════════════════════════════════════
  // UPDATE (DRAFT only)
  // ══════════════════════════════════════════════

  async update(id: string, dto: UpdateProductionDto) {
    const record = await this.findById(id);
    if (record.status !== 'DRAFT') throw new BadRequestException('Só é possível editar produção em DRAFT');

    if (record._type === 'CONSULTA') {
      return this.prisma.susConsultation.update({
        where: { id }, data: {
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.doctor_name && { doctor_name: dto.doctor_name }),
          ...(dto.doctor_id !== undefined && { doctor_id: dto.doctor_id }),
          ...(dto.secretary_id !== undefined && { secretary_id: dto.secretary_id }),
          ...(dto.attendances !== undefined && { attendances: dto.attendances }),
          ...(dto.returns !== undefined && { returns: dto.returns }),
          ...(dto.unit_value !== undefined && { unit_value: dto.unit_value }),
        },
      }).then(r => ({ ...r, _type: 'CONSULTA' }));
    }

    if (record._type === 'EXAME') {
      return this.prisma.susExam.update({
        where: { id }, data: {
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.doctor_name && { doctor_name: dto.doctor_name }),
          ...(dto.doctor_id !== undefined && { doctor_id: dto.doctor_id }),
          ...(dto.exam_type && { exam_type: dto.exam_type }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.unit_value !== undefined && { unit_value: dto.unit_value }),
        },
      }).then(r => ({ ...r, _type: 'EXAME' }));
    }

    if (record._type === 'CIRURGIA') {
      return this.prisma.susSurgery.update({
        where: { id }, data: {
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.doctor_name && { doctor_name: dto.doctor_name }),
          ...(dto.doctor_id !== undefined && { doctor_id: dto.doctor_id }),
          ...(dto.procedure_type && { procedure_type: dto.procedure_type }),
          ...(dto.surgery_subtype !== undefined && { surgery_subtype: dto.surgery_subtype }),
          ...(dto.quantity !== undefined && { quantity: dto.quantity }),
          ...(dto.unit_value !== undefined && { unit_value: dto.unit_value }),
          ...(dto.technique !== undefined && { technique: dto.technique }),
          ...(dto.equipment !== undefined && { equipment: dto.equipment }),
        },
      }).then(r => ({ ...r, _type: 'CIRURGIA' }));
    }

    throw new BadRequestException('Tipo desconhecido');
  }

  // ══════════════════════════════════════════════
  // CONSUMPTION (insumos)
  // ══════════════════════════════════════════════

  async addConsumption(productionId: string, dto: AddConsumptionDto) {
    const record = await this.findById(productionId);
    if (record.status !== 'DRAFT') throw new BadRequestException('Só é possível adicionar insumos em DRAFT');

    // Validate stock item exists
    const item = await this.prisma.stockItem.findUnique({ where: { id: dto.stock_item_id } });
    if (!item) throw new NotFoundException('Item de estoque não encontrado');

    return this.prisma.susConsumption.create({
      data: {
        production_type: record._type,
        production_id: productionId,
        stock_item_id: dto.stock_item_id,
        quantity: dto.quantity,
        lot: dto.lot || null,
        metadata: dto.metadata || null,
      },
      include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
    });
  }

  async updateConsumption(consumptionId: string, dto: UpdateConsumptionDto) {
    const consumption = await this.prisma.susConsumption.findUnique({ where: { id: consumptionId } });
    if (!consumption) throw new NotFoundException('Consumo não encontrado');

    // Verify production is still DRAFT
    const prod = await this.findById(consumption.production_id);
    if (prod.status !== 'DRAFT') throw new BadRequestException('Não é possível editar consumo de produção confirmada');

    return this.prisma.susConsumption.update({
      where: { id: consumptionId },
      data: {
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.lot !== undefined && { lot: dto.lot }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
      },
      include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
    });
  }

  async removeConsumption(consumptionId: string) {
    const consumption = await this.prisma.susConsumption.findUnique({ where: { id: consumptionId } });
    if (!consumption) throw new NotFoundException('Consumo não encontrado');

    const prod = await this.findById(consumption.production_id);
    if (prod.status !== 'DRAFT') throw new BadRequestException('Não é possível remover consumo de produção confirmada');

    await this.prisma.susConsumption.delete({ where: { id: consumptionId } });
    return { deleted: true };
  }

  // ══════════════════════════════════════════════
  // CONFIRM (stock + ledger)
  // ══════════════════════════════════════════════

  async confirm(productionId: string, userId: string) {
    const record = await this.findById(productionId);
    if (record.status !== 'DRAFT') throw new ConflictException('Produção já confirmada ou cancelada');

    const unitId = record.unit_id;
    const consumptions = record.consumptions || [];

    // ── Type-specific validations ──
    if (record._type === 'CONSULTA') {
      if (!record.doctor_name) throw new BadRequestException('Médico obrigatório para consulta');
      if ((record.attendances || 0) + (record.returns || 0) === 0) {
        throw new BadRequestException('Informe pelo menos 1 atendimento ou retorno');
      }
    }

    if (record._type === 'EXAME') {
      if (!record.doctor_name) throw new BadRequestException('Médico obrigatório para exame');
      if ((record.quantity || 0) < 1) throw new BadRequestException('Quantidade mínima: 1');
    }

    if (record._type === 'CIRURGIA') {
      if (!record.doctor_name) throw new BadRequestException('Médico obrigatório para cirurgia');
      if ((record.quantity || 0) < 1) throw new BadRequestException('Quantidade mínima: 1');

      const subtype = record.surgery_subtype;

      if (subtype === 'CATARATA') {
        const hasLens = consumptions.some(c => {
          const cat = c.stock_item?.category?.toUpperCase() || '';
          return cat.includes('LIO') || cat.includes('LENTE');
        });
        if (!hasLens) throw new BadRequestException('Catarata exige lente (LIO) como insumo obrigatório');
      }

      if (subtype === 'RETINA') {
        if (consumptions.length === 0) throw new BadRequestException('Retina exige pelo menos 1 insumo');
      }

      if (subtype === 'ANTI_VEGF') {
        const hasAntiVegf = consumptions.some(c => {
          const name = (c.stock_item?.name || '').toUpperCase();
          const cat = (c.stock_item?.category || '').toUpperCase();
          return name.includes('VEGF') || name.includes('LUCENTIS') || name.includes('AVASTIN')
            || name.includes('EYLEA') || cat.includes('ANTI-VEGF') || cat.includes('INJETÁVEL');
        });
        if (!hasAntiVegf) throw new BadRequestException('Anti-VEGF exige medicamento anti-VEGF como insumo');
      }
    }

    // ── Stock validation (check availability before transacting) ──
    for (const c of consumptions) {
      const levels = await this.prisma.stockLevel.findMany({
        where: { stock_item_id: c.stock_item_id, unit_id: unitId },
      });
      const available = levels.reduce((sum, l) => sum + l.quantity, 0);
      if (available < c.quantity) {
        throw new BadRequestException(
          `Estoque insuficiente para "${c.stock_item?.name}": disponível=${available}, necessário=${c.quantity}`,
        );
      }
    }

    // ── Execute in transaction ──
    return this.prisma.$transaction(async (tx) => {
      // 1. Stock movements (OUT) — using tx directly to avoid nested transactions
      for (const c of consumptions) {
        const absQty = c.quantity;
        const level = await tx.stockLevel.findFirst({
          where: { stock_item_id: c.stock_item_id, unit_id: unitId, ...(c.lot ? { lot: c.lot } : {}) },
        });

        if (!level || level.quantity < absQty) {
          throw new BadRequestException(
            `Estoque insuficiente para "${c.stock_item?.name}": disponível=${level?.quantity ?? 0}, necessário=${absQty}`,
          );
        }

        await tx.stockMovement.create({
          data: {
            stock_item_id: c.stock_item_id,
            unit_id: unitId,
            type: 'SAIDA',
            quantity: -absQty,
            lot: c.lot || null,
            operator_name: 'ABASUS-CONFIRM',
            reference: `ABASUS-${record._type}-${productionId.slice(0, 8)}`,
          },
        });

        await tx.stockLevel.update({
          where: { id: level.id },
          data: { quantity: { decrement: absQty } },
        });
      }

      // 2. Financial: LedgerEntry for SUS revenue (idempotent via unique source_type+source_id)
      const revenueAccountId = await this.findSusRevenueAccount(unitId);
      if (revenueAccountId) {
        const totalValue = this.calcTotalValue(record);
        if (totalValue > 0) {
          const existing = await tx.ledgerEntry.findUnique({
            where: { uq_ledger_source: { source_type: 'ABASUS_REVENUE', source_id: productionId } },
          });
          if (!existing) {
            await tx.ledgerEntry.create({
              data: {
                unit_id: unitId,
                unit_account_id: revenueAccountId,
                competence: record.month,
                entry_date: new Date(record.date),
                amount: totalValue,
                type: 'CREDIT',
                status: 'POSTED',
                source_type: 'ABASUS_REVENUE',
                source_id: productionId,
                description: `ABASUS ${record._type}: ${record.doctor_name}`,
                posted_by: userId,
              },
            });
          }
        }
      }

      // 3. Financial: LedgerEntry for insumo COST (DEBIT, idempotent via ABASUS_COST + productionId)
      const totalCost = consumptions.reduce((sum, c) => {
        const itemCost = Number(c.stock_item?.cost ?? 0);
        return sum + (c.quantity * itemCost);
      }, 0);

      if (totalCost > 0) {
        const costAccountId = await this.findSusCostAccount(unitId);
        if (!costAccountId) {
          throw new BadRequestException(
            'Conta contábil de custo de insumos SUS não configurada para unidade SUS. ' +
            'Crie uma UnitAccount vinculada a MasterAccount 4.1.01.001 (LIOs) ou outra conta CUSTO_SERVICO.',
          );
        }

        const existingCost = await tx.ledgerEntry.findUnique({
          where: { uq_ledger_source: { source_type: 'ABASUS_COST', source_id: productionId } },
        });
        if (!existingCost) {
          await tx.ledgerEntry.create({
            data: {
              unit_id: unitId,
              unit_account_id: costAccountId,
              competence: record.month,
              entry_date: new Date(record.date),
              amount: totalCost,
              type: 'DEBIT',
              status: 'POSTED',
              source_type: 'ABASUS_COST',
              source_id: productionId,
              description: `ABASUS CUSTO ${record._type}: ${record.doctor_name}`,
              posted_by: userId,
            },
          });
        }
      }

      // 4. Update status to CONFIRMED
      if (record._type === 'CONSULTA') {
        await tx.susConsultation.update({ where: { id: productionId }, data: { status: 'CONFIRMED' } });
      } else if (record._type === 'EXAME') {
        await tx.susExam.update({ where: { id: productionId }, data: { status: 'CONFIRMED' } });
      } else {
        await tx.susSurgery.update({ where: { id: productionId }, data: { status: 'CONFIRMED' } });
      }

      this.logger.log(`ABASUS: ${record._type} ${productionId} CONFIRMED — ${consumptions.length} consumptions, stock deducted${totalCost > 0 ? `, cost R$${totalCost.toFixed(2)}` : ''}`);
      return this.findById(productionId);
    });
  }

  // ══════════════════════════════════════════════
  // CANCEL
  // ══════════════════════════════════════════════

  async cancel(productionId: string) {
    const record = await this.findById(productionId);
    if (record.status === 'CANCELED') throw new BadRequestException('Já cancelada');
    if (record.status === 'CONFIRMED') {
      throw new BadRequestException('Produção confirmada não pode ser cancelada diretamente. Use estorno.');
    }

    if (record._type === 'CONSULTA') {
      await this.prisma.susConsultation.update({ where: { id: productionId }, data: { status: 'CANCELED' } });
    } else if (record._type === 'EXAME') {
      await this.prisma.susExam.update({ where: { id: productionId }, data: { status: 'CANCELED' } });
    } else {
      await this.prisma.susSurgery.update({ where: { id: productionId }, data: { status: 'CANCELED' } });
    }

    return { id: productionId, status: 'CANCELED' };
  }

  // ══════════════════════════════════════════════
  // SUMMARY (dashboard)
  // ══════════════════════════════════════════════

  async summary(unitId: string, competence: string) {
    await this.validateSusUnit(unitId);

    const [consultations, exams, surgeries] = await Promise.all([
      this.prisma.susConsultation.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' } }),
      this.prisma.susExam.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' } }),
      this.prisma.susSurgery.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' } }),
    ]);

    const totalConsultas = consultations.reduce((s, c) => s + c.attendances + c.returns, 0);
    const totalExames = exams.reduce((s, e) => s + e.quantity, 0);
    const totalCirurgias = surgeries.reduce((s, c) => s + c.quantity, 0);
    const valorConsultas = consultations.reduce((s, c) => s + Number(c.unit_value) * (c.attendances + c.returns), 0);
    const valorExames = exams.reduce((s, e) => s + Number(e.unit_value) * e.quantity, 0);
    const valorCirurgias = surgeries.reduce((s, c) => s + Number(c.unit_value) * c.quantity, 0);

    // Group surgeries by subtype
    const bySubtype: Record<string, { qty: number; value: number }> = {};
    for (const s of surgeries) {
      const key = s.surgery_subtype || 'OUTRO';
      if (!bySubtype[key]) bySubtype[key] = { qty: 0, value: 0 };
      bySubtype[key].qty += s.quantity;
      bySubtype[key].value += Number(s.unit_value) * s.quantity;
    }

    return {
      competence,
      consultas: { count: consultations.length, patients: totalConsultas, value: valorConsultas },
      exames: { count: exams.length, patients: totalExames, value: valorExames },
      cirurgias: { count: surgeries.length, patients: totalCirurgias, value: valorCirurgias, bySubtype },
      total: {
        records: consultations.length + exams.length + surgeries.length,
        patients: totalConsultas + totalExames + totalCirurgias,
        value: valorConsultas + valorExames + valorCirurgias,
      },
    };
  }

  // ══════════════════════════════════════════════
  // CONSUMPTION REPORT
  // ══════════════════════════════════════════════

  async consumptionReport(unitId: string, competence: string) {
    await this.validateSusUnit(unitId);

    // Get all confirmed productions for this competence
    const [consultIds, examIds, surgeryIds] = await Promise.all([
      this.prisma.susConsultation.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' }, select: { id: true } }),
      this.prisma.susExam.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' }, select: { id: true } }),
      this.prisma.susSurgery.findMany({ where: { unit_id: unitId, month: competence, status: 'CONFIRMED' }, select: { id: true } }),
    ]);

    const allIds = [
      ...consultIds.map(c => c.id),
      ...examIds.map(e => e.id),
      ...surgeryIds.map(s => s.id),
    ];

    const consumptions = await this.prisma.susConsumption.findMany({
      where: { production_id: { in: allIds } },
      include: { stock_item: { select: { id: true, sku: true, name: true, category: true, cost: true } } },
    });

    // Group by stock_item
    const grouped: Record<string, { item: any; totalQty: number; totalCost: number; productions: number }> = {};
    for (const c of consumptions) {
      const key = c.stock_item_id;
      if (!grouped[key]) {
        grouped[key] = { item: c.stock_item, totalQty: 0, totalCost: 0, productions: 0 };
      }
      grouped[key].totalQty += c.quantity;
      grouped[key].totalCost += c.quantity * Number(c.stock_item.cost);
      grouped[key].productions += 1;
    }

    return {
      competence,
      items: Object.values(grouped).sort((a, b) => b.totalCost - a.totalCost),
      totalCost: Object.values(grouped).reduce((s, g) => s + g.totalCost, 0),
      totalItems: consumptions.length,
    };
  }

  // ── Private helpers ──

  private calcTotalValue(record: any): number {
    if (record._type === 'CONSULTA') {
      return Number(record.unit_value || 0) * ((record.attendances || 0) + (record.returns || 0));
    }
    return Number(record.unit_value || 0) * (record.quantity || 0);
  }
}
