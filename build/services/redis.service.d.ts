import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IRedisObject } from '@interfaces';
import { SocketGateway } from '../gateway/socket.gateway';
export declare class RedisService implements OnModuleInit {
    private readonly config;
    private readonly socket;
    private client;
    private pubSubClient;
    private readonly statusKeys;
    private readonly logKeys;
    constructor(config: ConfigService, socket: SocketGateway);
    onModuleInit(): Promise<void>;
    setStatus({ key, value }: IRedisObject): Promise<void>;
    setLog({ key, value }: IRedisObject): Promise<void>;
    handleUpdate(channel: string): Promise<void>;
    getStatus({ key }: {
        key: string;
    }): Promise<string>;
    getLog({ key }: {
        key: string;
    }): Promise<string[]>;
    get({ key }: Pick<IRedisObject, 'key'>): Promise<string>;
    set({ key, value }: IRedisObject): Promise<"OK">;
}
