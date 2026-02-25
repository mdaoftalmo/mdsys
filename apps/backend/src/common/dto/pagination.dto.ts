// apps/backend/src/common/dto/pagination.dto.ts
import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ example: 'created_at' })
  @IsOptional()
  @IsString()
  sort_by?: string;

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Helper to build Prisma skip/take from PaginationDto.
 * Returns { skip, take, orderBy } for use in findMany.
 */
export function paginateArgs(
  dto: PaginationDto,
  defaultSortField = 'created_at',
): { skip: number; take: number; orderBy: Record<string, 'asc' | 'desc'> } {
  const page = dto.page || 1;
  const limit = dto.limit || 50;
  const sortBy = dto.sort_by || defaultSortField;
  const sortOrder = dto.sort_order || 'desc';

  return {
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { [sortBy]: sortOrder },
  };
}

/**
 * Wraps data + count into PaginatedResult.
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  dto: PaginationDto,
): PaginatedResult<T> {
  const limit = dto.limit || 50;
  const page = dto.page || 1;
  return {
    data,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}
