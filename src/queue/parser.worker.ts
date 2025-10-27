import { Injectable } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { QUEUE_PARSER_CONCURRENCY, QUEUE_PARSER_NAME } from '@/constants';
import { ParserService } from '@/parser/parser.service';
import { JobContextService } from '@/queue/job-context.service';

@Injectable()
export class ParserWorker {
    private readonly worker: Worker;

    constructor(
        private readonly parserService: ParserService,
        private readonly jobContextService: JobContextService,
    ) {
        this.worker = new Worker(
            QUEUE_PARSER_NAME,
            async (job: Job) => {
                await this.jobContextService.runWithJob(job, async () => {
                    const { uid } = job.data;

                    try {
                        await this.parserService.parseWithUid(uid);
                        await job.log(`SUCCESSFULLY ENDED: ${uid}`);
                    } catch (error) {
                        await job.log(`FAILED: ${uid}`);
                        throw error;
                    }
                });
            },
            {
                connection: { host: 'localhost', port: 6379 },
                concurrency: QUEUE_PARSER_CONCURRENCY,
            },
        );
    }
}
