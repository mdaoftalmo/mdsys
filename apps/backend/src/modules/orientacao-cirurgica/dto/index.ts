// apps/backend/src/modules/orientacao-cirurgica/dto/index.ts
import {
  IsString, IsOptional, IsEnum, IsBoolean, IsInt,
  IsArray, IsUUID, IsDateString, Min, Max, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ── Enums (mirror Prisma) ──

export enum SurgicalLeadStatusDto {
  PRIMEIRA = 'PRIMEIRA',
  RETORNO = 'RETORNO',
  POS_OP = 'POS_OP',
  PACIENTE = 'PACIENTE',
  FECHOU = 'FECHOU',
  PROPENSO = 'PROPENSO',
  INDECISO = 'INDECISO',
  PERDIDO = 'PERDIDO',
}

// ── Create Lead ──

export class CreateLeadDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: '(41) 99887-6543' })
  @IsString()
  phone: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '123.456.789-00' })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({ example: 'Catarata – Lente Clareon' })
  @IsString()
  pathology: string;

  @ApiPropertyOptional({ example: 'Facoemulsificação' })
  @IsOptional()
  @IsString()
  procedure?: string;

  @ApiPropertyOptional({ example: 'OD', enum: ['OD', 'OE', 'AO'] })
  @IsOptional()
  @IsString()
  eye?: string;

  @ApiPropertyOptional({ enum: SurgicalLeadStatusDto, default: 'PRIMEIRA' })
  @IsOptional()
  @IsEnum(SurgicalLeadStatusDto)
  status?: SurgicalLeadStatusDto;

  @ApiPropertyOptional({ example: ['Preço', 'Medo'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barriers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  has_insurance?: boolean;

  @ApiPropertyOptional({ example: 'CASSI' })
  @IsOptional()
  @IsString()
  insurance_name?: string;

  @ApiPropertyOptional({ example: 'alto', enum: ['alto', 'medio', 'baixo'] })
  @IsOptional()
  @IsString()
  interest?: string;

  @ApiPropertyOptional({ example: '0-30', enum: ['0-30', '30-60', '60+'] })
  @IsOptional()
  @IsString()
  desired_timeframe?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Maria Santos' })
  @IsOptional()
  @IsString()
  responsavel?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  indication_date?: string;

  @ApiPropertyOptional({ example: '2026-02-20' })
  @IsOptional()
  @IsDateString()
  next_followup?: string;
}

// ── Update Lead (partial) ──

export class UpdateLeadDto extends PartialType(CreateLeadDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lost_reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  had_return?: boolean;
}

// ── Change Status ──

export class ChangeStatusDto {
  @ApiProperty({ enum: SurgicalLeadStatusDto })
  @IsEnum(SurgicalLeadStatusDto)
  status: SurgicalLeadStatusDto;

  @ApiPropertyOptional({ description: 'Obrigatório se status = PERDIDO' })
  @IsOptional()
  @IsString()
  lost_reason?: string;
}

// ── Register Contact ──

export class RegisterContactDto {
  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  contacted_by: string;

  @ApiProperty({ example: 'Telefone', enum: ['Telefone', 'WhatsApp', 'Presencial', 'Email'] })
  @IsString()
  channel: string;

  @ApiPropertyOptional({ example: 'Paciente confirmou interesse' })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  scheduled_surgery_date?: string;
}

// ── Query Filters ──

export class LeadFilterDto {
  @ApiPropertyOptional({ enum: SurgicalLeadStatusDto })
  @IsOptional()
  @IsEnum(SurgicalLeadStatusDto)
  status?: SurgicalLeadStatusDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pathology?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;
}
