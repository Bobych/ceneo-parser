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
    busy: boolean;
}

@Injectable()
export class BrowserService implements OnModuleDestroy {
    private browsers: Map<string, BrowserData> = new Map(); // JobId -> BrowserData
    private availableBrowsers: BrowserData[] = [];
    private userAgents: Map<Browser, string> = new Map();
    private maxBrowsers = 3;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    private async createBrowser(): Promise<BrowserData> {
        const userDataDir = path.join(os.tmpdir(), 'puppeteer_profile_' + randomUUID());
        await fs.ensureDir(userDataDir);

        const browser = await puppeteer.launch({ ...BrowserConfig, userDataDir });

        const bd: BrowserData = { browser, userDataDir, busy: false };
        this.userAgents.set(browser, getRandomUserAgent());

        return bd;
    }

    private async waitForAvailableBrowser(): Promise<BrowserData> {
        const timeout = 30000;
        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const freeBrowser = this.availableBrowsers.find(b => !b.busy);
            if (freeBrowser) {
                freeBrowser.busy = true;
                return freeBrowser;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        throw new Error('No available browsers in pool');
    }

    async getBrowserForJob(jobId: string): Promise<Browser> {
        if (this.browsers.has(jobId)) {
            const bd = this.browsers.get(jobId)!;
            if (bd.browser.connected) {
                bd.busy = true;
                return bd.browser;
            } else {
                await this.replaceBrowser(bd);
            }
        }

        let bd = this.availableBrowsers.find(b => !b.busy);
        if (bd) {
            bd.busy = true;
        } else if (this.browsers.size + this.availableBrowsers.length < this.maxBrowsers) {
            bd = await this.createBrowser();
        } else {
            bd = await this.waitForAvailableBrowser();
        }

        this.browsers.set(jobId, bd);
        return bd.browser;
    }

    async releaseBrowserForJob(jobId: string): Promise<void> {
        const bd = this.browsers.get(jobId);
        if (bd) {
            bd.busy = false;
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
        } catch (err) {
            console.error(`[BrowserService] Browser crashed for job ${jobId}, replacing...`);
            const bd = this.browsers.get(jobId)!;
            await this.replaceBrowser(bd);
            throw err;
        }
    }

    async closePage(page: Page) {
        if (!page || page.isClosed()) return;
        try {
            await page.close();
        } catch (e) {
            console.error('Failed to close page:', e);
        }
    }

    private async replaceBrowser(bd: BrowserData): Promise<void> {
        try {
            await bd.browser.close();
        } catch (e) {
            console.error('Failed to close old browser:', e);
        }

        // Удаляем tmpDir через маленькую задержку, чтобы Chrome успел закрыть сокеты
        setTimeout(() => fs.remove(bd.userDataDir).catch(() => {}), 500);

        this.userAgents.delete(bd.browser);
        this.availableBrowsers = this.availableBrowsers.filter(b => b.browser !== bd.browser);

        for (const [jobId, entry] of this.browsers) {
            if (entry.browser === bd.browser) this.browsers.delete(jobId);
        }

        const newBd = await this.createBrowser();
        this.availableBrowsers.push(newBd);
    }

    rotateUserAgent(force?: boolean) {
        for (const bd of [...this.availableBrowsers, ...this.browsers.values()]) {
            if (force) this.userAgents.set(bd.browser, getRandomUserAgent());
        }
    }

    async close() {
        const all = [...this.availableBrowsers, ...this.browsers.values()];
        await Promise.all(
            all.map(async bd => {
                try {
                    await bd.browser.close();
                } catch (e) {
                    console.error('Failed to close browser:', e);
                }
                await fs.remove(bd.userDataDir).catch(() => {});
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
