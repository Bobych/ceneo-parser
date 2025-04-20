import * as ps from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CapMonsterCloudClientFactory,
  ClientOptions,
  TurnstileProxylessRequest,
} from '@zennolab_com/capmonstercloud-client';
import { IExchangeRate } from '@interfaces';
import { ParserConfig } from '@config/parser.config';
import { BrowserConfig } from '@config/browser.config';
import { GoogleService } from './google.service';
import { LoggerService } from './logger.service';
import { StatusService } from './status.service';
import { ENV } from '@constants';

interface Product {
  id: string;
  name: string;
  price: string;
  flag: string;
  url: string;
}

@Injectable()
export class ParserService {
  private exchangeRate: number = null;
  private browser: Browser = null;
  private userAgent: string = ParserConfig.userAgent();
  private urlsOnUserAgents: number = 150;
  private onUserAgent: number = 0;
  private ms: number = 75;

  private abortController: AbortController | null = null;
  private isRestarting = false;

  constructor(
    private readonly config: ConfigService,
    private readonly google: GoogleService,
    private readonly logger: LoggerService,
    private readonly status: StatusService,
  ) {}

  private log(message: string) {
    return this.logger.set({ service: 'parser', message });
  }

  async onModuleInit() {
    await this.enter();
  }

  async enter() {
    if (this.isRestarting) {
      await this.log('Restarting is completed.');
      this.isRestarting = false;
    }

    setTimeout(async () => {
      try {
        await this.parse();
      } catch (error) {
        console.error(error);
      } finally {
        await this.enter();
      }
    }, 1000);
  }

  async restart() {
    if (this.abortController) {
      this.abortController.abort();
      this.isRestarting = true;
    }
  }

  private async launchBrowser() {
    await this.log('Запускаю браузер...');
    await this.closeBrowser();
    try {
      this.browser = await ps.default.launch({
        ...BrowserConfig,
        args: [...BrowserConfig.args, ParserConfig.proxyUrl()],
      });
    } catch (error) {
      await this.log(`Ошибка при запуске  браузера: ${error}`);
      setTimeout(() => this.launchBrowser(), 1000);
    }
  }

  private async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      await this.log('Закрываю браузер...');
    }
  }

  private async createPage(): Promise<Page> {
    if (!this.browser) {
      await this.launchBrowser();
    }
    if (this.onUserAgent >= this.urlsOnUserAgents) {
      this.onUserAgent = 0;
      this.userAgent = ParserConfig.userAgent();
    }
    const page = await this.browser.newPage();

    const { username, password } = ParserConfig.proxyAuth();

    await page.authenticate({
      username: username,
      password: password,
    });

    await page.setUserAgent(this.userAgent);
    this.onUserAgent += 1;
    return page;
  }

  private async closePage(page: Page) {
    if (!page.isClosed()) await page.close();
  }

  private async solveCaptcha(page: Page) {
    const capMonster = CapMonsterCloudClientFactory.Create(
      new ClientOptions({
        clientKey: this.config.get<string>(ENV.CAPTCHA_API_TOKEN),
      }),
    );

    const siteKey = await page.$eval('.cf-turnstile', (el) =>
      el.getAttribute('data-sitekey'),
    );

    const task = new TurnstileProxylessRequest({
      websiteKey: siteKey,
      websiteURL: page.url(),
    });

    for (let i = 0; i < 3; i++) {
      const result = await capMonster.Solve(task);
      if (!result.error) {
        return result.solution.token;
      } else {
        await this.log(`Ошибка при решении капчи: ${result.error}`);
      }

      await this.log(`${i + 1} попытка решения капчи. Ошибка: ${result.error}`);
      await this.sleep();
    }

    throw new Error(`Не удалось решить капчу.`);
  }

  private async sleep(ms?: number) {
    const period = ms ? ms : this.ms;
    return new Promise((resolve) =>
      setTimeout(resolve, Math.floor(Math.random() * period) + period),
    );
  }

  private async openUrl(page: Page, url: string) {
    await this.sleep();

    await this.log(`Пытаюсь открыть: ${url}`);

    await Promise.all([
      page.goto(url),
      page.waitForNavigation({
        waitUntil: ['domcontentloaded'],
        timeout: 10000,
      }),
    ]);

    await this.log(`Открыл: ${url}`);

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
        await this.sleep(500);
      } catch (error) {
        return null;
      }
    }
  }

  private async waitFor(page: Page, selector: string, retries: number = 3) {
    let attempt = 0;

    while (attempt < retries) {
      try {
        await this.log(`Жду селектор: ${selector}.`);
        await page.waitForSelector(selector, { timeout: 10000 });
        await this.log(`Успешно дождался селектора: ${selector}.`);
        return;
      } catch (error) {
        attempt++;
        await this.log(
          `Попытка ${attempt} ожидания селектора: ${selector}. Ошибка: ${error}`,
        );
        await page.reload();
        if (attempt === retries) {
          throw new Error(
            `Не удалось дождаться селектора ${selector} за ${retries} попытки.`,
          );
        }
      }
    }
  }

  private async fixUrl(url: string) {
    const hasHtm = url.endsWith('.htm');
    const hasParam = url.includes('0112-0');

    if (!hasHtm) {
      url += '.htm';
    }

    if (!hasParam) {
      url = url.replace('.htm', ';0112-0.htm');
    }

    return url;
  }

  async parse() {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const data = await this.google.getLastUidRow();
      const uid = `${data.uid}_${data.name}`;
      const url = data.url;

      await this.launchBrowser();

      await this.log(`Перехожу к Google Row: ${url}`);

      await this.status.set({
        type: 'googlerow',
        data: uid,
      });

      await this.parseRow(uid, url, signal);

      if (!signal.aborted) {
        await this.google.increaseLastUid();
      }

      await this.closeBrowser();
    } catch (error) {
      if (error.message === 'Parse aborted') {
        console.log('Parsing was aborted');
      } else {
        console.error('Error during parsing:', error);
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  async parseRow(sheetName: string, url: string, signal: AbortSignal) {
    if (url === '---') {
      await this.google.insertData(sheetName, [[]]);
      return;
    }

    while (url && !signal.aborted) {
      url = await this.fixUrl(url);
      const page = await this.createPage();
      const productsOnPage = await this.parseCategoryPage(page, url);

      if (!productsOnPage) {
        this.userAgent = ParserConfig.userAgent();
        await this.closePage(page);
        continue;
      }

      const dataToWrite = await this.parseProducts(productsOnPage);
      await this.google.insertData(sheetName, dataToWrite);

      url = await page.evaluate(() => {
        const nextButton = document.querySelector(
          '.pagination .pagination__next',
        );
        return nextButton ? nextButton.getAttribute('href') : null;
      });

      if (url) {
        url = 'https://www.ceneo.pl' + url;
      }
      await this.closePage(page);
    }
  }

  async parseCategoryPage(page: Page, url: string): Promise<Product[]> {
    try {
      await this.openUrl(page, url);

      await this.status.set({
        type: 'categorypage',
        data: url,
      });

      await this.waitFor(page, ParserConfig.categoryClasses.category);

      await this.getExchangeRates();

      return await page.$$eval(
        ParserConfig.categoryClasses.category,
        (rows, categoryClasses) => {
          return rows
            .map((row) => {
              const productLink =
                Array.from(row.querySelectorAll(categoryClasses.url))
                  .map((a) => a.getAttribute('href') || '')
                  .find(
                    (link) => !link.startsWith('.') && !link.includes('Click'),
                  ) || '';
              if (productLink === '') return null;
              return {
                id: productLink.slice(1),
                name: '',
                price: '',
                flag: '',
                url: `https://www.ceneo.pl${productLink}`,
              };
            })
            .filter((item) => item !== null);
        },
        ParserConfig.categoryClasses,
      );
    } catch (error) {
      await this.log(`Ошибка: ${error}`);
      return null;
    }
  }

  async parseProducts(products: Product[]) {
    let i = 0;
    const l = products.length;
    let attempts = 0;
    while (i < l) {
      attempts++;
      const product = products[i];

      const page = await this.createPage();
      const pr = await this.getProduct(page, product.url);
      await this.closePage(page);

      if (!pr) {
        this.userAgent = ParserConfig.userAgent();
        if (attempts >= 3) {
          i++;
          attempts = 0;
        }
        continue;
      }

      product.name = pr.name;
      product.price = pr.price;
      product.flag = pr.flag;

      if (this.exchangeRate !== 0 && pr.price) {
        const priceInPLN = parseFloat(pr.price);
        product.price = (priceInPLN / this.exchangeRate).toFixed(2);
      }
      attempts = 0;
      i++;
    }

    return products
      .filter((p) => p.name.trim() !== '')
      .map((p) => [p.id, p.name, p.price, p.flag, p.url]);
  }

  async getProduct(
    page: Page,
    url: string,
  ): Promise<Omit<Product, 'id' | 'url'>> {
    try {
      await this.openUrl(page, url);

      await this.status.set({
        type: 'product',
        data: url,
      });

      await this.waitFor(page, ParserConfig.productClasses.offer);

      const offers = await page.$$eval(
        ParserConfig.productClasses.offer,
        (elements, productClasses) => {
          const uniqueOffers = [];

          for (const el of elements) {
            const priceEl = el.querySelector(productClasses.price);
            const priceText =
              priceEl?.textContent?.replace(/\s/g, '').replace(',', '.') || '';
            const price = parseFloat(priceText);

            const availabilityEl = el.querySelector(
              productClasses.availability,
            );
            const availability = availabilityEl?.textContent?.trim() || '';

            const supplierLogo = el.querySelector(
              productClasses.supplier,
            ) as HTMLImageElement;
            const supplierName = supplierLogo ? supplierLogo.alt : null;

            if (
              uniqueOffers.some(
                (offer) =>
                  offer.price === price && offer.supplier === supplierName,
              )
            ) {
              continue;
            }

            uniqueOffers.push({ price, availability, supplier: supplierName });
          }

          return uniqueOffers
            .filter(
              (offer) =>
                !isNaN(offer.price) &&
                (offer.availability.includes('Wysyłka w 1 dzień') ||
                  offer.availability.includes('Wysyłka do 3 dni')),
            )
            .sort((a, b) => a.price - b.price);
        },
        ParserConfig.productClasses,
      );

      const name = await page.$eval(
        ParserConfig.productClasses.name,
        (el) => el.textContent?.trim() || '',
      );

      let price = '';
      if (offers.length >= 2) {
        price = ((offers[0].price + offers[1].price) / 2).toFixed(2);
      }

      let flag = '1';
      if (price === '') {
        flag = '';
      }

      return {
        name: name,
        price: price,
        flag: flag,
      };
    } catch (error) {
      await this.log(`Ошибка: ${error}`);
      return null;
    }
  }

  async getExchangeRates() {
    try {
      const url = this.config.get<string>(ENV.EXCHANGE_RATE_URL);
      const response = await fetch(url);
      const data: IExchangeRate = await response.json();
      const rate = data.rates[0].bid;

      await this.log(`Полученный обменный курс (bid): ${rate}`);
      this.exchangeRate = rate || null;
    } catch (error) {
      await this.log(`Ошибка: ${error}`);
      return null;
    }
  }
}
