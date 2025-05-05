import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import randomUseragent from 'random-useragent';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private userAgent: string = randomUseragent.getRandom();

  constructor() {
    puppeteer.use(StealthPlugin());
  }

  async launch() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }

  async createPage(): Promise<Page> {
    if (!this.browser) throw new Error('Browser not launched');

    const page = await this.browser.newPage();

    await page.setUserAgent(this.userAgent);
    await page.setDefaultNavigationTimeout(60000);

    return page;
  }

  async closePage(page: Page) {
    try {
      await page.close();
    } catch (e) {
      console.error('Failed to close page:', e);
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (e) {
      console.error('Failed to close browser:', e);
    }
  }

  rotateUserAgent() {
    this.userAgent = randomUseragent.getRandom();
  }

  async onModuleDestroy() {
    await this.close();
  }
}
