import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsInt, IsDateString, Min, Max, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Enums (mirror Prisma) ──

export enum PayableStatusDto {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REPROVADO = 'REPROVADO',
  AJUSTADO = 'AJUSTADO',
  PAGO = 'PAGO',
  CANCELADO = 'CANCELADO',
}

export enum PaymentMethodDto {
  DINHEIRO = 'DINHEIRO',
  PIX = 'PIX',
  CARTAO_DEBITO = 'CARTAO_DEBITO',
  CARTAO_CREDITO = 'CARTAO_CREDITO',
  BOLETO = 'BOLETO',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CONVENIO = 'CONVENIO',
  CARTAO_CORP = 'CARTAO_CORP',
}

export enum ReceivableStatusDto {
  PREVISTO = 'PREVISTO',
  RECEBIDO = 'RECEBIDO',
  ATRASADO = 'ATRASADO',
  GLOSADO = 'GLOSADO',
}

// ── Create Payable ──

export class CreatePayableDto {
  @ApiProperty()
  @IsString()
  supplier_id: string;

  @ApiPropertyOptional({ description: 'UUID da UnitAccount (plano de contas da unidade)' })
  @IsOptional()
  @IsString()
  unit_account_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cost_center_id?: string;

  @ApiProperty({ example: 'Compra de insumos Jan/2026' })
  @IsString()
  @MinLength(3)
  description: string;

  @ApiProperty({ example: '2026-01' })
  @IsString()
  competence: string;

  @ApiProperty({ example: '2026-01-30' })
  @IsDateString()
  due_date: string;

  @ApiProperty({ example: 1500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiPropertyOptional({ enum: PaymentMethodDto, default: 'BOLETO' })
  @IsOptional()
  @IsEnum(PaymentMethodDto)
  payment_method?: PaymentMethodDto;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;
}

export class UpdatePayableDto extends PartialType(CreatePayableDto) {}

export class AdjustPayableDto {
  @ApiProperty({ example: 1200.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  value: number;

  @ApiProperty({ example: 'Desconto negociado com fornecedor' })
  @IsString()
  @MinLength(10)
  justification: string;

  @ApiProperty({ example: 'Dr. Eduardo' })
  @IsString()
  authorized_by: string;
}

export class RejectPayableDto {
  @ApiProperty({ example: 'Nota fiscal incorreta' })
  @IsString()
  @MinLength(10)
  justification: string;
}

// Re-export engine DTOs
export {
  PayPayableDto,
  ReceiveReceivableDto,
  ReverseLedgerDto,
  DreReportQueryDto,
  CashFlowReportQueryDto,
} from './engine.dto';

// ── Create Receivable ──

export class CreateReceivableDto {
  @ApiProperty({ example: 'Particular' })
  @IsString()
  source: string;

  @ApiPropertyOptional({ description: 'UUID da UnitAccount (plano de contas da unidade)' })
  @IsOptional()
  @IsString()
  unit_account_id?: string;

  @ApiProperty({ example: '2026-01' })
  @IsString()
  competence: string;

  @ApiProperty({ example: '2026-02-15' })
  @IsDateString()
  expected_date: string;

  @ApiProperty({ example: 8500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  gross_value: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  discount?: number;

  @ApiProperty({ example: 8500.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  net_value: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  is_convenio?: boolean;
}

// ── DRE Input ──

export class UpsertDreValueDto {
  @ApiProperty({ example: 'consultas_part' })
  @IsString()
  line_id: string;

  @ApiProperty({ example: '2026-01' })
  @IsString()
  month_key: string;

  @ApiProperty({ example: 45000.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  value: number;
}

// ── Filters ──

export class PayableFilterDto {
  @ApiPropertyOptional({ enum: PayableStatusDto })
  @IsOptional()
  @IsEnum(PayableStatusDto)
  status?: PayableStatusDto;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @IsString()
  competence?: string;
}

export class ReceivableFilterDto {
  @ApiPropertyOptional({ enum: ReceivableStatusDto })
  @IsOptional()
  @IsEnum(ReceivableStatusDto)
  status?: ReceivableStatusDto;

  @ApiPropertyOptional({ example: '2026-01' })
  @IsOptional()
  @IsString()
  competence?: string;
}
