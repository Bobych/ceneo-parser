import { Module } from '@nestjs/common';

import { StatusService } from '@services/status.service';
import { RedisModule } from './redis.module';

@Module({
  imports: [RedisModule],
  providers: [StatusService],
  exports: [StatusService],
})
export class StatusModule {}
