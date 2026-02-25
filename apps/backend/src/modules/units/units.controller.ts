import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar unidades ativas (para dropdown)' })
  @ApiResponse({
    status: 200,
    description: 'Lista de unidades',
    schema: {
      example: [
        { id: 'uuid', name: 'MDV Centro', cnpj: '00.000.000/0001-00', city: 'São Paulo', is_active: true },
      ],
    },
  })
  async listUnits() {
    return this.prisma.unit.findMany({
      where: { is_active: true },
      select: {
        id: true,
        name: true,
        cnpj: true,
        city: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
