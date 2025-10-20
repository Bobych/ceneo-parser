import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { BrowserConfig } from '@/config/browser.config';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';

@Injectable()
export class BrowserService implements OnModuleDestroy {
  private browser: Browser | null = null;
  private userAgent: string | null = null;
  private onUserAgent: number = 0;

  constructor() {
    puppeteer.use(StealthPlugin());
  }

  async launch() {
    if (this.browser) return;
    this.browser = await puppeteer.launch(BrowserConfig);
    this.rotateUserAgent(true);
  }

  async createPage(): Promise<Page> {
    if (!this.browser) await this.launch();

    const page = await this.browser.newPage();

    await page.setUserAgent(this.userAgent);
    this.onUserAgent += 1;
    page.setDefaultNavigationTimeout(60000);
    page.on('console', msg => console.log('BROWSER LOG>', msg.text()));

    return page;
  }

  async closePage(page: Page) {
    try {
      if (page && !page.isClosed()) await page.close();
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

  rotateUserAgent(force?: boolean) {
    if (!force) {
        if (this.onUserAgent >= 10000) {
            this.userAgent = getRandomUserAgent();
	    this.onUserAgent = 0;
        }
        return;
    }
    this.userAgent = getRandomUserAgent();
    this.onUserAgent = 0;
  }

  async onModuleDestroy() {
    await this.close();
  }
}
