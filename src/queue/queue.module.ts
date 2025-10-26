import { forwardRef, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { ParserWorker } from '@/queue/parser.worker';
import { ParserModule } from '@/parser/parser.module';
import { BoardService } from '@/queue/board.service';

@Module({
    imports: [forwardRef(() => ParserModule)],
    providers: [QueueService, ParserWorker, BoardService],
    exports: [QueueService],
})
export class QueueModule {}
