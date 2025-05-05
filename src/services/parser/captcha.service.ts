import { Injectable } from '@nestjs/common';
import { Page } from 'puppeteer';
import {
  CapMonsterCloudClientFactory,
  ClientOptions,
  TurnstileProxylessRequest,
} from '@zennolab_com/capmonstercloud-client';
import { ENV } from '@constants';
import { CapMonsterCloudClient } from '@zennolab_com/capmonstercloud-client/dist/CapMonsterCloudClient';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@services/logger.service';

@Injectable()
export class CaptchaService {
  private readonly captchaInstance: CapMonsterCloudClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {
    if (!this.captchaInstance) {
      this.captchaInstance = CapMonsterCloudClientFactory.Create(
        new ClientOptions({
          clientKey: this.config.get<string>(ENV.CAPTCHA_API_TOKEN),
        }),
      );
    }
  }

  private log(message: string) {
    return this.logger.set({ service: 'parser', message });
  }

  async checkCaptcha(page: Page): Promise<void> {
    if (await page.$('.cf-turnstile')) {
      try {
        await this.log('Нашёл капчу, решаю...');
        const captchaResponse = await this.solveCaptcha(page);

        const dynamicId = await page.$eval(
          '.cf-turnstile input[type="hidden"]',
          (el) => el.id,
        );
        await page.evaluate(
          (response, dynamicId) => {
            const input = document.getElementById(
              dynamicId,
            ) as HTMLInputElement;
            input.value = response;
          },
          captchaResponse,
          dynamicId,
        );

        await page.click('button[type="submit"]');
        await this.log('Капча решена.');
      } catch (error) {
        await this.log(`Ошибка при решении капчи: ${error}`);
      }
    }
  }

  private async solveCaptcha(page: Page) {
    const siteKey = await page.$eval('.cf-turnstile', (el) =>
      el.getAttribute('data-sitekey'),
    );

    const task = new TurnstileProxylessRequest({
      websiteKey: siteKey,
      websiteURL: page.url(),
    });

    for (let i = 0; i < 3; i++) {
      const result = await this.captchaInstance.Solve(task);
      if (!result.error) {
        return result.solution.token;
      } else {
        await this.log(`Ошибка при решении капчи: ${result.error}`);
      }

      await this.log(`${i + 1} попытка решения капчи. Ошибка: ${result.error}`);
    }

    throw new Error(`Не удалось решить капчу.`);
  }
}
