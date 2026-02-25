import { createParamDecorator, ExecutionContext, BadRequestException } from '@nestjs/common';

/**
 * Extracts unit_id from query params or user context.
 * Usage: @UnitScope() unitId: string
 * 
 * Priority:
 * 1. ?unit_id=xxx in query string (if user has multi-unit access)
 * 2. User's assigned unit_id
 * 3. Throws if neither available
 */
export const UnitScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // Query param override (only if user has multi-unit access)
    const queryUnitId = request.query?.unit_id;
    if (queryUnitId && (!user.unit_id || user.access_level === 'FULL')) {
      return queryUnitId as string;
    }

    // User's assigned unit
    if (user.unit_id) return user.unit_id;

    // Multi-unit user must specify unit_id
    throw new BadRequestException(
      'Parâmetro unit_id obrigatório para usuários multi-unidade',
    );
  },
);
