import { Injectable } from '@nestjs/common';

import { RedisService } from '@/redis/redis.service';
import { IStatus } from '@/interfaces/StatusInterface';

@Injectable()
export class StatusService {
  constructor(private readonly redis: RedisService) {}

  async set(status: IStatus) {
    await this.redis.setStatus({
      key: `status:${status.type}`,
      value: status.data,
    });
  }
}
