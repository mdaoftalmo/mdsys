// apps/backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;       // user id (uuid)
  login: string;
  name: string;
  access_level: string;
  unit_id: string | null;
}

export interface AuthenticatedUser {
  id: string;
  login: string;
  name: string;
  access_level: string;
  unit_id: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string; user: AuthenticatedUser }> {
    const user = await this.prisma.systemUser.findUnique({
      where: { login: dto.login },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      this.logger.warn(`Login falhou para: ${dto.login}`);
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload: JwtPayload = {
      sub: user.id,
      login: user.login,
      name: user.name,
      access_level: user.access_level,
      unit_id: user.unit_id,
    };

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      login: user.login,
      name: user.name,
      access_level: user.access_level,
      unit_id: user.unit_id,
    };

    this.logger.log(`Login OK: ${user.login} (${user.access_level})`);

    return {
      access_token: this.jwt.sign(payload),
      user: authenticatedUser,
    };
  }

  async validateUser(payload: JwtPayload): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.systemUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, login: true, name: true, access_level: true, unit_id: true, is_active: true },
    });

    if (!user || !user.is_active) return null;

    return {
      id: user.id,
      login: user.login,
      name: user.name,
      access_level: user.access_level,
      unit_id: user.unit_id,
    };
  }

  /**
   * Resolve which unit_ids the user can access.
   * FULL / FINANCEIRO with unit_id=null → all units.
   * Otherwise → only their assigned unit.
   */
  async resolveUnitScope(user: AuthenticatedUser): Promise<string[] | 'all'> {
    if (
      (user.access_level === 'FULL' || user.access_level === 'FINANCEIRO') &&
      !user.unit_id
    ) {
      return 'all';
    }

    if (user.unit_id) return [user.unit_id];

    // Non-privileged user without unit_id = config error
    throw new ForbiddenException(
      'Usuário sem unidade vinculada. Contate o administrador.',
    );
  }

  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }
}
