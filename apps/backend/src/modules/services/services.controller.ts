// apps/backend/src/modules/services/services.controller.ts
import {
  Controller, Get, Post, Patch, Body, Query, Param,
  UseGuards, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SkipUnitScope } from '../../common/decorators/skip-unit-scope.decorator';
import { PermissionsGuard, RequirePermissions, Permission } from '../../auth/permissions';
import { PrismaService } from '../../prisma/prisma.service';
import { IsString, IsNumber, IsOptional, IsBoolean, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class CreateServiceDto {
  @ApiProperty({ example: 'Consulta Oftalmológica' })
  @IsString() @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'Consulta' })
  @IsString() @MaxLength(100)
  category: string;

  @ApiProperty({ example: 350.00 })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  price_particular: number;

  @ApiPropertyOptional({ example: 300.00 })
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  price_card?: number;

  @ApiPropertyOptional({ example: '10101012' })
  @IsOptional() @IsString() @MaxLength(20)
  tuss_code?: string;
}

class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(200)
  name?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  price_particular?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Type(() => Number)
  price_card?: number;
  @IsOptional() @IsBoolean()
  is_active?: boolean;
}

@ApiTags('services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@SkipUnitScope()
@Controller('services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions(Permission.SALES_READ)
  @ApiOperation({ summary: 'Listar serviços do catálogo' })
  @ApiQuery({ name: 'search', required: false })
  async list(@Query('search') search?: string) {
    const where: any = { is_active: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { tuss_code: { contains: search } },
      ];
    }
    return this.prisma.serviceCatalog.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      take: 50,
    });
  }

  @Get(':id')
  @RequirePermissions(Permission.SALES_READ)
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.serviceCatalog.findUniqueOrThrow({ where: { id } });
  }

  @Post()
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Criar serviço no catálogo' })
  async create(@Body() dto: CreateServiceDto) {
    return this.prisma.serviceCatalog.create({
      data: {
        name: dto.name,
        category: dto.category,
        price_particular: dto.price_particular,
        price_card: dto.price_card || null,
        tuss_code: dto.tuss_code || null,
      },
    });
  }

  @Patch(':id')
  @RequirePermissions(Permission.SALES_WRITE)
  @ApiOperation({ summary: 'Editar serviço' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateServiceDto) {
    return this.prisma.serviceCatalog.update({ where: { id }, data: dto as any });
  }
}
