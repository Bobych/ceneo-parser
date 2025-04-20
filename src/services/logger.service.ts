import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ILog } from '@interfaces';

@Injectable()
export class LoggerService {
  constructor(private readonly redis: RedisService) {}

  async set(log: ILog) {
    console.log(log.message);
    await this.redis.setLog({
      key: `logs:${log.service}`,
      value: `${log.message}`,
    });
  }
}
