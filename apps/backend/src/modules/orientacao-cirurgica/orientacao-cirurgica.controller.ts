import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UnitScope } from '../../common/decorators/unit-scope.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { OrientacaoCirurgicaService } from './orientacao-cirurgica.service';
import {
  CreateLeadDto, UpdateLeadDto, ChangeStatusDto,
  RegisterContactDto, LeadFilterDto,
} from './dto';

@ApiTags('orientacao-cirurgica')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orientacao-cirurgica')
export class OrientacaoCirurgicaController {
  constructor(private readonly service: OrientacaoCirurgicaService) {}

  // ── Kanban board data ──

  @Get('kanban')
  @ApiOperation({ summary: 'Dados para board Kanban (agrupados por status)' })
  async getKanban(@UnitScope() unitId: string) {
    return this.service.getKanban(unitId);
  }

  // ── Funnel stats ──

  @Get('funnel')
  @ApiOperation({ summary: 'Estatísticas do funil (para BI)' })
  async getFunnel(@UnitScope() unitId: string) {
    return this.service.getFunnelStats(unitId);
  }

  // ── List with filters ──

  @Get()
  @ApiOperation({ summary: 'Listar leads com filtros e paginação' })
  async findAll(
    @UnitScope() unitId: string,
    @Query() filters: LeadFilterDto,
  ) {
    return this.service.findAll(unitId, filters);
  }

  // ── Get single lead ──

  @Get(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Detalhe do lead com timeline de contatos' })
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
  ) {
    return this.service.findById(id, unitId);
  }

  // ── Create lead ──

  @Post()
  @ApiOperation({ summary: 'Criar novo lead cirúrgico' })
  async create(
    @UnitScope() unitId: string,
    @Body() dto: CreateLeadDto,
  ) {
    return this.service.create(unitId, dto);
  }

  // ── Update lead ──

  @Patch(':id')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Atualizar dados do lead' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.service.update(id, unitId, dto);
  }

  // ── Change Status (Kanban drag) ──

  @Patch(':id/status')
  @HttpCode(200)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Mudar status do lead (drag no Kanban)' })
  async changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangeStatusDto,
  ) {
    return this.service.changeStatus(id, unitId, dto, user.id);
  }

  // ── Register Contact ──

  @Post(':id/contacts')
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Registrar contato/follow-up com o lead' })
  async registerContact(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @Body() dto: RegisterContactDto,
  ) {
    return this.service.registerContact(id, unitId, dto);
  }

  // ── Schedule Follow-up ──

  @Patch(':id/followup')
  @HttpCode(200)
  @ApiParam({ name: 'id', type: String })
  @ApiOperation({ summary: 'Agendar próximo follow-up' })
  async scheduleFollowup(
    @Param('id', ParseUUIDPipe) id: string,
    @UnitScope() unitId: string,
    @Body('date') date: string,
  ) {
    return this.service.scheduleFollowup(id, unitId, date);
  }
}
