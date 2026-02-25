// apps/backend/src/modules/abasus/production.controller.ts
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe, DefaultValuePipe, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipUnitScope } from '../../common/decorators/skip-unit-scope.decorator';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { ProductionService } from './production.service';
import { CreateProductionDto, UpdateProductionDto, AddConsumptionDto, UpdateConsumptionDto } from './abasus.dto';

@ApiTags('abasus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope()
@Controller('abasus/production')
export class ProductionController {
  constructor(private readonly service: ProductionService) {}

  // ── LIST ──

  @Get()
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Listar produção SUS com filtros' })
  @ApiQuery({ name: 'unit_id', required: true, description: 'Deve ser a unidade SUS' })
  @ApiQuery({ name: 'type', required: false, enum: ['CONSULTA', 'EXAME', 'CIRURGIA'] })
  @ApiQuery({ name: 'competence', required: false, description: 'YYYY-MM' })
  @ApiQuery({ name: 'doctor_id', required: false })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'CONFIRMED', 'CANCELED'] })
  @ApiQuery({ name: 'search', required: false })
  async list(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Query('type') type?: string,
    @Query('competence') competence?: string,
    @Query('doctor_id') doctorId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.service.list(unitId, { type, competence, doctorId, status, search, page: page ?? 1, limit: limit ?? 50 });
  }

  // ── GET BY ID ──

  @Get(':id')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Detalhe produção SUS (com consumos)' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  // ── CREATE (DRAFT) ──

  @Post()
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Criar produção SUS (DRAFT)' })
  @ApiQuery({ name: 'unit_id', required: true })
  async create(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateProductionDto,
  ) {
    return this.service.create(unitId, dto);
  }

  // ── UPDATE (DRAFT only) ──

  @Patch(':id')
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Editar produção (apenas DRAFT)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductionDto,
  ) {
    return this.service.update(id, dto);
  }

  // ── CONFIRM ──

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions(Permission.ABASUS_CONFIRM)
  @ApiOperation({ summary: 'Confirmar produção → baixa estoque + lançamento contábil' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.confirm(id, user.id);
  }

  // ── CANCEL ──

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Cancelar produção (apenas DRAFT)' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  // ── CONSUMPTION (insumos) ──

  @Post(':id/consumption')
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Adicionar insumo à produção' })
  async addConsumption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddConsumptionDto,
  ) {
    return this.service.addConsumption(id, dto);
  }

  @Patch('consumption/:consumptionId')
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Editar insumo' })
  async updateConsumption(
    @Param('consumptionId', ParseUUIDPipe) consumptionId: string,
    @Body() dto: UpdateConsumptionDto,
  ) {
    return this.service.updateConsumption(consumptionId, dto);
  }

  @Delete('consumption/:consumptionId')
  @RequirePermissions(Permission.ABASUS_WRITE)
  @ApiOperation({ summary: 'Remover insumo' })
  async removeConsumption(@Param('consumptionId', ParseUUIDPipe) consumptionId: string) {
    return this.service.removeConsumption(consumptionId);
  }

  // ── SUMMARY (dashboard) ──

  @Get('summary/:competence')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Resumo de produção por competência' })
  @ApiQuery({ name: 'unit_id', required: true })
  async summary(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Param('competence') competence: string,
  ) {
    return this.service.summary(unitId, competence);
  }

  // ── CONSUMPTION REPORT ──

  @Get('consumption-report/:competence')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Relatório de consumo de insumos por competência' })
  @ApiQuery({ name: 'unit_id', required: true })
  async consumptionReport(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Param('competence') competence: string,
  ) {
    return this.service.consumptionReport(unitId, competence);
  }
}
