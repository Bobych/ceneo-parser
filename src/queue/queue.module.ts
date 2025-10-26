import { forwardRef, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ParserWorker } from '@/queue/parser.worker';
import { ParserModule } from '@/parser/parser.module';
import { BoardService } from '@/queue/board.service';
import { JobContextService } from '@/queue/job-context.service';

@Module({
    imports: [forwardRef(() => ParserModule)],
    providers: [QueueService, ParserWorker, BoardService, JobContextService],
    exports: [QueueService, JobContextService],
})
export class QueueModule {}
