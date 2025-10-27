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
                    const progressInterval = setInterval(async () => {
                        await this.parserService.updateJobProgress({
                            status: 'parsing',
                            lastActivity: new Date().toISOString(),
                        });
                    }, 25000);

                    try {
                        await this.parserService.parseWithUid(uid);
                        await job.log(`SUCCESSFULLY ENDED: ${uid}`);
                        await job.moveToCompleted('success', undefined);
                    } catch (error) {
                        await job.log(`FAILED: ${uid}`);
                        await job.moveToFailed(error, undefined);
                    } finally {
                        clearInterval(progressInterval);
                    }
                });
            },
            {
                connection: { host: 'localhost', port: 6379 },
                concurrency: QUEUE_PARSER_CONCURRENCY,
                lockDuration: 60 * 60 * 1000,
                stalledInterval: 5 * 60 * 1000,
            },
        );
    }
}
