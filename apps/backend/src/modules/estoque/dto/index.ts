import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsInt, IsDateString, Min, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Enums ──

export enum StockMovementTypeDto {
  ENTRADA = 'ENTRADA',
  SAIDA = 'SAIDA',
  AJUSTE = 'AJUSTE',
  TRANSFERENCIA = 'TRANSFERENCIA',
}

export enum PurchaseOrderStatusDto {
  RASCUNHO = 'RASCUNHO',
  APROVADO = 'APROVADO',
  ENVIADO = 'ENVIADO',
  PARCIAL = 'PARCIAL',
  RECEBIDO = 'RECEBIDO',
  CANCELADO = 'CANCELADO',
}

// ── Create Stock Item (catalog) ──

export class CreateStockItemDto {
  @ApiProperty({ example: 'LIO-003' })
  @IsString()
  sku: string;

  @ApiProperty({ example: 'LIO Alcon Vivity' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: 'LIO' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'unidade' })
  @IsString()
  unit_measure: string;

  @ApiProperty({ example: 550.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost: number;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(0)
  min_stock: number;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  reorder_point: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requires_lot?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requires_cold?: boolean;
}

export class UpdateStockItemDto extends PartialType(CreateStockItemDto) {}

// ── Register Movement ──

export class RegisterMovementDto {
  @ApiProperty()
  @IsString()
  stock_item_id: string;

  @ApiProperty({ enum: StockMovementTypeDto })
  @IsEnum(StockMovementTypeDto)
  type: StockMovementTypeDto;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'LOT-2026-A' })
  @IsOptional()
  @IsString()
  lot?: string;

  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  operator_name: string;

  @ApiPropertyOptional({ example: 'João Silva' })
  @IsOptional()
  @IsString()
  patient_name?: string;

  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  patient_cpf?: string;

  @ApiPropertyOptional({ example: 'PO-2026-015' })
  @IsOptional()
  @IsString()
  reference?: string;
}

// ── Create Purchase Order ──

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsString()
  supplier_id: string;

  @ApiPropertyOptional({ example: '2026-02-28' })
  @IsOptional()
  @IsDateString()
  expected_delivery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [Object] })
  items: CreatePurchaseOrderItemDto[];
}

export class CreatePurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  stock_item_id: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 32.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  unit_cost: number;
}

// ── Filters ──

export class StockFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
