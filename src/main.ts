/* eslint-disable prettier/prettier */
import 'dotenv/config'; // before anything reads process.env at import time
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import helmet from 'helmet';
import express from 'express';

import { noMongoOperators } from './common/middleware/no-mongo-operators';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: ['error', 'warn', 'log'],
  });

  /* ---------------- Payload limits ---------------- */
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  app.use(noMongoOperators); // reject $-operators in query strings and bodies

  // Transparently route /auth/google and callbacks whether called with or without /api prefix
  app.use((req: any, res: any, next: any) => {
    if (req.url && (req.url.startsWith('/auth/google') || req.url === '/auth/google')) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  // Set global prefix so all routes are under /api
  app.setGlobalPrefix('api');

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
      // Product/banner images are loaded by the storefront, which may sit on another site.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.disable('x-powered-by');

  /* ---------------- Static uploads ---------------- */
  const uploadDir = join(process.cwd(), 'uploads');
  if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

  // Half-processed uploads live in uploads/temp; they must never be downloadable.
  app.use('/uploads/temp', (_req, res) => res.status(404).end());
  app.useStaticAssets(uploadDir, { prefix: '/uploads/', dotfiles: 'deny', index: false });

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

  /* ---------------- Production safety warnings ---------------- */
  if (process.env.NODE_ENV === 'production') {
    if (!/\/\/[^/@]+:[^/@]+@/.test(process.env.MONGODB_URI || '')) {
      logger.warn('🔓 MONGODB_URI has no username/password. Enable MongoDB auth and bind it to localhost or a private network only.');
    }
    if (!process.env.REDIS_PASSWORD && !['127.0.0.1', 'localhost', ''].includes(process.env.REDIS_HOST || '')) {
      logger.warn('🔓 Redis is on a non-local host without REDIS_PASSWORD.');
    }
    if (process.env.COD_ENABLED === 'true') {
      logger.warn('COD_ENABLED=true: unpaid (cash on delivery) orders can be placed through the public API.');
    }
  }

  /* ---------------- Graceful shutdown ---------------- */
  const shutdown = async (signal: string) => {
    logger.warn(`${signal} received, shutting down...`);
    await app.close();
    process.exit(0);
  };

  // A missed await anywhere must not take the whole API down: log it and carry on.
  process.on('unhandledRejection', (reason) => {
    logger.error(`Unhandled promise rejection: ${reason instanceof Error ? reason.stack : String(reason)}`);
  });

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch(err => {
  // last-resort crash log
  console.error('BOOTSTRAP FAILURE', err);
  process.exit(1);
});
