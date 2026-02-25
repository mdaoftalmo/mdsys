import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  @Post('finance-insights')
  @Roles('FULL', 'FINANCEIRO')
  @ApiOperation({
    summary: 'Insights financeiros via Claude AI',
    description: 'Recebe FinanceContext JSON, valida entrada, chama Claude, valida saída. Nunca inventa números.',
  })
  async financeInsights(@Body() body: any) {
    return this.service.getFinanceInsights(body);
  }

  @Post('surgical-next-actions')
  @ApiOperation({
    summary: 'Próximas ações para lead cirúrgico via Claude AI',
    description: 'Recebe SurgicalLeadContext, retorna ações prioritizadas com scripts de abordagem.',
  })
  async surgicalNextActions(@Body() body: any) {
    return this.service.getSurgicalNextActions(body);
  }

  @Post('scenario-summary')
  @Roles('FULL', 'FINANCEIRO')
  @ApiOperation({
    summary: 'Análise de cenário hipotético via Claude AI',
    description: 'Recebe ScenarioContext com métricas e mudanças propostas, retorna projeções otimista/realista/pessimista.',
  })
  async scenarioSummary(@Body() body: any) {
    return this.service.getScenarioSummary(body);
  }
}
