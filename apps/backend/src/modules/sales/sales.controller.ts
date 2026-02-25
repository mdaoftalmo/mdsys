// apps/backend/src/modules/sales/sales.controller.ts
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
import { SalesService } from './sales.service';
import { CreateSaleDto, AddItemDto, UpdateItemDto, ReceiveSaleDto } from './sales.dto';

@ApiTags('sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope()
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  // ── GET /sales?search=&unit_id=&from=&to=&type=&status=&page=&limit= ──

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Listar vendas com filtros' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'unit_id', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'type', required: false, enum: ['PARTICULAR', 'CONVENIO'] })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'CONFIRMED', 'CANCELED', 'PAID'] })
  async list(
    @Query('search') search?: string,
    @Query('unit_id') unitId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  ) {
    return this.service.list({
      search, unitId, from, to, type, status,
      page: Math.max(1, page ?? 1),
      limit: Math.min(100, Math.max(1, limit ?? 20)),
    });
  }

  // ── GET /sales/:id ──

  @Get(':id')
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Detalhe da venda com itens e receivable' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  // ── POST /sales?unit_id= ──

  @Post()
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Criar venda (DRAFT)' })
  @ApiQuery({ name: 'unit_id', required: true })
  async create(
    @Query('unit_id', ParseUUIDPipe) unitId: string,
    @Body() dto: CreateSaleDto,
  ) {
    return this.service.create(unitId, dto);
  }

  // ── POST /sales/:id/items ──

  @Post(':id/items')
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Adicionar item à venda' })
  async addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(id, dto);
  }

  // ── PATCH /sales/:id/items/:itemId ──

  @Patch(':id/items/:itemId')
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Editar item (qty/preço/desconto)' })
  async updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.service.updateItem(id, itemId, dto);
  }

  // ── DELETE /sales/:id/items/:itemId ──

  @Delete(':id/items/:itemId')
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Remover item da venda' })
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.service.removeItem(id, itemId);
  }

  // ── POST /sales/:id/confirm ──

  @Post(':id/confirm')
  @HttpCode(200)
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Confirmar venda → cria Receivable automaticamente' })
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.confirm(id);
  }

  // ── POST /sales/:id/cancel ──

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Cancelar venda' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.cancel(id);
  }

  // ── POST /sales/:id/receive ──

  @Post(':id/receive')
  @HttpCode(200)
  @RequirePermissions(Permission.SALES_RECEIVE)
  @ApiOperation({ summary: 'Receber pagamento → gera CashMovement IN' })
  async receive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReceiveSaleDto,
  ) {
    return this.service.receive(id, user.id, dto);
  }
}
