import { Module } from '@nestjs/common';

import { GoogleService } from './google.service';
import { RedisModule } from '@/redis/redis.module';
import { LoggerModule } from '@/logger/logger.module';

@Module({
  imports: [RedisModule, LoggerModule],
  providers: [GoogleService],
  exports: [GoogleService],
})
export class GoogleModule {}
