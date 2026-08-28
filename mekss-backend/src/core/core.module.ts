import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { HealthController } from './health.controller';
import { JwtAuthGuard, RolesGuard } from './auth.guard';
import { PrismaService } from './prisma.service';
import { SmsGateway } from './sms.gateway';
import { ManagementController, PaymentCallbackController } from './management.controller';
import { ManagementService } from './management.service';
import { ApiExceptionFilter } from './api-exception.filter';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_ACCESS_SECRET') || config.get<string>('JWT_SECRET');
        if (!secret && config.get<string>('NODE_ENV') === 'production') {
          throw new Error('JWT_ACCESS_SECRET is required in production');
        }
        return { secret: secret || 'development-only-change-me', signOptions: { expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') } };
      },
    }),
  ],
  controllers: [AuthController, HealthController, ManagementController, PaymentCallbackController],
  providers: [PrismaService, AuditService, AuthService, SmsGateway, ManagementService, JwtAuthGuard, RolesGuard, { provide: APP_FILTER, useClass: ApiExceptionFilter }],
  exports: [PrismaService, AuditService, JwtAuthGuard, RolesGuard],
})
export class CoreModule {}
