// apps/backend/src/common/middleware/correlation-id.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

/**
 * Generates a correlation_id for each request.
 * - Reads X-Correlation-Id header if present (from upstream proxy)
 * - Otherwise generates a new UUID
 * - Attaches to req.correlationId
 * - Echoes in response header X-Correlation-Id
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId =
      (req.headers['x-correlation-id'] as string) || randomUUID();

    (req as any).correlationId = correlationId;
    res.setHeader('X-Correlation-Id', correlationId);

    next();
  }
}
