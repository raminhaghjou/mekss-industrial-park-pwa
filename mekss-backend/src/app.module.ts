import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnprModule } from './anpr/anpr.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'] }),
    CoreModule,
    AnprModule,
  ],
})
export class AppModule {}
