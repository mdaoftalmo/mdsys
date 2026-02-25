// apps/backend/src/common/helpers/audit.helper.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditChange {
  entity: string;
  entity_id: string;
  action: string;
  user_id: string;
  unit_id?: string | null;
  before?: Record<string, any>;
  after?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Explicit audit logging for critical operations.
 * Unlike the global AuditInterceptor (generic), this captures
 * structured before/after diffs for business-critical actions.
 *
 * Usage:
 *   await this.audit.logChange({
 *     entity: 'payable', entity_id: id,
 *     action: 'APPROVE', user_id: userId,
 *     before: { status: 'PENDENTE' },
 *     after: { status: 'APROVADO' },
 *   });
 */
@Injectable()
export class AuditHelper {
  constructor(private readonly prisma: PrismaService) {}

  async logChange(change: AuditChange): Promise<void> {
    const diff = this.computeDiff(change.before, change.after);

    await this.prisma.activityLog.create({
      data: {
        user_id: change.user_id,
        unit_id: change.unit_id || null,
        action: change.action,
        entity: change.entity,
        entity_id: change.entity_id,
        details: {
          before: change.before || null,
          after: change.after || null,
          diff,
          ...(change.metadata || {}),
        },
        ip_address: null, // filled by interceptor if available
      },
    });
  }

  /**
   * Compute only changed fields.
   * Returns { field: { from, to } } for each changed field.
   */
  private computeDiff(
    before?: Record<string, any>,
    after?: Record<string, any>,
  ): Record<string, { from: any; to: any }> | null {
    if (!before || !after) return null;

    const diff: Record<string, { from: any; to: any }> = {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    for (const key of allKeys) {
      const bVal = before[key];
      const aVal = after[key];
      if (JSON.stringify(bVal) !== JSON.stringify(aVal)) {
        diff[key] = { from: bVal ?? null, to: aVal ?? null };
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }
}
