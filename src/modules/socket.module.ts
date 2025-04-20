import { forwardRef, Module } from '@nestjs/common';
import { SocketGateway } from '../gateway/socket.gateway';
import { RedisModule } from './redis.module';

@Module({
  imports: [forwardRef(() => RedisModule)],
  providers: [SocketGateway],
  exports: [SocketGateway],
})
export class SocketModule {}
