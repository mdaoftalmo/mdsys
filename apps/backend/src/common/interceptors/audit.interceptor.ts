import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global interceptor that writes to activity_logs (append-only)
 * on every mutation request. Non-blocking: fire-and-forget.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    if (!MUTATION_METHODS.has(method)) return next.handle();

    const user = request.user;
    if (!user) return next.handle();

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          // Fire-and-forget audit log
          this.writeAuditLog(request, user, responseBody).catch((err) =>
            this.logger.error(`Audit log failed: ${err.message}`),
          );
        },
        error: () => {
          // Don't log failed requests to audit (they didn't change state)
        },
      }),
    );
  }

  private async writeAuditLog(
    request: any,
    user: any,
    responseBody: any,
  ): Promise<void> {
    // Extract entity info from URL: /api/financeiro/payables/uuid → entity=payable
    const pathParts = request.url.replace(/^\/api\//, '').split('/');
    const entity = pathParts[1] || pathParts[0] || 'unknown';
    const entityId = this.extractUuid(pathParts);

    const actionMap: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    await this.prisma.activityLog.create({
      data: {
        user_id: user.id,
        unit_id: user.unit_id || request.query?.unit_id || null,
        action: actionMap[request.method] || request.method,
        entity: entity.replace(/s$/, ''), // plurals → singular
        entity_id: entityId,
        details: {
          correlation_id: request.correlationId || null,
          method: request.method,
          path: request.url,
          body: this.sanitizeBody(request.body),
          response_id: responseBody?.id,
        },
        ip_address: request.ip || request.headers['x-forwarded-for'],
      },
    });
  }

  private extractUuid(parts: string[]): string | null {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return parts.find((p) => uuidRegex.test(p)) || null;
  }

  private sanitizeBody(body: any): any {
    if (!body) return null;
    const sanitized = { ...body };

    // Remove sensitive fields (blacklist)
    const PII_FIELDS = [
      'password', 'password_hash', 'token', 'access_token',
      'cpf', 'cnpj', 'email', 'phone', 'patient_cpf',
      'patient_name', 'company_address',
    ];
    for (const field of PII_FIELDS) {
      if (field in sanitized) {
        sanitized[field] = '***REDACTED***';
      }
    }

    // Truncate large fields
    for (const [key, val] of Object.entries(sanitized)) {
      if (typeof val === 'string' && val.length > 500) {
        sanitized[key] = val.substring(0, 500) + '...[truncated]';
      }
    }

    return sanitized;
  }
}
