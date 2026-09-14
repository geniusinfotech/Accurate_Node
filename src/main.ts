/* eslint-disable prettier/prettier */
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import express from 'express';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { MigrationService } from './scripts/migrate-customer-dealer-links';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn', 'log'],
  });

  /* ---------------- Payload limits ---------------- */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:9008';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  /* ---------------- Security ---------------- */
  app.set('trust proxy', 1);
  // Cookie parser required for jwt cookie extraction
  const cookieParser = (await import('cookie-parser')).default;
  app.use(cookieParser());

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "blob:", frontendUrl, ...allowedOrigins],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", "ws:", "wss:", frontendUrl, ...allowedOrigins],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.disable('x-powered-by');

  /* ---------------- Static uploads ---------------- */
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

  app.useStaticAssets(uploadDir, { prefix: '/uploads/' });

  /* ---------------- Logging ---------------- */
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      // Redact sensitive query params from logs
      let url = req.originalUrl || req.url;
      try {
        url = url.replace(/(token|resetToken|password|secret|key)=[^&]*/gi, '$1=[REDACTED]');
      } catch {}
      logger.log(
        `${req.method} ${url} ${res.statusCode} ${Date.now() - start}ms`,
      );
    });
    next();
  });

  /* ---------------- Validation ---------------- */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      transformOptions: { enableImplicitConversion: false },
      forbidUnknownValues: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  /* ---------------- Run Migrations ---------------- */
  const migrationService = app.get(MigrationService);
  await migrationService.migrateCustomerDealerLinks();

  /* ---------------- CORS ---------------- */
  app.enableCors({
    origin: (origin, cb) => {
      // Block null/non-browser origins with credentials — only allow explicit allowlist
      if (!origin) return cb(null, true); // allow health checks / same-origin; browser always sends Origin for CORS
      const isAllowed = allowedOrigins.includes(origin) || origin === frontendUrl;
      if (isAllowed) return cb(null, true);
      return cb(new Error('CORS blocked'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-refresh-token'],
    maxAge: 600,
  });

  /* ---------------- Start ---------------- */
  const port = Number(process.env.PORT) || 9004;
  await app.listen(port);

  logger.log(`🚀 Server running on port ${port}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV ?? 'development'}`);

  /* ---------------- Cookie policy (auth cookies live or die by this) ---------------- */
  const cookieCrossSite = process.env.COOKIE_CROSS_SITE === 'true';
  const cookieSecure = cookieCrossSite || process.env.COOKIE_SECURE !== 'false';
  logger.log(
    `🍪 Auth cookies: sameSite=${cookieCrossSite ? 'none' : 'lax'} secure=${cookieSecure} domain=${process.env.COOKIE_DOMAIN || '(host-only)'}`,
  );
  if (cookieSecure && frontendUrl.startsWith('http://')) {
    logger.warn(
      '🍪 COOKIE_SECURE is on but FRONTEND_URL is plain HTTP — browsers will drop the auth cookie. Serve over HTTPS or set COOKIE_SECURE=false.',
    );
  }
  if (cookieCrossSite && !process.env.COOKIE_DOMAIN) {
    logger.warn(
      '🍪 COOKIE_CROSS_SITE is on without COOKIE_DOMAIN — the cookie stays host-only on the API hostname and the frontend will never receive it.',
    );
  }

  /* ---------------- Graceful shutdown ---------------- */
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received, shutting down...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(err => {
  // last-resort crash log
  console.error('BOOTSTRAP FAILURE', err);
  process.exit(1);
});
