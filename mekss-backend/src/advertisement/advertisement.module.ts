import { Module } from '@nestjs/common';
import { AdvertisementService } from './services/advertisement.service';
import { AdvertisementController } from './controllers/advertisement.controller';
import { SharedModule } from '../../shared/shared.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [SharedModule, ScheduleModule.forRoot()],
  controllers: [AdvertisementController],
  providers: [AdvertisementService],
  exports: [AdvertisementService],
})
export class AdvertisementModule {}
