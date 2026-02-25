// apps/backend/src/modules/patients/patients.dto.ts
import {
  IsString, IsOptional, IsDateString, IsEmail,
  MinLength, MaxLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreatePatientDto {
  @ApiProperty({ example: 'Maria Aparecida Santos' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: '123.456.789-09', description: 'CPF formatado (000.000.000-00)' })
  @IsString()
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, { message: 'CPF deve estar no formato 000.000.000-00' })
  cpf: string;

  @ApiPropertyOptional({ example: '12.345.678-9' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rg?: string;

  @ApiProperty({ example: '1965-03-15', description: 'Data de nascimento (YYYY-MM-DD)' })
  @IsDateString()
  dob: string;

  @ApiPropertyOptional({ example: '(11) 99999-1234' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'maria@email.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ example: 'Rua das Flores, 123 - São Paulo/SP' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @ApiPropertyOptional({ example: 'Indicação médico', description: 'Como conheceu a clínica' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  source_channel?: string;

  @ApiPropertyOptional({ example: 'Paciente diabética, acompanhar glicemia' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePatientDto extends PartialType(CreatePatientDto) {}
