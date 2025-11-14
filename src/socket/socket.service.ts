import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { RedisService } from '@/redis/redis.service';
import { ILog } from '@/interfaces/LogInterface';
import { Server, Socket } from 'socket.io';

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

    async handleConnection(client: Socket) {
        console.log(`Client connected: ${client.id}`);
        await this.sendInitialLogs(client);
    }

    private async sendInitialLogs(client: Socket) {
        try {
            const categoryLogs = await this.redis.getLogs('logs:category_result', 800);

            if (categoryLogs && categoryLogs.length > 0) {
                const reversedLogs = [...categoryLogs].reverse();
                client.emit('initialLogs:category_result', reversedLogs);
            }
        } catch (error) {
            console.log(`[SOCKET] Error sending initial logs: ${error}`);
        }
    }

    async sendLog(log: ILog) {
        if (!this.server) {
            console.log('Сокет ещё не запущен.');
            return;
        }

        this.server.emit(`logs:${log.service}`, log.message);
    }
}
