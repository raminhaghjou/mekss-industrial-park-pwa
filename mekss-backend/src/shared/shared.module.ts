import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { LoggerService } from './services/logger.service';
import { SmsService } from './services/sms.service';
import { StorageService } from './services/storage.service';
import { QueueService } from './services/queue.service';
import { UtilService } from './services/util.service';

@Global()
@Module({
  providers: [
    PrismaService,
    LoggerService,
    SmsService,
    StorageService,
    QueueService,
    UtilService,
  ],
  exports: [
    PrismaService,
    LoggerService,
    SmsService,
    StorageService,
    QueueService,
    UtilService,
  ],
})
export class SharedModule {}