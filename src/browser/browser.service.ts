import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { BrowserConfig } from '@/config/browser.config';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import fs from 'fs-extra';
import path from 'path';

interface BrowserData {
    browser: Browser;
    userDataDir: string;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
    private browsers: Map<string, BrowserData> = new Map();
    private userAgents: Map<Browser, string> = new Map();
    private availableBrowsers: BrowserData[] = [];
    private maxBrowsers = 3;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    async getBrowserForJob(jobId: string): Promise<Browser> {
        if (this.browsers.has(jobId)) {
            const { browser, userDataDir } = this.browsers.get(jobId)!;
            if (browser.connected) return browser;
            else await this.replaceBrowser(browser, userDataDir);
        }

        let b = this.availableBrowsers.shift();

        if (!b) {
            if (this.browsers.size < this.maxBrowsers) {
                b = await this.createBrowser();
            } else {
                b = await this.waitForAvailableBrowser();
            }
        }

        this.browsers.set(jobId, b);
        return b.browser;
    }

    async releaseBrowserForJob(jobId: string): Promise<void> {
        const browser = this.browsers.get(jobId);
        if (browser) {
            this.browsers.delete(jobId);
            this.availableBrowsers.push(browser);
        }
    }

    async createPage(jobId: string): Promise<Page> {
        const browser = await this.getBrowserForJob(jobId);
        try {
            const page = await browser.newPage();
            const userAgent = this.userAgents.get(browser) || getRandomUserAgent();
            await page.setUserAgent(userAgent);
            page.setDefaultNavigationTimeout(60000);
            return page;
        } catch (error) {
            console.error(`[BrowserService] Browser crashed for job ${jobId}, replacing...`);
            const { userDataDir } = this.browsers.get(jobId)!;
            await this.replaceBrowser(browser, userDataDir);
            throw error;
        }
    }

    async closePage(page: Page, jobId: string) {
        try {
            if (page && !page.isClosed()) {
                await page.close();
            }
        } catch (e) {
            console.error('Failed to close page:', e);
        }
    }

    private async createBrowser(): Promise<BrowserData> {
        const userDataDir = path.join(os.tmpdir(), 'puppeteer_profile_' + randomUUID());
        await fs.ensureDir(userDataDir);

        const browser = await puppeteer.launch({ ...BrowserConfig, userDataDir: userDataDir });

        this.userAgents.set(browser, getRandomUserAgent());
        return { browser, userDataDir };
    }

    private async waitForAvailableBrowser(): Promise<BrowserData> {
        const timeout = 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (this.availableBrowsers.length > 0) {
                return this.availableBrowsers.shift()!;
            }
        }

        throw new Error('No available browsers in pool');
    }

    private async replaceBrowser(oldBrowser: Browser, userDataDir: string): Promise<void> {
        try {
            await oldBrowser.close();
        } catch (e) {
            console.error('Failed to close old browser:', e);
        }

        await fs.remove(userDataDir).catch(() => {});
        this.userAgents.delete(oldBrowser);
        this.availableBrowsers = this.availableBrowsers.filter(b => b.browser !== oldBrowser);
        for (const [jobId, entry] of this.browsers) {
            if (entry.browser === oldBrowser) this.browsers.delete(jobId);
        }

        const newBrowser = await this.createBrowser();
        this.availableBrowsers.push(newBrowser);
    }

    rotateUserAgent(force?: boolean) {
        for (const { browser } of [...this.browsers.values(), ...this.availableBrowsers]) {
            if (force) this.userAgents.set(browser, getRandomUserAgent());
        }
    }

    async close() {
        const all = [...this.browsers.values(), ...this.availableBrowsers];
        await Promise.all(
            all.map(async ({ browser, userDataDir }) => {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Failed to close browser:', e);
                }
                await fs.remove(userDataDir).catch(() => {});
            }),
        );

        this.browsers.clear();
        this.availableBrowsers = [];
        this.userAgents.clear();
    }

    async onModuleDestroy() {
        await this.close();
    }
}
