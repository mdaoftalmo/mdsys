import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UnitScope } from '../../common/decorators/unit-scope.decorator';
import { EstoqueService } from './estoque.service';
import { RegisterMovementDto } from './dto';

@ApiTags('estoque')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('estoque')
export class EstoqueController {
  constructor(private readonly service: EstoqueService) {}

  @Get('items')
  @ApiOperation({ summary: 'Catálogo de itens' })
  async listItems(@Query('category') category?: string, @Query('search') search?: string) {
    return this.service.listItems({ category, search });
  }

  @Get('levels')
  @ApiOperation({ summary: 'Níveis de estoque por unidade (FEFO)' })
  async getLevels(@UnitScope() unitId: string) {
    return this.service.getStockLevels(unitId);
  }

  @Get('critical')
  @ApiOperation({ summary: 'Itens em estoque crítico ou vencendo' })
  async getCritical(@UnitScope() unitId: string) {
    return this.service.getCriticalStock(unitId);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Itens vencendo nos próximos N dias' })
  async getExpiring(@UnitScope() unitId: string, @Query('days') days?: number) {
    return this.service.getExpiringItems(unitId, days || 30);
  }

  @Post('movements')
  @ApiOperation({ summary: 'Registrar movimentação de estoque' })
  async registerMovement(@UnitScope() unitId: string, @Body() dto: RegisterMovementDto) {
    return this.service.registerMovement(unitId, dto);
  }
}
