// apps/backend/src/common/guards/unit-scope.guard.ts
import {
  Injectable, CanActivate, ExecutionContext,
  ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_UNIT_SCOPE_KEY } from '../decorators/skip-unit-scope.decorator';

/**
 * Global guard that resolves unit_id for every authenticated request.
 *
 * Logic:
 * 1. If @SkipUnitScope() → pass through (auth, health, cross-unit BI)
 * 2. If user has unit_id → use it (SECRETARIA)
 * 3. If query.unit_id provided AND user is FULL/FINANCEIRO → use it
 * 4. If FULL/FINANCEIRO without unit_id in query → allow (cross-unit)
 * 5. If SECRETARIA without unit_id → FORBIDDEN (data bug)
 *
 * Sets req.resolvedUnitId (string | null) for downstream use.
 */
@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_UNIT_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // No user = pre-auth endpoint, skip
    if (!user) return true;

    const queryUnitId = request.query?.unit_id as string | undefined;
    const isMultiUnit = user.access_level === 'FULL' || user.access_level === 'FINANCEIRO';

    if (user.unit_id) {
      // User is bound to a unit
      if (queryUnitId && queryUnitId !== user.unit_id) {
        throw new ForbiddenException(
          'Sem permissão para acessar dados de outra unidade',
        );
      }
      request.resolvedUnitId = user.unit_id;
    } else if (isMultiUnit) {
      // Multi-unit user: use query param or null (cross-unit)
      request.resolvedUnitId = queryUnitId || null;
    } else {
      // SECRETARIA without unit_id = config error
      throw new ForbiddenException(
        'Usuário sem unidade vinculada. Contate o administrador.',
      );
    }

    return true;
  }
}
