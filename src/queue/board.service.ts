import { QueueService } from '@/queue/queue.service';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { Injectable } from '@nestjs/common';
import { Express } from 'express';

@Injectable()
export class BoardService {
    constructor(private readonly queueService: QueueService) {}

    setupBoard(app: Express) {
        const serverAdapter = new ExpressAdapter();
        serverAdapter.setBasePath('/admin/queues');

        const parserQueue = this.queueService.getQueue();

        createBullBoard({
            queues: [new BullMQAdapter(parserQueue)],
            serverAdapter,
        });

        app.use('/admin/queues', serverAdapter.getRouter());
    }
}
