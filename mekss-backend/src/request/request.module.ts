import { Module } from '@nestjs/common';
import { RequestService } from './services/request.service';
import { RequestController } from './controllers/request.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [RequestController],
  providers: [RequestService],
  exports: [RequestService],
})
export class RequestModule {}
