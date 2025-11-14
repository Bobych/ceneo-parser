import { Injectable } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QUEUE_PARSER_CONCURRENCY, QUEUE_PARSER_NAME } from '@/constants';
import { ParserService } from '@/parser/parser.service';

@Injectable()
export class ParserWorker {
    private readonly worker: Worker;

    constructor(private readonly parserService: ParserService) {
        this.worker = new Worker(QUEUE_PARSER_NAME, this.processJob.bind(this), {
            connection: { host: 'localhost', port: 6379 },
            concurrency: QUEUE_PARSER_CONCURRENCY,
        });
    }

    private async processJob(job: Job): Promise<void> {
        const { uid } = job.data;

        try {
            await job.log(`STARTED: ${uid}`);
            await this.parserService.parseWithUid(uid);
            await job.log(`SUCCESSFULLY ENDED: ${uid}`);
        } catch (error) {
            await job.log(`FAILED: ${uid}`);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.worker.close();
    }
}
