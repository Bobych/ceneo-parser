import { Module, forwardRef } from '@nestjs/common';

import { ParserService } from './parser.service';
import { CaptchaModule } from '@/captcha/captcha.module';
import { GoogleModule } from '@/google/google.module';
import { StatusModule } from '@/status/status.module';
import { BrowserModule } from '@/browser/browser.module';
import { ProductService } from './product.service';
import { DatabaseService } from '@/database/database.service';
import { QueueModule } from '@/queue/queue.module';

@Module({
    imports: [
        GoogleModule,
        StatusModule,
        BrowserModule,
        CaptchaModule,
        forwardRef(() => QueueModule),
    ],
    providers: [ParserService, ProductService, DatabaseService],
    exports: [ParserService],
})
export class ParserModule {}
