import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.service';
import { AuthService } from '../../auth/auth.service';
import { BiService } from './bi.service';

@ApiTags('bi')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FULL', 'FINANCEIRO')
@Controller('bi')
export class BiController {
  constructor(
    private readonly service: BiService,
    private readonly authService: AuthService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Dashboard consolidado (todos os KPIs)' })
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    const scope = await this.authService.resolveUnitScope(user);
    const unitIds = scope === 'all' ? [] : scope;
    return this.service.getDashboard(unitIds);
  }

  @Get('revenue-by-unit')
  @ApiOperation({ summary: 'Receita por unidade no mês' })
  async revenueByUnit(@Query('month') month: string) {
    return this.service.getRevenueByUnit(month);
  }

  @Get('surgical-funnel')
  @ApiOperation({ summary: 'Funil cirúrgico consolidado todas unidades' })
  async surgicalFunnel() {
    return this.service.getSurgicalFunnelAll();
  }
}
