import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { Job } from 'bullmq';

@Injectable()
export class JobContextService {
    private readonly als = new AsyncLocalStorage<Job>();

    runWithJob<T>(job: Job, fn: () => Promise<T>): Promise<T> {
        return this.als.run(job, fn);
    }

    getJob(): Job | null {
        return this.als.getStore() || null;
    }
}
