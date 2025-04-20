import { RedisService } from './redis.service';
import { IStatus } from '@interfaces';
export declare class StatusService {
    private readonly redis;
    constructor(redis: RedisService);
    set(status: IStatus): Promise<void>;
}
