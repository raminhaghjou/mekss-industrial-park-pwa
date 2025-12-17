import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TerminusModule } from '@nestjs/terminus';

// Application modules
import { AuthModule } from './auth/auth.module';
import { FactoryModule } from './factory/factory.module';
import { GatePassModule } from './gate-pass/gate-pass.module';
import { InvoiceModule } from './invoice/invoice.module';
import { MessageModule } from './message/message.module';
import { RequestModule } from './request/request.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { AdvertisementModule } from './advertisement/advertisement.module';
import { EmergencyModule } from './emergency/emergency.module';
import { AnalyticsModule } from './analytics/analytics.module';

// Shared modules
import { SharedModule } from './shared/shared.module';

// Import environment configuration
import * as path from 'path';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Scheduler
    ScheduleModule.forRoot(),

    // Bull queue
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),

    // Serve static files
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),

    // Health check
    TerminusModule,

    // Application modules
    SharedModule,
    AuthModule,
    FactoryModule,
    GatePassModule,
    InvoiceModule,
    MessageModule,
    RequestModule,
    AnnouncementModule,
    AdvertisementModule,
    EmergencyModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}