import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditHelper } from '../../common/helpers/audit.helper';
import {
  CreateLeadDto, UpdateLeadDto, ChangeStatusDto,
  RegisterContactDto, LeadFilterDto,
} from './dto';

@Injectable()
export class OrientacaoCirurgicaService {
  private readonly logger = new Logger(OrientacaoCirurgicaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditHelper,
  ) {}

  // ── Kanban (grouped by status) ──

  async getKanban(unitId: string) {
    const leads = await this.prisma.surgicalLead.findMany({
      where: { unit_id: unitId },
      include: {
        contacts: { orderBy: { date: 'desc' }, take: 1 },
        unit: { select: { name: true } },
      },
      orderBy: [{ score: 'desc' }, { updated_at: 'desc' }],
    });

    // Group by status for Kanban columns
    const columns: Record<string, typeof leads> = {
      PRIMEIRA: [], PROPENSO: [], INDECISO: [], RETORNO: [],
      PACIENTE: [], POS_OP: [], FECHOU: [], PERDIDO: [],
    };

    for (const lead of leads) {
      const col = columns[lead.status];
      if (col) col.push(lead);
    }

    // Summary stats
    const totalLeads = leads.length;
    const closedCount = columns.FECHOU.length;
    const conversionRate = totalLeads > 0
      ? Math.round((closedCount / totalLeads) * 100)
      : 0;

    return {
      columns,
      stats: {
        total: totalLeads,
        fechou: closedCount,
        perdido: columns.PERDIDO.length,
        em_pipeline: totalLeads - closedCount - columns.PERDIDO.length,
        conversion_rate_pct: conversionRate,
      },
    };
  }

  // ── List with filters + pagination ──

  async findAll(unitId: string, filters: LeadFilterDto) {
    const where: Prisma.SurgicalLeadWhereInput = {
      unit_id: unitId,
    };

    if (filters.status) where.status = filters.status;
    if (filters.pathology) {
      where.pathology = { contains: filters.pathology, mode: 'insensitive' };
    }
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { cpf: { contains: filters.search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.surgicalLead.findMany({
        where,
        include: {
          contacts: { orderBy: { date: 'desc' }, take: 1 },
          unit: { select: { name: true } },
        },
        orderBy: { updated_at: 'desc' },
        skip: ((filters.page || 1) - 1) * (filters.limit || 50),
        take: filters.limit || 50,
      }),
      this.prisma.surgicalLead.count({ where }),
    ]);

    return { data, total, page: filters.page || 1, limit: filters.limit || 50 };
  }

  // ── Get single lead with full timeline ──

  async findById(id: string, unitId: string) {
    const lead = await this.prisma.surgicalLead.findFirst({
      where: { id, unit_id: unitId },
      include: {
        contacts: { orderBy: { date: 'desc' } },
        unit: { select: { name: true } },
        patient: { select: { id: true, name: true, cpf: true } },
      },
    });

    if (!lead) throw new NotFoundException(`Lead ${id} não encontrado`);
    return lead;
  }

  // ── Create ──

  async create(unitId: string, dto: CreateLeadDto) {
    // Calculate initial score
    const score = this.calculateScore(dto);

    return this.prisma.surgicalLead.create({
      data: {
        unit_id: unitId,
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        cpf: dto.cpf,
        pathology: dto.pathology,
        procedure: dto.procedure,
        eye: dto.eye,
        status: dto.status || 'PRIMEIRA',
        score,
        interest: dto.interest,
        barriers: dto.barriers || [],
        has_insurance: dto.has_insurance || false,
        insurance_name: dto.insurance_name,
        desired_timeframe: dto.desired_timeframe,
        notes: dto.notes,
        responsavel: dto.responsavel,
        indication_date: dto.indication_date ? new Date(dto.indication_date) : null,
        next_followup: dto.next_followup ? new Date(dto.next_followup) : null,
      },
      include: { unit: { select: { name: true } } },
    });
  }

  // ── Update ──

  async update(id: string, unitId: string, dto: UpdateLeadDto) {
    await this.ensureExists(id, unitId);

    const data: any = { ...dto };
    if (dto.indication_date) data.indication_date = new Date(dto.indication_date);
    if (dto.next_followup) data.next_followup = new Date(dto.next_followup);

    // Recalculate score if relevant fields changed
    if (dto.interest || dto.barriers || dto.has_insurance || dto.desired_timeframe) {
      const current = await this.prisma.surgicalLead.findUnique({ where: { id } });
      data.score = this.calculateScore({ ...current, ...dto } as any);
    }

    return this.prisma.surgicalLead.update({
      where: { id },
      data,
      include: { contacts: { orderBy: { date: 'desc' }, take: 3 } },
    });
  }

  // ── Change Status (explicit endpoint for Kanban drag) ──

  async changeStatus(id: string, unitId: string, dto: ChangeStatusDto, userId?: string) {
    const current = await this.prisma.surgicalLead.findFirst({
      where: { id, unit_id: unitId },
      select: { id: true, status: true, lost_reason: true },
    });
    if (!current) throw new NotFoundException(`Lead ${id} não encontrado`);

    if (dto.status === 'PERDIDO' && !dto.lost_reason) {
      throw new BadRequestException('Motivo de perda obrigatório ao marcar como PERDIDO');
    }

    const updated = await this.prisma.surgicalLead.update({
      where: { id },
      data: {
        status: dto.status,
        lost_reason: dto.lost_reason || undefined,
      },
    });

    // Structured audit: status change
    await this.audit.logChange({
      entity: 'surgical_lead',
      entity_id: id,
      action: 'STATUS_CHANGE',
      user_id: userId || 'system',
      unit_id: unitId,
      before: { status: current.status, lost_reason: current.lost_reason },
      after: { status: dto.status, lost_reason: dto.lost_reason || null },
    });

    return updated;
  }

  // ── Register Contact / Follow-up ──

  async registerContact(leadId: string, unitId: string, dto: RegisterContactDto) {
    await this.ensureExists(leadId, unitId);

    const contact = await this.prisma.leadContact.create({
      data: {
        lead_id: leadId,
        date: new Date(),
        contacted_by: dto.contacted_by,
        channel: dto.channel,
        result: dto.result,
        notes: dto.notes,
        scheduled_surgery_date: dto.scheduled_surgery_date
          ? new Date(dto.scheduled_surgery_date)
          : null,
      },
    });

    // Update lead's last contact timestamp
    await this.prisma.surgicalLead.update({
      where: { id: leadId },
      data: { last_contact_at: new Date() },
    });

    return contact;
  }

  // ── Schedule Follow-up ──

  async scheduleFollowup(leadId: string, unitId: string, date: string) {
    await this.ensureExists(leadId, unitId);

    return this.prisma.surgicalLead.update({
      where: { id: leadId },
      data: { next_followup: new Date(date) },
    });
  }

  // ── Funnel Stats (for BI) ──

  async getFunnelStats(unitId: string) {
    const stats = await this.prisma.surgicalLead.groupBy({
      by: ['status', 'pathology'],
      where: { unit_id: unitId },
      _count: true,
      _avg: { score: true },
    });

    return stats.map((s) => ({
      status: s.status,
      pathology: s.pathology,
      count: s._count,
      avg_score: Math.round(s._avg.score || 0),
    }));
  }

  // ── Overdue follow-ups (for CRON) ──

  async getOverdueFollowups(daysThreshold: number = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    return this.prisma.surgicalLead.findMany({
      where: {
        status: { notIn: ['FECHOU', 'PERDIDO'] },
        OR: [
          { next_followup: { lte: new Date() } },
          { last_contact_at: { lte: cutoff } },
          { last_contact_at: null },
        ],
      },
      include: {
        unit: { select: { name: true } },
        contacts: { orderBy: { date: 'desc' }, take: 1 },
      },
      orderBy: [{ score: 'desc' }, { last_contact_at: 'asc' }],
    });
  }

  // ── Private helpers ──

  private async ensureExists(id: string, unitId: string) {
    const lead = await this.prisma.surgicalLead.findFirst({
      where: { id, unit_id: unitId },
      select: { id: true },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} não encontrado`);
  }

  /**
   * Score calculation (0-50):
   *  - interest: alto=15, medio=10, baixo=5
   *  - has_insurance: +10
   *  - desired_timeframe: 0-30=15, 30-60=10, 60+=5
   *  - barriers: -2 per barrier (min 0)
   */
  private calculateScore(data: Partial<CreateLeadDto>): number {
    let score = 0;

    const interestMap: Record<string, number> = { alto: 15, medio: 10, baixo: 5 };
    score += interestMap[data.interest || ''] || 0;

    if (data.has_insurance) score += 10;

    const timeframeMap: Record<string, number> = { '0-30': 15, '30-60': 10, '60+': 5 };
    score += timeframeMap[data.desired_timeframe || ''] || 0;

    const barrierPenalty = (data.barriers?.length || 0) * 2;
    score = Math.max(0, score - barrierPenalty);

    return Math.min(50, score);
  }
}
