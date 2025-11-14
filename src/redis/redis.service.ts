import { ENV } from '@/constants';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';
import { ILog } from '@/interfaces/LogInterface';
import { IRedisObject } from '@/interfaces/RedisObjectInterface';
import { SocketService } from '@/socket/socket.service';

@Injectable()
export class RedisService implements OnModuleInit {
    private client: Redis;
    private pubSubClient: Redis;

    private readonly logKeys: ILog['service'][] = ['parser', 'category_result'];

    constructor(
        private readonly config: ConfigService,
        @Inject(forwardRef(() => SocketService))
        private readonly socket: SocketService,
    ) {
        this.client = new Redis({
            host: this.config.get<string>(ENV.REDIS_HOST),
            port: Number(this.config.get<string>(ENV.REDIS_PORT)),
        });

        this.pubSubClient = new Redis({
            host: this.config.get<string>(ENV.REDIS_HOST),
            port: Number(this.config.get<string>(ENV.REDIS_PORT)),
        });

        this.client.on('error', async error => {
            console.log(`Error by starting redis service: ${error}`);
        });

        this.pubSubClient.on('error', async error => {
            console.log(`Error by starting redis pub/sub: ${error}`);
        });
    }

    async onModuleInit() {
        this.logKeys.forEach(key => {
            const k = `logs:${key}`;
            this.pubSubClient.subscribe(k, async (error, count) => {
                if (error) {
                    console.log(`[LOGS] Redis pub/sub error on ${k}: ${error}`);
                } else {
                    console.log(
                        `[LOGS] Subscribed to ${count} channels. Listening for updates on ${k}.`,
                    );
                }
            });
        });

        this.pubSubClient.on('message', async (channel, message) => {
            await this.handleUpdate(channel);
        });
    }

    async setLog({ key, value }: IRedisObject) {
        try {
            await this.client.lpush(key, value);
            await this.client.ltrim(key, 0, 99);
            await this.client.publish(key, 'updated');
        } catch (error) {
            console.log(`[REDIS] ${error}`);
        }
    }

    async handleUpdate(channel: string) {
        const [prefix, key] = channel.split(':');

        if (prefix === 'logs') {
            const logs = await this.client.lrange(channel, 0, 9);
            if (logs.length) {
                await this.socket.sendLog({
                    service: key as ILog['service'],
                    message: logs[0],
                });
            }
        }
    }
}
