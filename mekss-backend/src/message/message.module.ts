import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

// Services
import { MessageService } from './services/message.service';

// Controllers
import { MessageController } from './controllers/message.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification',
    }),
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}