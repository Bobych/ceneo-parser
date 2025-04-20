import { Module } from '@nestjs/common';

import { ParserService } from '@services/parser.service';
import { GoogleModule } from './google.module';
import { LoggerModule } from './logger.module';
import { StatusModule } from './status.module';

@Module({
  imports: [GoogleModule, LoggerModule, StatusModule],
  providers: [ParserService],
  exports: [ParserService],
})
export class ParserModule {}
