// apps/backend/src/modules/abasus/repasse.service.ts
import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceiroService } from '../financeiro/financeiro.service';

export interface BreakdownItem { qty: number; unit_value: number; total: number; }
type Breakdown = Record<string, BreakdownItem>;

interface EmployeeAccum {
  employee_id: string;
  employee_name: string;
  role: 'DOCTOR' | 'SECRETARY';
  breakdown: Breakdown;
  total: number;
}

export interface MissingRule { procedure_key: string; role: string; qty: number; }
export interface SemVinculo { type: string; id: string; doctor_name: string; qty: number; }

@Injectable()
export class RepasseService {
  private readonly logger = new Logger(RepasseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
  ) {}

  // ══════════════════════════════════════════════
  // RULES CRUD
  // ══════════════════════════════════════════════

  async listRules(filters: { search?: string; active?: string; unitId?: string }) {
    const where: any = {};
    if (filters.unitId) where.unit_id = filters.unitId;
    if (filters.active === 'true') where.is_active = true;
    if (filters.active === 'false') where.is_active = false;
    if (filters.search) {
      where.OR = [
        { procedure_key: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.susRepasseRule.findMany({
      where,
      include: { unit: { select: { id: true, name: true } } },
      orderBy: [{ procedure_key: 'asc' }, { role: 'asc' }, { valid_from: 'desc' }],
    });
  }

  async createRule(data: {
    unit_id: string; procedure_key: string; role: string;
    unit_value: number; valid_from: string; valid_to?: string;
    description?: string;
  }) {
    await this.validateSusUnit(data.unit_id);
    return this.prisma.susRepasseRule.create({
      data: {
        unit_id: data.unit_id,
        procedure_key: data.procedure_key.toUpperCase(),
        role: data.role.toUpperCase(),
        unit_value: data.unit_value,
        valid_from: new Date(data.valid_from),
        valid_to: data.valid_to ? new Date(data.valid_to) : null,
        description: data.description || null,
      },
      include: { unit: { select: { id: true, name: true } } },
    });
  }

  async updateRule(id: string, data: {
    unit_value?: number; valid_from?: string; valid_to?: string | null;
    is_active?: boolean; description?: string;
  }) {
    const rule = await this.prisma.susRepasseRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Regra não encontrada');
    return this.prisma.susRepasseRule.update({
      where: { id },
      data: {
        ...(data.unit_value !== undefined && { unit_value: data.unit_value }),
        ...(data.valid_from && { valid_from: new Date(data.valid_from) }),
        ...(data.valid_to !== undefined && { valid_to: data.valid_to ? new Date(data.valid_to) : null }),
        ...(data.is_active !== undefined && { is_active: data.is_active }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: { unit: { select: { id: true, name: true } } },
    });
  }

  // ══════════════════════════════════════════════
  // PREVIEW (read-only — no writes)
  // ══════════════════════════════════════════════

  async preview(unitId: string, competence: string) {
    await this.validateSusUnit(unitId);

    // Check if already run
    const existingRuns = await this.prisma.susRepasseRun.findMany({
      where: { unit_id: unitId, competence },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        payable: { select: { id: true, status: true, value: true } },
      },
    });

    if (existingRuns.length > 0) {
      return {
        competence,
        status: 'ALREADY_RUN',
        runs: existingRuns.map(r => ({
          id: r.id, employee_id: r.employee_id, employee_name: r.employee_name,
          role: r.role, total_value: Number(r.total_value),
          breakdown: JSON.parse(r.breakdown),
          payable_id: r.payable_id, payable: r.payable,
        })),
        missingRules: [],
        semVinculo: [],
        totalRepasse: existingRuns.reduce((s, r) => s + Number(r.total_value), 0),
      };
    }

    const { employees, missingRules, semVinculo } = await this.calculate(unitId, competence);

    return {
      competence,
      status: 'PREVIEW',
      runs: employees.map(e => ({
        employee_id: e.employee_id, employee_name: e.employee_name,
        role: e.role, total_value: e.total, breakdown: e.breakdown,
        payable_id: null, payable: null,
      })),
      missingRules,
      semVinculo,
      totalRepasse: employees.reduce((s, e) => s + e.total, 0),
    };
  }

  // ══════════════════════════════════════════════
  // RUN (calculate + persist + create Payables)
  // ══════════════════════════════════════════════

  async run(unitId: string, competence: string, userId: string) {
    await this.validateSusUnit(unitId);

    // ── IDEMPOTENCY: check unique constraint ──
    const existingRuns = await this.prisma.susRepasseRun.findMany({
      where: { unit_id: unitId, competence },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        payable: { select: { id: true, status: true, value: true } },
      },
    });

    if (existingRuns.length > 0) {
      this.logger.warn(`Repasse ${competence} already executed — returning existing`);
      return {
        competence,
        status: 'ALREADY_EXISTS',
        message: `Repasses de ${competence} já calculados. Retornando resultado existente.`,
        runs: existingRuns.map(r => ({
          id: r.id, employee_id: r.employee_id, employee_name: r.employee_name,
          role: r.role, total_value: Number(r.total_value),
          breakdown: JSON.parse(r.breakdown),
          payable_id: r.payable_id, payable: r.payable,
        })),
        missingRules: [],
        semVinculo: [],
        totalRepasse: existingRuns.reduce((s, r) => s + Number(r.total_value), 0),
        payablesCreated: existingRuns.filter(r => r.payable_id).length,
      };
    }

    // ── Calculate ──
    const { employees, missingRules, semVinculo } = await this.calculate(unitId, competence);

    if (employees.length === 0) {
      return {
        competence,
        status: 'NO_DATA',
        message: 'Nenhuma produção confirmada com doctor_id vinculado nesta competência.',
        runs: [],
        missingRules,
        semVinculo,
        totalRepasse: 0,
        payablesCreated: 0,
      };
    }

    // ── Find despesa account for repasse ──
    const repasseAccountId = await this.findRepasseDespesaAccount(unitId);
    if (!repasseAccountId) {
      throw new BadRequestException(
        'Conta contábil de despesa de repasse não configurada para unidade SUS. ' +
        'Crie uma UnitAccount vinculada a MasterAccount 4.1.03 (Honorários Médicos) ou 4.2.01 (Salários) para a unidade SUS.',
      );
    }

    // ── Persist ──
    const results: any[] = [];

    for (const emp of employees) {
      const supplier = await this.ensureSupplier(emp.employee_name);

      const [year, month] = competence.split('-').map(Number);
      const dueDate = new Date(year, month, 5); // 5th of next month

      const roleLabel = emp.role === 'DOCTOR' ? 'Médico' : 'Secretária';
      const payable = await this.financeiro.createPayable(unitId, {
        supplier_id: supplier.id,
        unit_account_id: repasseAccountId,
        description: `Repasse SUS ${competence} — ${emp.employee_name} — ${roleLabel}`,
        competence,
        due_date: dueDate.toISOString().split('T')[0],
        value: emp.total,
        payment_method: 'TRANSFERENCIA',
      });

      const run = await this.prisma.susRepasseRun.create({
        data: {
          unit_id: unitId,
          competence,
          employee_id: emp.employee_id,
          employee_name: emp.employee_name,
          role: emp.role,
          total_value: emp.total,
          breakdown: JSON.stringify(emp.breakdown),
          payable_id: payable.id,
          status: 'GENERATED',
        },
        include: {
          employee: { select: { id: true, name: true, role: true } },
          payable: { select: { id: true, status: true, value: true } },
        },
      });

      results.push({
        id: run.id, employee_id: run.employee_id, employee_name: run.employee_name,
        role: run.role, total_value: Number(run.total_value),
        breakdown: emp.breakdown,
        payable_id: run.payable_id, payable: run.payable,
      });

      this.logger.log(`Repasse: ${emp.employee_name} (${emp.role}) → R$ ${emp.total.toFixed(2)} → Payable ${payable.id}`);
    }

    return {
      competence,
      status: 'CREATED',
      runs: results,
      missingRules,
      semVinculo,
      totalRepasse: employees.reduce((s, e) => s + e.total, 0),
      payablesCreated: results.length,
    };
  }

  // ══════════════════════════════════════════════
  // CALCULATION ENGINE
  // ══════════════════════════════════════════════

  private async calculate(unitId: string, competence: string) {
    const [consultations, exams, surgeries] = await Promise.all([
      this.prisma.susConsultation.findMany({
        where: { unit_id: unitId, month: competence, status: 'CONFIRMED' },
      }),
      this.prisma.susExam.findMany({
        where: { unit_id: unitId, month: competence, status: 'CONFIRMED' },
      }),
      this.prisma.susSurgery.findMany({
        where: { unit_id: unitId, month: competence, status: 'CONFIRMED' },
      }),
    ]);

    // Load active rules covering this competence
    const [cYear, cMonth] = competence.split('-').map(Number);
    const compStart = new Date(cYear, cMonth - 1, 1);
    const compEnd = new Date(cYear, cMonth, 0);

    const rules = await this.prisma.susRepasseRule.findMany({
      where: {
        unit_id: unitId,
        is_active: true,
        valid_from: { lte: compEnd },
        OR: [{ valid_to: null }, { valid_to: { gte: compStart } }],
      },
      orderBy: { valid_from: 'desc' },
    });

    const findRule = (key: string, role: string) =>
      rules.find(r => r.procedure_key === key && r.role === role) || null;

    const accum = new Map<string, EmployeeAccum>();
    const missingRules: MissingRule[] = [];
    const semVinculo: SemVinculo[] = [];
    const missingSet = new Set<string>();

    const getAccum = (empId: string, empName: string, role: 'DOCTOR' | 'SECRETARY'): EmployeeAccum => {
      const key = `${empId}:${role}`;
      if (!accum.has(key)) accum.set(key, { employee_id: empId, employee_name: empName, role, breakdown: {}, total: 0 });
      return accum.get(key)!;
    };

    const addBreakdown = (emp: EmployeeAccum, procKey: string, qty: number, unitVal: number) => {
      if (!emp.breakdown[procKey]) emp.breakdown[procKey] = { qty: 0, unit_value: unitVal, total: 0 };
      emp.breakdown[procKey].qty += qty;
      emp.breakdown[procKey].total += qty * unitVal;
      emp.total += qty * unitVal;
    };

    const registerMissing = (procKey: string, role: string, qty: number) => {
      const mk = `${procKey}::${role}`;
      if (!missingSet.has(mk)) { missingSet.add(mk); missingRules.push({ procedure_key: procKey, role, qty: 0 }); }
      missingRules.find(m => m.procedure_key === procKey && m.role === role)!.qty += qty;
    };

    // ── CONSULTAS ──
    for (const c of consultations) {
      const qty = c.attendances + c.returns;
      if (qty === 0) continue;

      if (!c.doctor_id) {
        semVinculo.push({ type: 'CONSULTA', id: c.id, doctor_name: c.doctor_name, qty });
        continue;
      }

      const docRule = findRule('CONSULTA', 'DOCTOR');
      if (docRule) {
        addBreakdown(getAccum(c.doctor_id, c.doctor_name, 'DOCTOR'), 'CONSULTA', qty, Number(docRule.unit_value));
      } else {
        registerMissing('CONSULTA', 'DOCTOR', qty);
      }

      if (c.secretary_id) {
        const secRule = findRule('CONSULTA', 'SECRETARY');
        if (secRule) {
          const sec = await this.prisma.employee.findUnique({ where: { id: c.secretary_id }, select: { id: true, name: true } });
          if (sec) addBreakdown(getAccum(sec.id, sec.name, 'SECRETARY'), 'CONSULTA', qty, Number(secRule.unit_value));
        }
        // secretary rule missing is non-blocking (optional)
      }
    }

    // ── EXAMES ──
    for (const e of exams) {
      if (e.quantity === 0) continue;
      if (!e.doctor_id) {
        semVinculo.push({ type: 'EXAME', id: e.id, doctor_name: e.doctor_name, qty: e.quantity });
        continue;
      }
      const specificKey = `EXAME:${(e.exam_type || 'GERAL').toUpperCase()}`;
      const rule = findRule(specificKey, 'DOCTOR') || findRule('EXAME', 'DOCTOR');
      if (rule) {
        addBreakdown(getAccum(e.doctor_id, e.doctor_name, 'DOCTOR'), specificKey, e.quantity, Number(rule.unit_value));
      } else {
        registerMissing(specificKey, 'DOCTOR', e.quantity);
      }
    }

    // ── CIRURGIAS ──
    for (const s of surgeries) {
      if (s.quantity === 0) continue;
      if (!s.doctor_id) {
        semVinculo.push({ type: 'CIRURGIA', id: s.id, doctor_name: s.doctor_name, qty: s.quantity });
        continue;
      }
      const subtype = (s.surgery_subtype || 'GERAL').toUpperCase();
      const specificKey = `CIRURGIA:${subtype}`;
      const rule = findRule(specificKey, 'DOCTOR') || findRule('CIRURGIA', 'DOCTOR');
      if (rule) {
        addBreakdown(getAccum(s.doctor_id, s.doctor_name, 'DOCTOR'), specificKey, s.quantity, Number(rule.unit_value));
      } else {
        registerMissing(specificKey, 'DOCTOR', s.quantity);
      }
    }

    return {
      employees: Array.from(accum.values()).filter(e => e.total > 0),
      missingRules,
      semVinculo,
    };
  }

  // ══════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════

  private async validateSusUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw new NotFoundException('Unidade não encontrada');
    if (!unit.name.toUpperCase().includes('SUS'))
      throw new BadRequestException('Operação restrita à unidade SUS');
    return unit;
  }

  private async findRepasseDespesaAccount(unitId: string): Promise<string | null> {
    for (const code of ['4.1.03', '4.2.01']) {
      const ua = await this.prisma.unitAccount.findFirst({
        where: { unit_id: unitId, master_account: { code } },
      });
      if (ua) return ua.id;
    }
    const fallback = await this.prisma.unitAccount.findFirst({
      where: { unit_id: unitId, master_account: { nature: 'DESPESA', is_group: false } },
    });
    return fallback?.id || null;
  }

  private async ensureSupplier(employeeName: string) {
    const lastName = employeeName.split(' ').pop() || employeeName;
    let supplier = await this.prisma.supplier.findFirst({
      where: { name: { contains: lastName, mode: 'insensitive' }, category: 'Repasse Médico' },
    });
    if (!supplier) {
      const count = await this.prisma.supplier.count({ where: { category: 'Repasse Médico' } });
      const seq = String(count + 1).padStart(3, '0');
      supplier = await this.prisma.supplier.create({
        data: { name: `PJ — ${employeeName}`, cnpj: `99.${seq}.000/0001-${seq.slice(-2)}`, category: 'Repasse Médico' },
      });
    }
    return supplier;
  }

  // ══════════════════════════════════════════════
  // HISTORY (all past runs for a unit)
  // ══════════════════════════════════════════════

  async listHistory(unitId: string) {
    const runs = await this.prisma.susRepasseRun.findMany({
      where: { unit_id: unitId },
      include: {
        employee: { select: { id: true, name: true, role: true } },
        payable: { select: { id: true, status: true, value: true } },
      },
      orderBy: [{ competence: 'desc' }, { employee_name: 'asc' }],
    });

    // Group by competence
    const grouped: Record<string, {
      competence: string;
      total: number;
      runs: typeof runs;
    }> = {};

    for (const r of runs) {
      if (!grouped[r.competence]) {
        grouped[r.competence] = { competence: r.competence, total: 0, runs: [] };
      }
      grouped[r.competence].total += Number(r.total_value);
      grouped[r.competence].runs.push(r);
    }

    return Object.values(grouped)
      .sort((a, b) => b.competence.localeCompare(a.competence))
      .map((g) => ({
        competence: g.competence,
        total: g.total,
        employee_count: g.runs.length,
        runs: g.runs.map((r) => ({
          id: r.id,
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          role: r.role,
          total_value: Number(r.total_value),
          breakdown: JSON.parse(r.breakdown),
          payable_id: r.payable_id,
          payable: r.payable,
          status: r.status,
          created_at: r.created_at,
        })),
      }));
  }

  // ══════════════════════════════════════════════
  // CATALOG
  // ══════════════════════════════════════════════

  getSurgeryTypes() {
    return [
      { code: 'CATARATA', label: 'Catarata (Facoemulsificação)', requiresLens: true },
      { code: 'RETINA', label: 'Retina (Vitrectomia)', requiresInsumos: true },
      { code: 'PTERIGIO', label: 'Pterígio', requiresInsumos: false },
      { code: 'ANTI_VEGF', label: 'Anti-VEGF (Injeção)', requiresAntiVegf: true },
    ];
  }

  getProcedureKeys() {
    return [
      'CONSULTA', 'EXAME', 'EXAME:OCT', 'EXAME:RETINOGRAFIA', 'EXAME:CAMPIMETRIA',
      'CIRURGIA', 'CIRURGIA:CATARATA', 'CIRURGIA:RETINA', 'CIRURGIA:PTERIGIO', 'CIRURGIA:ANTI_VEGF',
    ];
  }
}
