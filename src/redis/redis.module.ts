import { forwardRef, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { SocketModule } from '@/socket/socket.module';

@Module({
    imports: [forwardRef(() => SocketModule)],
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule {}
