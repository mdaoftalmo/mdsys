import {
  IsString, IsOptional, IsEnum, IsNumber,
  IsDateString, MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ── Enums ──

export enum EmployeeTypeDto {
  CLT = 'CLT',
  PJ = 'PJ',
  AUTONOMO = 'AUTONOMO',
}

export enum EmployeeStatusDto {
  ATIVO = 'ATIVO',
  FERIAS = 'FERIAS',
  AFASTADO = 'AFASTADO',
  DESLIGADO = 'DESLIGADO',
}

// ── Create Employee ──

export class CreateEmployeeDto {
  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  @MinLength(3)
  name: string;

  @ApiProperty({ example: '123.456.789-00' })
  @IsString()
  cpf: string;

  @ApiProperty({ example: 'Médico Oftalmologista' })
  @IsString()
  role: string;

  @ApiProperty({ example: 'Médico' })
  @IsString()
  department: string;

  @ApiProperty({ enum: EmployeeTypeDto })
  @IsEnum(EmployeeTypeDto)
  type: EmployeeTypeDto;

  @ApiProperty({ example: 15000.00 })
  @IsNumber({ maxDecimalPlaces: 2 })
  salary: number;

  @ApiProperty({ example: '2025-03-01' })
  @IsDateString()
  admission_date: string;

  // ── Campos PJ ──
  @ApiPropertyOptional({ example: '12.345.678/0001-90' })
  @IsOptional()
  @IsString()
  cnpj?: string;

  @ApiPropertyOptional({ example: 'Santos Oftalmologia Ltda' })
  @IsOptional()
  @IsString()
  company_name?: string;

  @ApiPropertyOptional({ example: 'Rua das Clínicas, 100' })
  @IsOptional()
  @IsString()
  company_address?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  @ApiPropertyOptional({ enum: EmployeeStatusDto })
  @IsOptional()
  @IsEnum(EmployeeStatusDto)
  status?: EmployeeStatusDto;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  dismissal_date?: string;
}

// ── Create Document ──

export class CreateEmployeeDocumentDto {
  @ApiProperty({ example: 'CRM' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ example: '12345-PR' })
  @IsOptional()
  @IsString()
  number?: string;

  @ApiPropertyOptional({ example: '2025-01-15' })
  @IsOptional()
  @IsDateString()
  issued_at?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

// ── Filters ──

export class EmployeeFilterDto {
  @ApiPropertyOptional({ enum: EmployeeStatusDto })
  @IsOptional()
  @IsEnum(EmployeeStatusDto)
  status?: EmployeeStatusDto;

  @ApiPropertyOptional({ enum: EmployeeTypeDto })
  @IsOptional()
  @IsEnum(EmployeeTypeDto)
  type?: EmployeeTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  department?: string;
}
