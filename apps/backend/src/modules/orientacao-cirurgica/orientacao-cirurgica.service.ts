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

// ── Score factors interface ──
interface ScoreFactors {
  interest: number;         // alto:+25, medio:+15, baixo:+5, null:0
  insurance: number;        // has_insurance:+10
  timeframe: number;        // 0-30:+20, 31-90:+10, 90+:0
  had_return: number;       // +10
  contact_recency: number;  // <30d:+5, 30-90d:0, >90d:-10, no contact:-5
  barriers_price: number;   // Preço:-15
  barriers_fear: number;    // Medo:-10
  barriers_other: number;   // -3 per other barrier (max -9)
  total: number;
}

@Injectable()
export class OrientacaoCirurgicaService {
  private readonly logger = new Logger(OrientacaoCirurgicaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditHelper,
  ) {}

  // ── Kanban (grouped by status) ──

  async getKanban(unitId: string) {
    const where: Prisma.SurgicalLeadWhereInput = {};
    if (unitId && unitId !== 'all') where.unit_id = unitId;

    const leads = await this.prisma.surgicalLead.findMany({
      where,
      include: {
        contacts: { orderBy: { date: 'desc' }, take: 1 },
        unit: { select: { name: true } },
      },
      orderBy: [{ score: 'desc' }, { updated_at: 'desc' }],
    });

    const columns: Record<string, typeof leads> = {
      PRIMEIRA: [], PROPENSO: [], INDECISO: [], RETORNO: [],
      PACIENTE: [], POS_OP: [], FECHOU: [], PERDIDO: [],
    };

    for (const lead of leads) {
      const col = columns[lead.status];
      if (col) col.push(lead);
    }

    const totalLeads = leads.length;
    const closedCount = columns.FECHOU.length;
    const conversionRate = totalLeads > 0
      ? Math.round((closedCount / totalLeads) * 100) : 0;

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
    const where: Prisma.SurgicalLeadWhereInput = {};
    if (unitId && unitId !== 'all') where.unit_id = unitId;

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
    const where: Prisma.SurgicalLeadWhereInput = { id };
    if (unitId && unitId !== 'all') where.unit_id = unitId;

    const lead = await this.prisma.surgicalLead.findFirst({
      where,
      include: {
        contacts: { orderBy: { date: 'desc' } },
        unit: { select: { name: true } },
        patient: { select: { id: true, name: true, cpf: true } },
      },
    });

    if (!lead) throw new NotFoundException(`Lead ${id} não encontrado`);

    // Recompute score breakdown for display (factors may have changed over time)
    const { score, factors } = this.computeScore(lead as any);
    return { ...lead, score, score_factors_json: factors };
  }

  // ── Create ──

  async create(unitId: string, dto: CreateLeadDto) {
    const { score, factors } = this.computeScore(dto as any);

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
        score_factors_json: factors as any,
        interest: dto.interest,
        barriers: dto.barriers || [],
        has_insurance: dto.has_insurance || false,
        insurance_name: dto.insurance_name,
        had_return: (dto as any).had_return || false,
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
    if (dto.interest !== undefined || dto.barriers !== undefined ||
        dto.has_insurance !== undefined || dto.desired_timeframe !== undefined ||
        (dto as any).had_return !== undefined) {
      const current = await this.prisma.surgicalLead.findUnique({ where: { id } });
      const merged = { ...current, ...dto };
      const { score, factors } = this.computeScore(merged as any);
      data.score = score;
      data.score_factors_json = factors;
    }

    return this.prisma.surgicalLead.update({
      where: { id },
      data,
      include: { contacts: { orderBy: { date: 'desc' }, take: 3 } },
    });
  }

  // ── Change Status ──

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

  // ── Register Contact ──

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
          ? new Date(dto.scheduled_surgery_date) : null,
      },
    });

    // Update last_contact_at and recalculate score (contact recency changed)
    const current = await this.prisma.surgicalLead.findUnique({ where: { id: leadId } });
    if (current) {
      const updated = { ...current, last_contact_at: new Date() };
      const { score, factors } = this.computeScore(updated as any);
      await this.prisma.surgicalLead.update({
        where: { id: leadId },
        data: { last_contact_at: new Date(), score, score_factors_json: factors as any },
      });
    }

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

  // ── Call Queue (server-side, date-filtered) ──

  async getCallQueue(unitId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const where: Prisma.SurgicalLeadWhereInput = {
      status: { notIn: ['FECHOU', 'PERDIDO'] },
    };
    if (unitId && unitId !== 'all') where.unit_id = unitId;

    const cutoff90 = new Date();
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);

    // Include leads that:
    // 1. Have next_followup <= today
    // 2. Have no contact in 30+ days
    // 3. Have never been contacted
    where.OR = [
      { next_followup: { lte: nextDay } },
      { last_contact_at: { lte: cutoff30 } },
      { last_contact_at: null },
    ];

    const leads = await this.prisma.surgicalLead.findMany({
      where,
      include: {
        contacts: { orderBy: { date: 'desc' }, take: 1 },
        unit: { select: { name: true } },
      },
      orderBy: [{ score: 'desc' }, { next_followup: 'asc' }],
      take: 100,
    });

    const now = new Date();
    return leads.map((lead) => {
      const lastContact = lead.last_contact_at;
      const daysSinceContact = lastContact
        ? Math.floor((now.getTime() - lastContact.getTime()) / 86400000) : null;
      const followupOverdue = lead.next_followup && lead.next_followup < now;
      const followupDaysOverdue = followupOverdue
        ? Math.floor((now.getTime() - lead.next_followup!.getTime()) / 86400000) : 0;

      let urgency: 'critical' | 'warning' | 'ok' = 'ok';
      if (daysSinceContact === null || daysSinceContact > 30 || followupDaysOverdue > 7) {
        urgency = 'critical';
      } else if (followupOverdue || (daysSinceContact !== null && daysSinceContact > 7)) {
        urgency = 'warning';
      }

      return {
        ...lead,
        days_since_contact: daysSinceContact,
        followup_overdue_days: followupDaysOverdue,
        urgency,
      };
    });
  }

  // ── Analytics / KPIs ──

  async getAnalytics(unitId: string) {
    const where: Prisma.SurgicalLeadWhereInput = {};
    if (unitId && unitId !== 'all') where.unit_id = unitId;

    const [allLeads, byStatus, byPathology] = await Promise.all([
      this.prisma.surgicalLead.findMany({
        where,
        select: {
          id: true, status: true, pathology: true, score: true,
          created_at: true, updated_at: true, last_contact_at: true,
          next_followup: true, lost_reason: true, indication_date: true,
        },
      }),
      this.prisma.surgicalLead.groupBy({
        by: ['status'],
        where,
        _count: true,
        _avg: { score: true },
      }),
      this.prisma.surgicalLead.groupBy({
        by: ['pathology', 'status'],
        where,
        _count: true,
      }),
    ]);

    const total = allLeads.length;
    const fechou = allLeads.filter((l) => l.status === 'FECHOU').length;
    const perdido = allLeads.filter((l) => l.status === 'PERDIDO').length;
    const pipeline = total - fechou - perdido;

    const now = new Date();

    // Overdue: no contact in 30+ days and not terminal
    const overdue = allLeads.filter((l) => {
      if (l.status === 'FECHOU' || l.status === 'PERDIDO') return false;
      const ds = l.last_contact_at
        ? Math.floor((now.getTime() - l.last_contact_at.getTime()) / 86400000)
        : null;
      return ds === null || ds > 30;
    }).length;

    // Followup overdue
    const followupOverdue = allLeads.filter((l) => {
      if (l.status === 'FECHOU' || l.status === 'PERDIDO') return false;
      return l.next_followup && l.next_followup < now;
    }).length;

    // Average days to close (for FECHOU leads)
    const closedLeads = allLeads.filter((l) => l.status === 'FECHOU' && l.indication_date);
    const avgDaysToClose = closedLeads.length > 0
      ? Math.round(
          closedLeads.reduce((sum, l) => {
            const days = Math.floor(
              (l.updated_at.getTime() - (l.indication_date?.getTime() || l.created_at.getTime())) / 86400000,
            );
            return sum + Math.max(0, days);
          }, 0) / closedLeads.length,
        ) : null;

    // Lost reasons (Pareto)
    const lostReasonMap: Record<string, number> = {};
    for (const l of allLeads.filter((l) => l.status === 'PERDIDO' && l.lost_reason)) {
      const reason = l.lost_reason!;
      lostReasonMap[reason] = (lostReasonMap[reason] || 0) + 1;
    }
    const lostReasons = Object.entries(lostReasonMap)
      .map(([reason, count]) => ({ reason, count, pct: total > 0 ? Math.round((count / perdido) * 100) : 0 }))
      .sort((a, b) => b.count - a.count);

    // Pathology breakdown
    const pathGroups: Record<string, { total: number; fechou: number; perdido: number; pipeline: number }> = {};
    for (const l of allLeads) {
      const key = l.pathology;
      if (!pathGroups[key]) pathGroups[key] = { total: 0, fechou: 0, perdido: 0, pipeline: 0 };
      pathGroups[key].total++;
      if (l.status === 'FECHOU') pathGroups[key].fechou++;
      else if (l.status === 'PERDIDO') pathGroups[key].perdido++;
      else pathGroups[key].pipeline++;
    }
    const pathologyBreakdown = Object.entries(pathGroups).map(([pathology, counts]) => ({
      pathology,
      ...counts,
      conversion_pct: counts.total > 0 ? Math.round((counts.fechou / counts.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    return {
      summary: {
        total, fechou, perdido, pipeline,
        conversion_pct: total > 0 ? Math.round((fechou / total) * 100) : 0,
        overdue_contacts: overdue,
        followup_overdue: followupOverdue,
        avg_days_to_close: avgDaysToClose,
      },
      by_status: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
        avg_score: Math.round(s._avg.score || 0),
      })),
      pathology_breakdown: pathologyBreakdown,
      lost_reasons: lostReasons,
    };
  }

  // ── Funnel Stats ──

  async getFunnelStats(unitId: string) {
    const where: Prisma.SurgicalLeadWhereInput = {};
    if (unitId && unitId !== 'all') where.unit_id = unitId;

    const stats = await this.prisma.surgicalLead.groupBy({
      by: ['status', 'pathology'],
      where,
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
    const where: Prisma.SurgicalLeadWhereInput = { id };
    if (unitId && unitId !== 'all') where.unit_id = unitId;
    const lead = await this.prisma.surgicalLead.findFirst({ where, select: { id: true } });
    if (!lead) throw new NotFoundException(`Lead ${id} não encontrado`);
  }

  /**
   * Score 0–100 with configurable weights.
   *
   * Factors:
   *   interest:       alto +25 | medio +15 | baixo +5 | null 0
   *   timeframe:      0-30 +20 | 31-90 +10 | 90+ 0
   *   had_return:     +10
   *   contact_recent: last<30d +5 | 30-90d 0 | >90d -10 | never -5
   *   insurance:      +10
   *   barrier_preco:  -15
   *   barrier_medo:   -10
   *   barriers_other: -3 each (max -9)
   *
   * Max positive: 25+20+10+5+10 = 70 → clamped to 100
   */
  computeScore(data: {
    interest?: string | null;
    desired_timeframe?: string | null;
    had_return?: boolean;
    last_contact_at?: Date | null;
    has_insurance?: boolean;
    barriers?: string[];
  }): { score: number; factors: ScoreFactors } {
    const factors: ScoreFactors = {
      interest: 0,
      insurance: 0,
      timeframe: 0,
      had_return: 0,
      contact_recency: 0,
      barriers_price: 0,
      barriers_fear: 0,
      barriers_other: 0,
      total: 0,
    };

    // Interest
    const interestMap: Record<string, number> = { alto: 25, medio: 15, baixo: 5 };
    factors.interest = interestMap[data.interest || ''] || 0;

    // Timeframe
    const timeframeMap: Record<string, number> = { '0-30': 20, '31-90': 10, '30-60': 10, '60+': 0, '90+': 0 };
    factors.timeframe = timeframeMap[data.desired_timeframe || ''] || 0;

    // Had return
    factors.had_return = data.had_return ? 10 : 0;

    // Contact recency
    if (data.last_contact_at) {
      const days = Math.floor((Date.now() - data.last_contact_at.getTime()) / 86400000);
      if (days < 30) factors.contact_recency = 5;
      else if (days <= 90) factors.contact_recency = 0;
      else factors.contact_recency = -10;
    } else {
      factors.contact_recency = -5; // never contacted
    }

    // Insurance
    factors.insurance = data.has_insurance ? 10 : 0;

    // Barriers
    const barriers = data.barriers || [];
    const hasPrice = barriers.some((b) => b.toLowerCase().includes('preç') || b.toLowerCase() === 'preço');
    const hasFear = barriers.some((b) => b.toLowerCase() === 'medo');
    factors.barriers_price = hasPrice ? -15 : 0;
    factors.barriers_fear = hasFear ? -10 : 0;
    const otherBarrierCount = barriers.filter(
      (b) => !b.toLowerCase().includes('preç') && b.toLowerCase() !== 'medo',
    ).length;
    factors.barriers_other = Math.max(-9, otherBarrierCount * -3);

    // Total (clamped 0-100)
    const raw =
      factors.interest + factors.timeframe + factors.had_return +
      factors.contact_recency + factors.insurance +
      factors.barriers_price + factors.barriers_fear + factors.barriers_other;

    factors.total = Math.min(100, Math.max(0, raw));

    return { score: factors.total, factors };
  }
}
