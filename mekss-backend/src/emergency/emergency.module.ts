import { Module } from '@nestjs/common';
import { EmergencyService } from './services/emergency.service';
import { EmergencyController } from './controllers/emergency.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [SharedModule],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule {}
