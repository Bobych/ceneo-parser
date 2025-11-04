import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page, BrowserContext } from 'puppeteer';
import { BrowserConfig } from '@/config/browser.config';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';

@Injectable()
export class BrowserService implements OnModuleDestroy {
    private browser: Browser | null = null;
    private contexts: Map<string, BrowserContext> = new Map();
    private userAgents: Map<BrowserContext, string> = new Map();
    private maxContexts = 3;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    private async ensureBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.connected) {
            await this.createBrowser();
        }
        return this.browser!;
    }

    async getContextForJob(jobId: string): Promise<BrowserContext> {
        if (this.contexts.has(jobId)) {
            const context = this.contexts.get(jobId)!;
            try {
                await context.pages();
                return context;
            } catch (e) {
                this.contexts.delete(jobId);
                this.userAgents.delete(context);
            }
        }

        if (this.contexts.size >= this.maxContexts) {
            await this.cleanupOldContexts();
        }

        const browser = await this.ensureBrowser();
        const context = await browser.createBrowserContext();
        const userAgent = getRandomUserAgent();

        this.contexts.set(jobId, context);
        this.userAgents.set(context, userAgent);

        return context;
    }

    async releaseContextForJob(jobId: string): Promise<void> {
        const context = this.contexts.get(jobId);
        if (context) {
            this.contexts.delete(jobId);
            this.userAgents.delete(context);
            try {
                await context.close();
            } catch (e) {
                console.error('Failed to close context:', e);
            }
        }
    }

    async createPage(jobId: string): Promise<Page> {
        const context = await this.getContextForJob(jobId);
        const page = await context.newPage();
        const userAgent = this.userAgents.get(context) || getRandomUserAgent();

        await page.setUserAgent(userAgent);
        page.setDefaultNavigationTimeout(60000);

        return page;
    }

    async closePage(page: Page) {
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (e) {
            console.error('Failed to close page:', e);
        }
    }

    private async createBrowser(): Promise<void> {
        this.browser = await puppeteer.launch(BrowserConfig);

        this.browser.on('disconnected', () => {
            this.browser = null;
            this.contexts.clear();
            this.userAgents.clear();
        });
    }

    private async cleanupOldContexts(): Promise<void> {
        const firstJobId = this.contexts.keys().next().value;
        if (firstJobId) {
            await this.releaseContextForJob(firstJobId);
        }
    }

    rotateUserAgent(force?: boolean) {
        for (const context of this.contexts.values()) {
            if (force) {
                this.userAgents.set(context, getRandomUserAgent());
            }
        }
    }

    async close() {
        const closePromises = Array.from(this.contexts.keys()).map(jobId =>
            this.releaseContextForJob(jobId),
        );

        await Promise.all(closePromises);

        if (this.browser) {
            try {
                await this.browser.close();
            } catch (e) {
                console.error('Failed to close browser:', e);
            }
            this.browser = null;
        }

        this.contexts.clear();
        this.userAgents.clear();
    }

    async onModuleDestroy() {
        await this.close();
    }

    getStats() {
        return {
            browserConnected: !!this.browser?.connected,
            activeContexts: this.contexts.size,
            maxContexts: this.maxContexts,
        };
    }
}
