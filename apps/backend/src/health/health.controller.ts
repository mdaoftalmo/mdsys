// apps/backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { SkipUnitScope } from '../common/decorators/skip-unit-scope.decorator';

@ApiTags('health')
@SkipUnitScope()
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check (DB + uptime)' })
  async check() {
    let dbStatus = 'disconnected';
    let dbLatencyMs = -1;

    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      db: {
        status: dbStatus,
        latency_ms: dbLatencyMs,
      },
      version: process.env.npm_package_version || '0.1.0',
    };
  }
}
