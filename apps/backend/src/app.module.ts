// apps/backend/src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FinanceiroModule } from './modules/financeiro/financeiro.module';
import { EstoqueModule } from './modules/estoque/estoque.module';
import { RhModule } from './modules/rh/rh.module';
import { OrientacaoCirurgicaModule } from './modules/orientacao-cirurgica/orientacao-cirurgica.module';
import { BiModule } from './modules/bi/bi.module';
import { UnitsModule } from './modules/units/units.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SalesModule } from './modules/sales/sales.module';
import { ServicesModule } from './modules/services/services.module';
import { ConveniosModule } from './modules/convenios/convenios.module';
import { AbasusModule } from './modules/abasus/abasus.module';
import { AiModule } from './modules/ai/ai.module';
import { CronModule } from './cron/cron.module';
import { HealthModule } from './health/health.module';
import { UnitScopeGuard } from './common/guards/unit-scope.guard';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    // ── Config (.env) ──
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting ──
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    // ── CRON scheduler ──
    ScheduleModule.forRoot(),

    // ── Core ──
    PrismaModule,
    AuthModule,

    // ── Feature modules ──
    FinanceiroModule,
    EstoqueModule,
    RhModule,
    OrientacaoCirurgicaModule,
    BiModule,
    UnitsModule,
    PatientsModule,
    SalesModule,
    ServicesModule,
    ConveniosModule,
    AbasusModule,
    AiModule,

    // ── Background jobs ──
    CronModule,

    // ── Observability ──
    HealthModule,
  ],
  providers: [
    // Global throttler
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global unit scope enforcement
    { provide: APP_GUARD, useClass: UnitScopeGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
