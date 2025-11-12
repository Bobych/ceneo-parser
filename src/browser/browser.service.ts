import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import puppeteer_core from 'puppeteer-core';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';
import { BrowserConfig } from '@/config/browser.config';
import { Cluster } from 'puppeteer-cluster';
import { QUEUE_PARSER_CONCURRENCY } from '@/constants';

puppeteer.use(StealthPlugin());

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
    private cluster: Cluster<any, any>;

    async onModuleInit() {
        this.cluster = await Cluster.launch({
            puppeteer: puppeteer_core,
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: QUEUE_PARSER_CONCURRENCY,
            puppeteerOptions: BrowserConfig,
            timeout: 180000,
            monitor: false,
            retryLimit: 3,
            retryDelay: 5000,
            skipDuplicateUrls: true,
        });
    }

    async onModuleDestroy() {
        if (this.cluster) {
            await this.cluster.idle();
            await this.cluster.close();
        }
    }

    async createPage(): Promise<Page> {
        const { page } = await this.cluster.execute(async ({ page }) => page);
        return page;
    }

    async runTask<T>(handler: (page: Page) => Promise<T>): Promise<T> {
        return this.cluster.execute(async ({ page }) => {
            const ua = getRandomUserAgent();
            await page.setUserAgent(ua);
            page.setDefaultNavigationTimeout(60000);
            return handler(page);
        });
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

    async rotateUserAgent(page: Page, force = false): Promise<string> {
        const ua = getRandomUserAgent();
        if (page) {
            const currentUA = await page.evaluate(() => navigator.userAgent).catch(() => null);
            if (force || currentUA !== ua) {
                await page.setUserAgent(ua);
            }
        }
        return ua;
    }
}
