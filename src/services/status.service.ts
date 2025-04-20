import { Injectable } from '@nestjs/common';

import { RedisService } from './redis.service';
import { IStatus } from '@interfaces';

@Injectable()
export class StatusService {
  constructor(private readonly redis: RedisService) {}

  async set(status: IStatus) {
    console.log(`Updated status:${status.type}: ${status.data}`);
    await this.redis.setStatus({
      key: `status:${status.type}`,
      value: status.data,
    });
  }
}
