// apps/backend/src/modules/patients/patients.controller.ts
import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, DefaultValuePipe, ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipUnitScope } from '../../common/decorators/skip-unit-scope.decorator';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { PatientsService } from './patients.service';
import { CreatePatientDto, UpdatePatientDto } from './patients.dto';

@ApiTags('patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope() // Patients are cross-unit (filter via query param)
@Controller('patients')
export class PatientsController {
  constructor(private readonly service: PatientsService) {}

  // ── GET /patients?search=&page=&limit=&unit_id= ──

  @Get()
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Listar pacientes com busca e paginação' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por nome ou CPF' })
  @ApiQuery({ name: 'unit_id', required: false, description: 'Filtrar por unidade de origem' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  async list(
    @Query('search') search?: string,
    @Query('unit_id') unitId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.service.list({
      search,
      unitId,
      page: Math.max(1, page ?? 1),
      limit: Math.min(100, Math.max(1, limit ?? 20)),
    });
  }

  // ── GET /patients/:id ──

  @Get(':id')
  @RequirePermissions(Permission.PATIENT_READ)
  @ApiOperation({ summary: 'Detalhe do paciente' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  // ── POST /patients?unit_id= ──

  @Post()
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({ summary: 'Cadastrar novo paciente' })
  @ApiQuery({ name: 'unit_id', required: true, description: 'Unidade de origem do paciente' })
  async create(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Body() dto: CreatePatientDto,
  ) {
    return this.service.create(unitId, dto);
  }

  // ── PATCH /patients/:id ──

  @Patch(':id')
  @RequirePermissions(Permission.PATIENT_WRITE)
  @ApiOperation({ summary: 'Atualizar paciente' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.service.update(id, dto);
  }
}
