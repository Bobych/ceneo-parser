import { Module } from '@nestjs/common';

import {
  ParserService,
  BrowserService,
  CaptchaService,
} from '@services/parser';
import { GoogleModule } from './google.module';
import { LoggerModule } from './logger.module';
import { StatusModule } from './status.module';

@Module({
  imports: [GoogleModule, LoggerModule, StatusModule],
  providers: [ParserService, BrowserService, CaptchaService],
  exports: [ParserService],
})
export class ParserModule {}
