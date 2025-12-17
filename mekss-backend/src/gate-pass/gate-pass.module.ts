import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

// Services
import { GatePassService } from './services/gate-pass.service';

// Controllers
import { GatePassController } from './controllers/gate-pass.controller';

// Entities and repositories would be handled by Prisma

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sms',
    }),
  ],
  controllers: [GatePassController],
  providers: [GatePassService],
  exports: [GatePassService],
})
export class GatePassModule {}