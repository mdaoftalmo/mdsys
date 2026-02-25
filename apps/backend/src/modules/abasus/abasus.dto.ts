// apps/backend/src/modules/abasus/abasus.dto.ts
import {
  IsString, IsOptional, IsUUID, IsInt, IsNumber, IsDateString,
  Min, MinLength, MaxLength, IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Production ──

export class CreateProductionDto {
  @ApiProperty({ enum: ['CONSULTA', 'EXAME', 'CIRURGIA'] })
  @IsString()
  @IsIn(['CONSULTA', 'EXAME', 'CIRURGIA'])
  type: string;

  @ApiProperty({ example: '2026-02-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '2026-02' })
  @IsString()
  @MaxLength(7)
  competence: string;

  @ApiProperty({ example: 'Dr. Eduardo Martins' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  doctor_name: string;

  @ApiPropertyOptional({ description: 'Employee UUID do médico' })
  @IsOptional()
  @IsUUID()
  doctor_id?: string;

  @ApiPropertyOptional({ description: 'Employee UUID da secretária' })
  @IsOptional()
  @IsUUID()
  secretary_id?: string;

  // Consulta
  @ApiPropertyOptional({ example: 25, description: 'Atendimentos (consulta)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  attendances?: number;

  @ApiPropertyOptional({ example: 5, description: 'Retornos (consulta)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  returns?: number;

  // Exame
  @ApiPropertyOptional({ example: 'OCT', description: 'Tipo de exame' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  exam_type?: string;

  @ApiPropertyOptional({ example: 10, description: 'Quantidade (exame/cirurgia)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  // Cirurgia
  @ApiPropertyOptional({ example: 'Facoemulsificação' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  procedure_type?: string;

  @ApiPropertyOptional({ enum: ['CATARATA', 'RETINA', 'PTERIGIO', 'ANTI_VEGF'] })
  @IsOptional()
  @IsString()
  @IsIn(['CATARATA', 'RETINA', 'PTERIGIO', 'ANTI_VEGF'])
  surgery_subtype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  technique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  equipment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_value?: number;
}

export class UpdateProductionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  doctor_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  doctor_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  secretary_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  attendances?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  returns?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  exam_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  procedure_type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  surgery_subtype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  technique?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  equipment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_value?: number;
}

// ── Consumption (insumos) ──

export class AddConsumptionDto {
  @ApiProperty({ description: 'StockItem UUID' })
  @IsUUID()
  stock_item_id: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'L2026-01' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  lot?: string;

  @ApiPropertyOptional({ description: 'JSON metadata: { lente_model, validade, ... }' })
  @IsOptional()
  @IsString()
  metadata?: string;
}

export class UpdateConsumptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lot?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  metadata?: string;
}

// ── Repasse ──

export class RunRepasseDto {
  @ApiProperty({ example: '2026-02' })
  @IsString()
  @MaxLength(7)
  competence: string;
}

export class CreateRepasseRuleDto {
  @ApiProperty({ description: 'UUID da unidade SUS' })
  @IsUUID()
  unit_id: string;

  @ApiProperty({ example: 'CONSULTA', description: 'CONSULTA | EXAME | EXAME:OCT | CIRURGIA:CATARATA ...' })
  @IsString()
  @MaxLength(100)
  procedure_key: string;

  @ApiProperty({ enum: ['DOCTOR', 'SECRETARY'] })
  @IsString()
  @IsIn(['DOCTOR', 'SECRETARY'])
  role: string;

  @ApiProperty({ example: 15.00, description: 'Valor por unidade de produção' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_value: number;

  @ApiProperty({ example: '2026-01-01', description: 'Início da vigência' })
  @IsDateString()
  valid_from: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Fim da vigência (null = sem prazo)' })
  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}

export class UpdateRepasseRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unit_value?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  valid_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  valid_to?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
