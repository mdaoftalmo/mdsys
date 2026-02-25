import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UnitScope } from '../../common/decorators/unit-scope.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { FinanceiroService } from './financeiro.service';
import { AdjustPayableDto, RejectPayableDto, CreatePayableDto, CreateReceivableDto } from './dto';

@ApiTags('financeiro')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('FULL', 'FINANCEIRO')
@Controller('financeiro')
export class FinanceiroController {
  constructor(private readonly service: FinanceiroService) {}

  // ── Payables ──

  @Post('payables')
  @RequirePermissions(Permission.PAYABLE_CREATE)
  @ApiOperation({ summary: 'Criar conta a pagar' })
  async createPayable(
    @UnitScope() unitId: string,
    @Body() dto: CreatePayableDto,
  ) {
    return this.service.createPayable(unitId, dto);
  }

  @Get('payables')
  @RequirePermissions(Permission.PAYABLE_READ)
  @ApiOperation({ summary: 'Listar contas a pagar (paginado)' })
  async listPayables(
    @UnitScope() unitId: string,
    @Query('status') status?: string,
    @Query('competence') competence?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.listPayables(unitId, { status, competence }, page || 1, limit || 50);
  }

  @Post('payables/:id/approve')
  @RequirePermissions(Permission.PAYABLE_APPROVE)
  @ApiOperation({ summary: 'Aprovar conta a pagar' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.approvePayable(id, unitId, user.id);
  }

  @Patch('payables/:id/adjust')
  @RequirePermissions(Permission.PAYABLE_ADJUST)
  @ApiOperation({ summary: 'Ajustar valor (somente diretoria)' })
  async adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AdjustPayableDto,
  ) {
    return this.service.adjustPayable(id, unitId, user.id, dto.value, dto.justification, dto.authorized_by);
  }

  // ── Receivables ──

  @Post('receivables')
  @RequirePermissions(Permission.RECEIVABLE_CREATE)
  @ApiOperation({ summary: 'Criar conta a receber' })
  async createReceivable(
    @UnitScope() unitId: string,
    @Body() dto: CreateReceivableDto,
  ) {
    return this.service.createReceivable(unitId, dto);
  }

  @Get('receivables')
  @ApiOperation({ summary: 'Listar contas a receber' })
  async listReceivables(
    @UnitScope() unitId: string,
    @Query('status') status?: string,
    @Query('competence') competence?: string,
  ) {
    return this.service.listReceivables(unitId, { status, competence });
  }

  // ── Cash Flow (projetado por due_date) ──

  @Get('cash-flow')
  @ApiOperation({ summary: 'Fluxo de caixa projetado (por vencimento)' })
  async cashFlow(
    @UnitScope() unitId: string,
    @Query('month') month: string,
  ) {
    return this.service.getCashFlowProjected(unitId, month);
  }

  // ── Cash Flow por Competência (para DRE) ──

  @Get('cash-flow-competence')
  @ApiOperation({ summary: 'Resumo por competência (para DRE)' })
  async cashFlowCompetence(
    @UnitScope() unitId: string,
    @Query('month') month: string,
  ) {
    return this.service.getCashFlowByCompetence(unitId, month);
  }

  // ── DRE ──

  @Get('dre')
  @ApiOperation({ summary: 'Valores DRE do mês' })
  async dre(
    @UnitScope() unitId: string,
    @Query('month') month: string,
  ) {
    return this.service.getDreValues(unitId, month);
  }
}
