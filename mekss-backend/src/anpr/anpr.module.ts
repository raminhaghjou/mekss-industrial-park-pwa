import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { raw } from 'express';
import { CoreModule } from '../core/core.module';
import { AnprEngineService } from './anpr-engine.service';
import { AnprController } from './anpr.controller';
import { AnprGateway } from './anpr.gateway';
import { AnprService } from './anpr.service';
import { NodeAnprEngine } from './engines/node-anpr.engine';
import { PythonAnprEngine } from './engines/python-anpr.engine';
import { PlateMatcherService } from './plate-matcher.service';
import { PlateReadAuditService } from './plate-read-audit.service';

@Module({
  imports: [CoreModule, ScheduleModule.forRoot()],
  controllers: [AnprController],
  providers: [
    PythonAnprEngine,
    NodeAnprEngine,
    AnprEngineService,
    PlateMatcherService,
    PlateReadAuditService,
    AnprService,
    AnprGateway,
  ],
  exports: [AnprEngineService, PlateMatcherService],
})
export class AnprModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(raw({ type: ['image/*', 'application/octet-stream'], limit: '2mb' }))
      .forRoutes({ path: 'api/v1/anpr/recognize', method: RequestMethod.POST });
  }
}
