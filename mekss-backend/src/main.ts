import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as compression from 'compression';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { requestContextMiddleware } from './core/request-context';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const environment = config.get<string>('NODE_ENV', 'development');
  const origins = (config.get<string>('CORS_ORIGINS') || config.get<string>('FRONTEND_URL') || 'http://localhost:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean);

  app.enableShutdownHooks();
  app.use(requestContextMiddleware);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.enableCors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin)),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  if (environment !== 'production' || config.get<string>('SWAGGER_ENABLED') === 'true') {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder()
      .setTitle('MEKSS Industrial Park API')
      .setVersion('1.0')
      .addBearerAuth()
      .build());
    SwaggerModule.setup('api/docs', app, document, { swaggerOptions: { persistAuthorization: environment !== 'production' } });
  }

  const port = Number(config.get<string>('PORT', '3000'));
  await app.listen(port, '0.0.0.0');
  logger.log(`MEKSS API listening on port ${port} (${environment})`);
}

bootstrap().catch((error: unknown) => {
  // Nest may not yet have initialized its logger on boot failure.
  console.error('Unable to start MEKSS API', error);
  process.exit(1);
});
