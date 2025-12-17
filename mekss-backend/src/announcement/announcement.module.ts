import { Module } from '@nestjs/common';
import { AnnouncementService } from './services/announcement.service';
import { AnnouncementController } from './controllers/announcement.controller';
import { SharedModule } from '../../shared/shared.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [SharedModule, ScheduleModule.forRoot()],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
