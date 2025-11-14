import { GoogleService } from './google.service';
import { Module } from '@nestjs/common';

@Module({
    providers: [GoogleService],
    exports: [GoogleService],
})
export class GoogleModule {}
