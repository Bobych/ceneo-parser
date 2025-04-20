import { Module } from '@nestjs/common';

import { GoogleService } from '@services/google.service';
import { RedisModule } from './redis.module';
import { LoggerModule } from './logger.module';

@Module({
  imports: [RedisModule, LoggerModule],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
