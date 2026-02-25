// apps/backend/src/modules/financeiro/dto/engine.dto.ts
import {
  IsString, IsOptional, IsEnum, IsNumber, IsUUID,
  IsDateString, MinLength, IsBoolean, IsInt, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Pay Payable ──

export class PayPayableDto {
  @ApiPropertyOptional({ description: 'UUID da conta bancária de saída' })
  @IsOptional()
  @IsUUID()
  bank_account_id?: string;
}

// ── Receive Receivable ──

export class ReceiveReceivableDto {
  @ApiProperty({
    enum: ['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO', 'TRANSFERENCIA', 'CONVENIO'],
    example: 'PIX',
  })
  @IsString()
  payment_method: string;

  @ApiPropertyOptional({ description: 'UUID da conta bancária de entrada' })
  @IsOptional()
  @IsUUID()
  bank_account_id?: string;
}

// ── Reverse Ledger ──

export class ReverseLedgerDto {
  @ApiProperty({ example: 'Estorno por NF duplicada', minLength: 5 })
  @IsString()
  @MinLength(5)
  reason: string;
}

// ── DRE Report Query ──

export class DreReportQueryDto {
  @ApiProperty({ example: '2026-01', description: 'Competência início (YYYY-MM)' })
  @IsString()
  from: string;

  @ApiProperty({ example: '2026-03', description: 'Competência fim (YYYY-MM)' })
  @IsString()
  to: string;

  @ApiPropertyOptional({ description: 'UUID da unidade. Omitir = consolidado.' })
  @IsOptional()
  @IsUUID()
  unit_id?: string;

  @ApiPropertyOptional({ default: false, description: 'true = soma todas as unidades' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  consolidated?: boolean;
}

// ── CashFlow Report Query ──

export class CashFlowReportQueryDto {
  @ApiProperty({ example: '2026-01-01', description: 'Data início (YYYY-MM-DD)' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-03-31', description: 'Data fim (YYYY-MM-DD)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ description: 'UUID da unidade. Omitir = todas.' })
  @IsOptional()
  @IsUUID()
  unit_id?: string;

  @ApiPropertyOptional({
    enum: [30, 60, 90],
    default: 30,
    description: 'Dias de projeção a partir de "to"',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  @Type(() => Number)
  projection_days?: number;
}

// ── Response types (não são DTOs de validação, apenas doc) ──

export interface DreLineResponse {
  dre_section: string;
  nature: string;
  total: number;
  entries_count: number;
}

export interface DreReportResponse {
  from: string;
  to: string;
  unit_id: string | null;
  consolidated: boolean;
  generated_at: string;
  sections: DreLineResponse[];
  summary: {
    receita_bruta: number;
    deducoes: number;
    receita_liquida: number;
    custos: number;
    lucro_bruto: number;
    despesas_operacionais: number;
    ebitda: number;
    depreciacao: number;
    resultado_antes_ir: number;
    impostos: number;
    resultado_liquido: number;
  };
}

export interface CashFlowDayResponse {
  date: string;
  entries_in: number;
  entries_out: number;
  balance: number;
  cumulative: number;
  is_projection: boolean;
}

export interface CashFlowReportResponse {
  from: string;
  to: string;
  unit_id: string | null;
  projection_days: number;
  generated_at: string;
  total_in: number;
  total_out: number;
  net_balance: number;
  daily: CashFlowDayResponse[];
  by_account: Array<{
    account_code: string;
    account_name: string;
    total_in: number;
    total_out: number;
  }>;
}
