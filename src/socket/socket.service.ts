import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { ILog } from '@/interfaces/LogInterface';
import { Server } from 'socket.io';

@WebSocketGateway()
@Injectable()
export class SocketService {
    @WebSocketServer()
    server: Server;

    private readonly logKeys: ILog['service'][] = ['parser', 'category_result'];

    constructor(
        @Inject(forwardRef(() => RedisService))
        private readonly redis: RedisService,
    ) {}

    async sendLog(log: ILog) {
        if (!this.server) {
            console.log('Сокет ещё не запущен.');
        }

        this.server.emit(`logs:${log.service}`, log.message);
    }
}
