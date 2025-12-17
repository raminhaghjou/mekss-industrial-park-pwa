import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

// Services
import { InvoiceService } from './services/invoice.service';
import { ZarinpalService } from './services/zarinpal.service';

// Controllers
import { InvoiceController } from './controllers/invoice.controller';

// Entities and repositories would be handled by Prisma

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sms',
    }),
  ],
  controllers: [InvoiceController],
  providers: [InvoiceService, ZarinpalService],
  exports: [InvoiceService, ZarinpalService],
})
export class InvoiceModule {}