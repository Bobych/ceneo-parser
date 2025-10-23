import { Module } from '@nestjs/common';
import { CaptchaService } from './captcha.service';
import { LoggerModule } from '@/logger/logger.module';

@Module({
  imports: [LoggerModule],
  providers: [CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
