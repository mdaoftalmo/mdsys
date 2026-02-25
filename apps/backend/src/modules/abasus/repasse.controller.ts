// apps/backend/src/modules/abasus/repasse.controller.ts
import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, HttpCode, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipUnitScope } from '../../common/decorators/skip-unit-scope.decorator';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { RepasseService } from './repasse.service';
import { CreateRepasseRuleDto, UpdateRepasseRuleDto, RunRepasseDto } from './abasus.dto';

@ApiTags('abasus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope()
@Controller('abasus/repasse')
export class RepasseController {
  constructor(private readonly service: RepasseService) {}

  // ══════════ RULES ══════════

  @Get('rules')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Listar regras de repasse' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'active', required: false, enum: ['true', 'false'] })
  @ApiQuery({ name: 'unit_id', required: false })
  async listRules(
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('unit_id') unitId?: string,
  ) {
    return this.service.listRules({ search, active, unitId });
  }

  @Post('rules')
  @RequirePermissions(Permission.ABASUS_REPASSE)
  @ApiOperation({ summary: 'Criar regra de repasse' })
  async createRule(@Body() dto: CreateRepasseRuleDto) {
    return this.service.createRule(dto);
  }

  @Patch('rules/:id')
  @RequirePermissions(Permission.ABASUS_REPASSE)
  @ApiOperation({ summary: 'Editar regra de repasse' })
  async updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRepasseRuleDto,
  ) {
    return this.service.updateRule(id, dto);
  }

  // ══════════ PREVIEW / RUN ══════════

  @Get()
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Preview repasses por competência (read-only)' })
  @ApiQuery({ name: 'unit_id', required: true })
  @ApiQuery({ name: 'competence', required: true, description: 'YYYY-MM' })
  async preview(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Query('competence') competence: string,
  ) {
    return this.service.preview(unitId, competence);
  }

  @Post('run')
  @HttpCode(200)
  @RequirePermissions(Permission.ABASUS_REPASSE)
  @ApiOperation({ summary: 'Calcular e gerar repasses + Payables (idempotente)' })
  @ApiQuery({ name: 'unit_id', required: true })
  async run(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Body() dto: RunRepasseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.run(unitId, dto.competence, user.id);
  }

  // ══════════ CATALOG ══════════

  @Get('surgery-types')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Tipos de cirurgia SUS' })
  async surgeryTypes() {
    return this.service.getSurgeryTypes();
  }

  @Get('procedure-keys')
  @RequirePermissions(Permission.ABASUS_READ)
  @ApiOperation({ summary: 'Chaves de procedimento disponíveis' })
  async procedureKeys() {
    return this.service.getProcedureKeys();
  }
}
