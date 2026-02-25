// apps/backend/src/auth/permissions/permissions.guard.ts
import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { Permission, ACCESS_LEVEL_PERMISSIONS } from './permissions.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @RequirePermissions → allow (fall through to RolesGuard)
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Usuário não autenticado');

    const userPerms = ACCESS_LEVEL_PERMISSIONS[user.access_level] || [];

    const missing = required.filter((p) => !userPerms.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Permissões insuficientes. Faltam: ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
