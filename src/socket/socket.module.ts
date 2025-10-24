import { forwardRef, Module } from '@nestjs/common';
import { SocketService } from './socket.service';
import { RedisModule } from '@/redis/redis.module';

@Module({
    imports: [forwardRef(() => RedisModule)],
    providers: [SocketService],
    exports: [SocketService],
})
export class SocketModule {}
