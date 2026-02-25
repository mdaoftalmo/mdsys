// apps/backend/src/modules/convenios/convenios.controller.ts
import { Controller, Get, Query, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipUnitScope } from '../../common/decorators/skip-unit-scope.decorator';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('convenios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope()
@Controller('convenios')
export class ConveniosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Listar convênios ativos' })
  async list() {
    return this.prisma.convenio.findMany({
      where: { is_active: true },
      select: { id: true, name: true, slug: true, registro_ans: true, coparticipacao_pct: true, color: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get(':id/prices')
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Preços de serviços por convênio' })
  @ApiQuery({ name: 'service_id', required: false })
  async prices(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('service_id') serviceId?: string,
  ) {
    const where: any = { convenio_id: id };
    if (serviceId) where.service_id = serviceId;
    return this.prisma.serviceConvenioPrice.findMany({
      where,
      include: { service: { select: { id: true, name: true, category: true } } },
    });
  }
}
