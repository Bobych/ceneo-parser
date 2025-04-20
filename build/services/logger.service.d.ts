import { RedisService } from './redis.service';
import { ILog } from '@interfaces';
export declare class LoggerService {
    private readonly redis;
    constructor(redis: RedisService);
    set(log: ILog): Promise<void>;
}
