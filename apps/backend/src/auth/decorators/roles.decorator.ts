import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * @Roles('FULL', 'FINANCEIRO') → only FULL or FINANCEIRO can access.
 * FULL always bypasses (enforced in RolesGuard).
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
