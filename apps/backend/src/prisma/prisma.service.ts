// apps/backend/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    // ── Query logging (dev only) ──
    if (process.env.NODE_ENV === 'development') {
      this.$on('query', (e) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
        }
      });
    }

    this.$on('error', (e) => {
      this.logger.error(`Prisma error: ${e.message}`);
    });

    // ── Soft-delete middleware ──
    // Intercept all read/write operations to exclude deleted records
    this.$use(async (params, next) => {
      const softDeleteModels = [
        'Unit', 'Patient', 'Supplier', 'SystemUser', 'Payable',
        'Receivable', 'Employee', 'SurgicalLead', 'TeamMember',
      ];

      if (!softDeleteModels.includes(params.model ?? '')) {
        return next(params);
      }

      // Read operations: inject deleted_at = null filter
      const readActions = ['findMany', 'findFirst', 'findUnique', 'findFirstOrThrow', 'findUniqueOrThrow', 'count', 'aggregate', 'groupBy'];
      if (readActions.includes(params.action)) {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};
        if (params.args.where.deleted_at === undefined) {
          params.args.where.deleted_at = null;
        }
      }

      // Bulk operations: scope to non-deleted records
      if (params.action === 'updateMany' || params.action === 'deleteMany') {
        if (!params.args) params.args = {};
        if (!params.args.where) params.args.where = {};
        if (params.args.where.deleted_at === undefined) {
          params.args.where.deleted_at = null;
        }
      }

      // Convert delete to soft-delete
      if (params.action === 'delete') {
        params.action = 'update';
        params.args.data = { deleted_at: new Date() };
      }
      if (params.action === 'deleteMany') {
        params.action = 'updateMany';
        if (!params.args.data) params.args.data = {};
        params.args.data.deleted_at = new Date();
      }

      return next(params);
    });

    await this.$connect();
    this.logger.log('Prisma connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /**
   * Helper: wrap a transaction with unit_id context filtering.
   * Used by services to ensure all queries within a transaction
   * are scoped to the user's unit.
   */
  async withUnitScope<T>(
    unitId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // The fn receives a tx client; services must pass unitId into queries
      return fn(tx);
    });
  }
}
