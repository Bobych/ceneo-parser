import { ILog, IStatus } from '@interfaces';
import { RedisService } from '@services/redis.service';
import { Server } from 'socket.io';
export declare class SocketGateway {
    private readonly redis;
    server: Server;
    private readonly statusKeys;
    private readonly logKeys;
    constructor(redis: RedisService);
    sendStatus(status: IStatus): Promise<void>;
    sendLog(log: ILog): Promise<void>;
}
