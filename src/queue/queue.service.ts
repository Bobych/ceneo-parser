import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { QUEUE_PARSER_JOB_ID_NAME, QUEUE_PARSER_JOB_NAME, QUEUE_PARSER_NAME } from '@/constants';

@Injectable()
export class QueueService {
    private readonly queue: Queue;

    constructor() {
        this.queue = new Queue(QUEUE_PARSER_NAME, {
            connection: { host: 'localhost', port: 6379 },
            defaultJobOptions: {
                removeOnComplete: 100,
                removeOnFail: 100,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                },
            },
        });
    }

    async addParseJob(uid: string) {
        return this.queue.add(
            QUEUE_PARSER_JOB_NAME,
            { uid },
            {
                jobId: QUEUE_PARSER_JOB_ID_NAME(uid),
            },
        );
    }

    async getActiveJobsCount(): Promise<number> {
        const counts = await this.queue.getJobCounts();
        return counts.active + counts.waiting;
    }

    getQueue(): Queue {
        return this.queue;
    }
}
