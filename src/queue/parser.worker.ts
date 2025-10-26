import { Injectable } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QUEUE_PARSER_NAME } from '@/constants';
import { ParserService } from '@/parser/parser.service';

@Injectable()
export class ParserWorker {
    private readonly worker: Worker;

    constructor(private readonly parserService: ParserService) {
        this.worker = new Worker(
            QUEUE_PARSER_NAME,
            async (job: Job) => {
                const { uid } = job.data;
                await this.parserService.parseWithUid(uid);
            },
            {
                connection: { host: 'localhost', port: 6379 },
                concurrency: 3,
            },
        );

        this.worker.on('completed', job => {
            console.log(`✅ Job ${job.id} completed`);
        });

        this.worker.on('failed', (job, err) => {
            console.error(`❌ Job ${job?.id} failed:`, err);
        });

        this.worker.on('error', err => {
            console.error('🔥 Worker error:', err);
        });
    }
}
