import { ILog, IStatus } from '@interfaces';
import { forwardRef, Inject, Injectable, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { RedisService } from '@services/redis.service';

import { Server } from 'socket.io';

@WebSocketGateway()
@Injectable()
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  private readonly statusKeys: IStatus['type'][] = [
    'product',
    'categorypage',
    'googlerow',
  ];
  private readonly logKeys: ILog['service'][] = ['google', 'parser', 'redis'];

  constructor(
    @Inject(forwardRef(() => RedisService))
    private readonly redis: RedisService,
  ) {}

  async sendStatus(status: IStatus) {
    if (!this.server) {
      console.log('Сокет ещё не запущен.');
    }

    await this.server.emit(`status:${status.type}`, status.data);
  }

  async sendLog(log: ILog) {
    if (!this.server) {
      console.log('Сокет ещё не запущен.');
    }

    await this.server.emit(`logs:${log.service}`, log.message);
  }
}
