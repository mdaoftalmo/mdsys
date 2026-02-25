// apps/backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const config = app.get(ConfigService);
  const prisma = app.get(PrismaService);

  // ── Global Pipes ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // strip unknown properties
      forbidNonWhitelisted: true, // throw on unknown properties
      transform: true,            // auto-transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── Global Filters & Interceptors ──
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new AuditInterceptor(prisma));

  // ── CORS ──
  const corsOrigin = config.get('BACKEND_CORS_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: corsOrigin.includes(',')
      ? corsOrigin.split(',').map((s: string) => s.trim())
      : corsOrigin,
    credentials: true,
  });

  // ── Swagger ──
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('ERP MDV Oftalmologia')
      .setDescription('API do sistema ERP multi-unidade para clínicas oftalmológicas')
      .setVersion('0.1.0')
      .addBearerAuth()
      .addTag('auth', 'Autenticação e autorização')
      .addTag('financeiro', 'Contas a pagar/receber, conciliação, DRE')
      .addTag('estoque', 'Itens, níveis, movimentações FEFO, compras')
      .addTag('rh', 'Colaboradores, contratos, documentos')
      .addTag('orientacao-cirurgica', 'Pipeline de leads cirúrgicos')
      .addTag('bi', 'Analytics e dashboards (somente leitura)')
      .addTag('ai', 'Insights via Claude AI')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // ── Prefix ──
  app.setGlobalPrefix('api');

  // ── Graceful Shutdown ──
  app.enableShutdownHooks();

  const port = config.get('BACKEND_PORT', 3001);
  await app.listen(port);

  Logger.log(`🚀 ERP MDV Backend running on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📖 Swagger at http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap();
