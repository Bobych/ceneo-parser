import { Injectable, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { BrowserConfig } from '@/config/browser.config';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';
import { mkdtempSync } from 'node:fs';
import path from 'path';
import { tmpdir } from 'node:os';
import fs from 'fs/promises';

@Injectable()
export class BrowserService implements OnModuleDestroy {
    private browsers: Map<string, Browser> = new Map();
    private userAgents: Map<Browser, string> = new Map();
    private availableBrowsers: Browser[] = [];
    private maxBrowsers = 3;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    async getBrowserForJob(jobId: string): Promise<Browser> {
        if (this.browsers.has(jobId)) {
            const browser = this.browsers.get(jobId)!;
            if (browser && browser.connected && browser.process()?.exitCode !== null)
                return browser;
            else await this.replaceBrowser(browser);
        }

        let browser = this.availableBrowsers.shift();

        if (!browser) {
            if (this.browsers.size < this.maxBrowsers) {
                browser = await this.createBrowser();
            } else {
                browser = await this.waitForAvailableBrowser();
            }
        }

        this.browsers.set(jobId, browser);
        return browser;
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
            await this.replaceBrowser(browser);
            throw error;
        }
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

    private async createBrowser(): Promise<Browser> {
        const tmpProfileDir = mkdtempSync(path.join(tmpdir(), 'puppeteer_profile_'));
        const browser = await puppeteer.launch({
            ...BrowserConfig,
            userDataDir: tmpProfileDir,
        });
        this.userAgents.set(browser, getRandomUserAgent());
        return browser;
    }

    private async waitForAvailableBrowser(): Promise<Browser> {
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

    private async replaceBrowser(oldBrowser: Browser): Promise<void> {
        const tmpDir = (oldBrowser.process()?.spawnargs || []).find(arg =>
            arg.includes('puppeteer_profile_'),
        );
        try {
            await oldBrowser.close();
            if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
        } catch (e) {
            console.error('Failed to close old browser:', e);
        }

        this.userAgents.delete(oldBrowser);
        const availableIndex = this.availableBrowsers.indexOf(oldBrowser);
        if (availableIndex !== -1) {
            this.availableBrowsers.splice(availableIndex, 1);
        }

        for (const [jobId, browser] of this.browsers) {
            if (browser === oldBrowser) {
                this.browsers.delete(jobId);
            }
        }

        const newBrowser = await this.createBrowser();
        this.availableBrowsers.push(newBrowser);
    }

    rotateUserAgent(force?: boolean) {
        for (const browser of [...this.browsers.values(), ...this.availableBrowsers]) {
            if (force) {
                this.userAgents.set(browser, getRandomUserAgent());
            }
        }
    }

    async close() {
        const allBrowsers = [...this.browsers.values(), ...this.availableBrowsers];
        await Promise.all(
            allBrowsers.map(async browser => {
                try {
                    await browser.close();
                } catch (e) {
                    console.error('Failed to close browser:', e);
                }
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
