// apps/backend/src/common/decorators/skip-unit-scope.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const SKIP_UNIT_SCOPE_KEY = 'skip_unit_scope';

/**
 * Mark an endpoint to skip the global UnitScopeGuard.
 * Used for: /auth/login, /auth/me, /health, cross-unit BI endpoints.
 */
export const SkipUnitScope = () => SetMetadata(SKIP_UNIT_SCOPE_KEY, true);
