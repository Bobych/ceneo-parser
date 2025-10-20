import { Module } from '@nestjs/common';

import { ParserService } from './parser.service';
import { CaptchaModule } from '@/captcha/captcha.module';
import { GoogleModule } from '@/google/google.module';
import { LoggerModule } from '@/logger/logger.module';
import { StatusModule } from '@/status/status.module';
import { BrowserModule } from '@/browser/browser.module';
import { ProductService } from './product.service';
import { DatabaseService } from '@/database/database.service';

@Module({
  imports: [
    GoogleModule,
    LoggerModule,
    StatusModule,
    BrowserModule,
    CaptchaModule,
  ],
  providers: [ParserService, ProductService, DatabaseService],
  exports: [ParserService],
})
export class ParserModule {}
