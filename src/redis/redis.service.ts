import { ENV } from '@/constants';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';
import { ILog } from '@/interfaces/LogInterface';
import { IRedisObject } from '@/interfaces/RedisObjectInterface';
import { IStatus } from '@/interfaces/StatusInterface';
import { SocketService } from '@/socket/socket.service';

@Injectable()
export class RedisService implements OnModuleInit {
  private client: Redis;
  private pubSubClient: Redis;

  private readonly statusKeys: IStatus['type'][] = [
    'product',
    'categorypage',
    'googlerow',
  ];
  private readonly logKeys: ILog['service'][] = ['google', 'parser', 'redis'];

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

    this.client.on('error', async (error) => {
      console.log(`Error by starting redis service: ${error}`);
    });

    this.pubSubClient.on('error', async (error) => {
      console.log(`Error by starting redis pub/sub: ${error}`);
    });
  }

  async onModuleInit() {
    this.statusKeys.forEach((key) => {
      const k = `status:${key}`;
      this.pubSubClient.subscribe(k, async (error, count) => {
        if (error) {
          console.log(`[STATUS] Redis pub/sub error on ${k}: ${error}`);
        } else {
          console.log(
            `[STATUS] Subscribed to ${count} channels. Listening for updates on ${k}.`,
          );
        }
      });
    });

    this.logKeys.forEach((key) => {
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

  async setStatus({ key, value }: IRedisObject) {
    try {
      await this.client.set(key, value);
      await this.client.publish(key, 'updated');
    } catch (error) {
      console.log(`[REDIS] ${error}`);
    }
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

    if (prefix === 'status') {
      const status = await this.client.get(channel);
      if (status) {
        await this.socket.sendStatus({
          type: key as IStatus['type'],
          data: status,
        });
      }
    }

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

  async getStatus({ key }: { key: string }) {
    try {
      return await this.client.get(key);
    } catch (error) {
      console.log(`[REDIS] ${error}`);
      return null;
    }
  }

  async getLog({ key }: { key: string }) {
    try {
      return await this.client.lrange(key, 0, 9);
    } catch (error) {
      console.log(`[REDIS] ${error}`);
      return [];
    }
  }

  async get({ key }: Pick<IRedisObject, 'key'>) {
    return await this.client.get(key);
  }

  async set({ key, value }: IRedisObject) {
    return await this.client.set(key, value);
  }
}
