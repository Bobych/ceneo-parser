import { Module } from '@nestjs/common';
import { LoggerService } from '@services/logger.service';
import { RedisModule } from './redis.module';

@Module({
  imports: [RedisModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
