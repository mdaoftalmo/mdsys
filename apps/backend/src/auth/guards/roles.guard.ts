import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Usuário não autenticado');

    // FULL has access to everything
    if (user.access_level === 'FULL') return true;

    if (!requiredRoles.includes(user.access_level)) {
      throw new ForbiddenException(
        `Acesso negado. Nível necessário: ${requiredRoles.join(' ou ')}`,
      );
    }
    return true;
  }
}
