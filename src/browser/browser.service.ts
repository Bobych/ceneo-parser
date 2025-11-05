import { Injectable } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import generic_pool from 'generic-pool';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';
import { BrowserConfig } from '@/config/browser.config';

@Injectable()
export class BrowserService {
    private pool: generic_pool.Pool<Browser>;
    private browser: Browser | undefined;

    constructor() {
        puppeteer.use(StealthPlugin());

        this.pool = generic_pool.createPool(
            {
                create: async () => await puppeteer.launch(BrowserConfig),
                destroy: async browser => browser.close(),
            },
            {
                max: 5,
                min: 1,
                idleTimeoutMillis: 30000,
            },
        );
    }

    async acquireBrowser(): Promise<Browser> {
        return await this.pool.acquire();
    }

    async releaseBrowser(browser: Browser) {
        await this.pool.release(browser);
    }

    async createPage(browser: Browser): Promise<Page> {
        const page = await browser.newPage();
        const ua = getRandomUserAgent();
        await page.setUserAgent(ua);
        page.setDefaultNavigationTimeout(60000);
        return page;
    }

    async closePage(page: Page) {
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (e) {
            console.error('[BrowserService] Failed to close page:', e);
        }
    }

    async rotateUserAgent(page?: Page, force = false): Promise<string> {
        const ua = getRandomUserAgent();
        if (page) {
            const currentUA = await page.evaluate(() => navigator.userAgent).catch(() => null);
            if (force || currentUA !== ua) {
                await page.setUserAgent(ua);
            }
        }
        return ua;
    }

    async onModuleDestroy() {
        await this.pool.drain();
        await this.pool.clear();
    }
}
