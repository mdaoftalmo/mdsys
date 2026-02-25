import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UnitScope } from '../../common/decorators/unit-scope.decorator';
import { RhService } from './rh.service';

@ApiTags('rh')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('FULL', 'FINANCEIRO')
@Controller('rh')
export class RhController {
  constructor(private readonly service: RhService) {}

  @Get('employees')
  @ApiOperation({ summary: 'Listar colaboradores' })
  async list(@UnitScope() unitId: string, @Query('status') status?: string, @Query('type') type?: string) {
    return this.service.listEmployees(unitId, { status, type });
  }

  @Get('documents/expiring')
  @ApiOperation({ summary: 'Documentos vencendo (CRM, ASO, NR32)' })
  async expiringDocs(@UnitScope() unitId: string, @Query('days') days?: number) {
    return this.service.getExpiringDocuments(unitId, days || 30);
  }

  @Get('payroll-summary')
  @ApiOperation({ summary: 'Resumo folha de pagamento' })
  async payrollSummary(@UnitScope() unitId: string) {
    return this.service.getPayrollSummary(unitId);
  }
}
