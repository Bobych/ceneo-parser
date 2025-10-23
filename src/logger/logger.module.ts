import { Module } from '@nestjs/common';
import { RedisModule } from '@/redis/redis.module';
import { LoggerService } from './logger.service';

@Module({
  imports: [RedisModule],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}
