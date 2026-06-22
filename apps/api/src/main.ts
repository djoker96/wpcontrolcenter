import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root directory .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validateEnvironment, getCorsOrigins } from './config/env';

async function bootstrap(): Promise<void> {
  // Fail fast: validate all required env vars before anything else
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');

  // Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(
    helmet({
      // Dashboard is a separate Next.js app served by nginx; allow inline styles
      // and scripts that the framework emits. Tighten further when needed.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // Trust the first proxy hop so X-Forwarded-For is honoured for rate limiting
  // when the API runs behind nginx in production.
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', 1);

  // CORS restricted to configured origins (CORS_ORIGIN env var).
  // Returns false (CORS disabled) when not configured.
  app.enableCors({
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  // AllExceptionsFilter catches everything; PrismaExceptionFilter runs first
  // for Prisma-specific errors, then falls through to AllExceptionsFilter
  // for all other exceptions.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}

void bootstrap();

