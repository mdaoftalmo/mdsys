// apps/backend/src/modules/sales/sales.dto.ts
import {
  IsString, IsOptional, IsUUID, IsEnum, IsNumber, IsInt,
  Min, MinLength, MaxLength, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Create Sale (DRAFT) ──

export class CreateSaleDto {
  @ApiProperty({ description: 'ID do paciente' })
  @IsUUID()
  patient_id: string;

  @ApiPropertyOptional({ description: 'ID do convênio (null = particular)' })
  @IsOptional()
  @IsUUID()
  convenio_id?: string;

  @ApiProperty({ enum: ['DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','BOLETO','TRANSFERENCIA','CONVENIO','CARTAO_CORP'] })
  @IsString()
  payment_method: string;

  @ApiPropertyOptional({ example: 'primeira', enum: ['primeira','retorno','pos_op','exame','cirurgia'] })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  visit_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

// ── Add / Edit Item ──

export class AddItemDto {
  @ApiPropertyOptional({ description: 'ID do serviço (ServiceCatalog)' })
  @IsOptional()
  @IsUUID()
  service_id?: string;

  @ApiProperty({ example: 'Consulta Oftalmológica' })
  @IsString()
  @MinLength(2)
  @MaxLength(300)
  description: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 350.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_price: number;

  @ApiPropertyOptional({ example: 0, description: 'Desconto absoluto no item' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discount?: number;
}

export class UpdateItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discount?: number;
}

// ── Receive shortcut ──

export class ReceiveSaleDto {
  @ApiPropertyOptional({ example: 'PIX', description: 'Método de pagamento para CashMovement' })
  @IsOptional()
  @IsString()
  payment_method?: string;
}
