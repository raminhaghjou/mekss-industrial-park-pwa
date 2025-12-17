import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PrismaService } from './shared/services/prisma.service';
import { LoggerService } from './shared/services/logger.service';
import helmet from 'helmet';
import * as compression from 'compression';
import * as rateLimit from 'express-rate-limit';
import * as session from 'express-session';
import * as passport from 'passport';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = app.get(LoggerService);
  const prismaService = app.get(PrismaService);

  const PORT = configService.get<number>('PORT') || 3000;
  const NODE_ENV = configService.get<string>('NODE_ENV') || 'development';

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  }));

  // Compression
  app.use(compression());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        statusCode: 429,
        message: 'Too many requests from this IP, please try again later.',
        error: 'Too Many Requests',
      },
    }),
  );

  // OTP Rate limiting
  app.use(
    '/api/v1/auth/otp/send',
    rateLimit({
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 3, // limit each IP to 3 requests per windowMs
      message: {
        statusCode: 429,
        message: 'Too many OTP requests, please try again later.',
        error: 'Too Many Requests',
      },
    }),
  );

  // Body parser
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Session
  app.use(
    session({
      secret: configService.get<string>('SESSION_SECRET') || 'mekss-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
    }),
  );

  // Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // CORS
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL') || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  if (NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Mekss Industrial Park API')
      .setDescription('API documentation for Mekss Industrial Park Management System')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  // Graceful shutdown
  await prismaService.enableShutdownHooks(app);

  await app.listen(PORT);
  logger.log(`Application is running on: http://localhost:${PORT}`);
  logger.log(`Environment: ${NODE_ENV}`);
  
  if (NODE_ENV !== 'production') {
    logger.log(`API Documentation: http://localhost:${PORT}/api/docs`);
  }
}

bootstrap();