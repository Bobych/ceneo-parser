import { ILog } from '@/interfaces/LogInterface';
import { IStatus } from '@/interfaces/StatusInterface';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { RedisService } from '@/redis/redis.service';
import { Server } from 'socket.io';

@WebSocketGateway()
@Injectable()
export class SocketService {
    @WebSocketServer()
    server: Server;

    private readonly statusKeys: IStatus['type'][] = ['product', 'categorypage', 'googlerow'];
    private readonly logKeys: ILog['service'][] = ['google', 'parser', 'redis'];

    constructor(
        @Inject(forwardRef(() => RedisService))
        private readonly redis: RedisService,
    ) {}

    async sendStatus(status: IStatus) {
        if (!this.server) {
            console.log('Сокет ещё не запущен.');
        }

        this.server.emit(`status:${status.type}`, status.data);
    }

    async sendLog(log: ILog) {
        if (!this.server) {
            console.log('Сокет ещё не запущен.');
        }

        this.server.emit(`logs:${log.service}`, log.message);
    }
}
