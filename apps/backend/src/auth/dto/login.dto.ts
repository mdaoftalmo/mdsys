import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  login: string;

  @ApiProperty({ example: 'mdv@2026!' })
  @IsString()
  @MinLength(6)
  password: string;
}
