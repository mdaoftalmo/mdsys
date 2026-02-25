// apps/backend/src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuditHelper } from '../common/helpers/audit.helper';

@Global()
@Module({
  providers: [PrismaService, AuditHelper],
  exports: [PrismaService, AuditHelper],
})
export class PrismaModule {}
