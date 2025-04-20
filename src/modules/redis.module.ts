import { forwardRef, Module } from '@nestjs/common';
import { RedisService } from '@services/redis.service';
import { SocketModule } from './socket.module';

@Module({
  imports: [forwardRef(() => SocketModule)],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
