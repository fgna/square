import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import * as fs from 'fs';
import { AppModule } from './app.module';
import { protectLessonAttachments } from './uploads/attachment-links';
import { PrismaService } from './prisma/prisma.service';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

function validateConfig() {
  const logger = new Logger('Bootstrap');
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.fatal(`Missing required environment variables: ${missing.join(', ')}. Refusing to start.`);
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const placeholders = ['change-me', 'changeme', 'your-secret', 'your-jwt', 'example', 'placeholder', 'todo', 'insert-', 'replace-', 'put-your'];
    for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
      const val = process.env[key] ?? '';
      if (placeholders.some((p) => val.toLowerCase().includes(p))) {
        logger.fatal(`${key} looks like a placeholder value. Generate a real secret with: openssl rand -hex 32`);
        process.exit(1);
      }
      if (val.length < 32) {
        logger.fatal(`${key} is too short (${val.length} chars). Minimum 32 characters required.`);
        process.exit(1);
      }
    }

    const corsOrigins = process.env.CORS_ORIGINS ?? '';
    if (!corsOrigins || corsOrigins.trim() === '*' || corsOrigins.split(',').some((o) => o.trim() === '*')) {
      logger.fatal('CORS_ORIGINS must be set to specific origins in production. Wildcard (*) is not allowed.');
      process.exit(1);
    }
  }
}

async function bootstrap() {
  validateConfig();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(PinoLogger));
  const logger = new Logger('Bootstrap');

  app.enableShutdownHooks();
  app.set('trust proxy', 1);
  app.use(cookieParser());

  // Ensure uploads directory exists and serve as static files
  const uploadsDir = join(process.cwd(), 'uploads');
  fs.mkdirSync(join(uploadsDir, 'avatars'), { recursive: true });
  // Lesson attachments need a signed link; everything else stays public.
  app.use('/uploads', protectLessonAttachments(app.get(PrismaService)));
  app.useStaticAssets(uploadsDir, { prefix: '/uploads' });

  // Security
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger (the only thing that ever needed inline scripts here) is
          // dev-only (see below) — production serves no HTML/scripts, so
          // script-src needs neither 'unsafe-inline' nor 'unsafe-eval'.
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://*.googleusercontent.com', 'https://images.unsplash.com'],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      } : false,
    }),
  );

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Refresh-Token'],
    exposedHeaders: ['X-New-Access-Token', 'X-Request-Id'],
  });

  // Global prefix (health excluded so infra/Docker can probe /health directly)
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  // Global exception filter — prevents stack traces leaking in production
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Community Platform API')
      .setDescription('API for the Community Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger UI available at /api/docs');
  }

  const port = process.env.API_PORT || 3001;
  await app.listen(port, process.env.API_HOST || "0.0.0.0");
  logger.log(`Application running on port ${port}`);
}

bootstrap();
