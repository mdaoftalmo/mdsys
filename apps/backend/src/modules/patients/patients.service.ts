// apps/backend/src/modules/patients/patients.service.ts
import {
  Injectable, BadRequestException, NotFoundException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';

@Injectable()
export class PatientsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──

  /** Strip non-digits from CPF for comparison */
  private normalizeCpf(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  /** Strip non-digits from phone for search */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /** Format raw digits back to CPF: 12345678909 → 123.456.789-09 */
  private formatCpf(digits: string): string {
    const d = digits.padStart(11, '0');
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  // ── List with search + pagination ──

  async list(filters: {
    search?: string;
    unitId?: string;
    page: number;
    limit: number;
  }) {
    const { search, unitId, page, limit } = filters;
    const where: any = { deleted_at: null };

    if (unitId) {
      where.origin_unit_id = unitId;
    }

    if (search) {
      const term = search.trim();
      const digits = term.replace(/\D/g, '');

      // If search looks like CPF (only digits, 3+ chars), search by CPF
      if (digits.length >= 3 && digits.length === term.replace(/[.\-\s]/g, '').length) {
        where.cpf = { contains: digits.length === 11 ? this.formatCpf(digits) : term };
      } else {
        // Otherwise search by name (case-insensitive)
        where.name = { contains: term, mode: 'insensitive' };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: {
          unit: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ── Get by ID ──

  async findById(id: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, deleted_at: null },
      include: {
        unit: { select: { id: true, name: true } },
        surgical_leads: {
          select: { id: true, status: true, pathology: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: 5,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException(`Paciente ${id} não encontrado`);
    }

    return patient;
  }

  // ── Create ──

  async create(unitId: string, dto: CreatePatientDto) {
    // Validate CPF uniqueness
    const existing = await this.prisma.patient.findFirst({
      where: { cpf: dto.cpf, deleted_at: null },
    });
    if (existing) {
      throw new ConflictException(
        `CPF ${dto.cpf} já cadastrado para o paciente "${existing.name}"`,
      );
    }

    return this.prisma.patient.create({
      data: {
        name: dto.name.trim(),
        cpf: dto.cpf,
        rg: dto.rg || null,
        dob: new Date(dto.dob),
        phone: dto.phone || null,
        email: dto.email?.toLowerCase().trim() || null,
        address: dto.address || null,
        source_channel: dto.source_channel || null,
        notes: dto.notes || null,
        origin_unit_id: unitId,
      },
      include: {
        unit: { select: { id: true, name: true } },
      },
    });
  }

  // ── Update ──

  async update(id: string, dto: UpdatePatientDto) {
    // Check exists
    const patient = await this.prisma.patient.findFirst({
      where: { id, deleted_at: null },
    });
    if (!patient) {
      throw new NotFoundException(`Paciente ${id} não encontrado`);
    }

    // If CPF is being changed, validate uniqueness
    if (dto.cpf && dto.cpf !== patient.cpf) {
      const existing = await this.prisma.patient.findFirst({
        where: { cpf: dto.cpf, deleted_at: null, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(
          `CPF ${dto.cpf} já cadastrado para o paciente "${existing.name}"`,
        );
      }
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.cpf !== undefined) data.cpf = dto.cpf;
    if (dto.rg !== undefined) data.rg = dto.rg || null;
    if (dto.dob !== undefined) data.dob = new Date(dto.dob);
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.email !== undefined) data.email = dto.email?.toLowerCase().trim() || null;
    if (dto.address !== undefined) data.address = dto.address || null;
    if (dto.source_channel !== undefined) data.source_channel = dto.source_channel || null;
    if (dto.notes !== undefined) data.notes = dto.notes || null;

    return this.prisma.patient.update({
      where: { id },
      data,
      include: {
        unit: { select: { id: true, name: true } },
      },
    });
  }
}
