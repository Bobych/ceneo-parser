import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { BrowserConfig } from '@/config/browser.config';
import { getRandomUserAgent } from '@/utils/getRandomUserAgent';

export interface ClusterTaskData {
    url?: string;
    userAgent?: string;
    jobId?: string;
    [key: string]: any;
}

interface PageWithData {
    page: Page;
    data: ClusterTaskData;
}

@Injectable()
export class BrowserService implements OnModuleInit, OnModuleDestroy {
    private cluster: Cluster<ClusterTaskData, PageWithData> | null = null;
    private isInitialized = false;
    private maxConcurrency = 3;

    constructor() {
        puppeteer.use(StealthPlugin());
    }

    async onModuleInit() {
        await this.initializeCluster();
    }

    private async initializeCluster(): Promise<void> {
        if (this.isInitialized) return;

        try {
            console.log('[BrowserService] Initializing puppeteer-cluster...');

            this.cluster = await Cluster.launch({
                puppeteer: puppeteer,
                maxConcurrency: this.maxConcurrency,
                workerCreationDelay: 1000,
                timeout: 60000,
                retryLimit: 2,
                retryDelay: 5000,
                skipDuplicateUrls: false,
                sameDomainDelay: 1000,
                puppeteerOptions: {
                    ...BrowserConfig,
                    headless: 'new',
                },
            });

            this.setupClusterEventHandlers();

            await this.cluster.task(async ({ page, data }): Promise<PageWithData> => {
                await this.setupPage(page, data);
                return { page, data };
            });

            this.isInitialized = true;
            console.log(`[BrowserService] Cluster initialized with ${this.maxConcurrency} workers`);
        } catch (error) {
            console.error('[BrowserService] Failed to initialize cluster:', error);
            throw error;
        }
    }

    private setupClusterEventHandlers(): void {
        if (!this.cluster) return;

        this.cluster.on('taskerror', (err, data) => {
            console.error(`[BrowserService] Task error for job ${data.jobId}:`, err.message);
        });

        this.cluster.on('workercreated', worker => {
            console.log(`[BrowserService] Worker created: ${worker.id}`);
        });

        this.cluster.on('workerdestroyed', worker => {
            console.log(`[BrowserService] Worker destroyed: ${worker.id}`);
        });
    }

    private async setupPage(page: Page, data: ClusterTaskData): Promise<void> {
        const userAgent = data.userAgent || getRandomUserAgent();

        await page.setUserAgent(userAgent);
        await page.setDefaultNavigationTimeout(60000);
        await page.setDefaultTimeout(30000);
        await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            (window as any).chrome = {
                runtime: {},
                loadTimes: () => {},
                csi: () => {},
                app: {},
            };

            const originalQuery = window.navigator.permissions.query;
            (window.navigator as any).permissions.query = (parameters: any) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission } as any)
                    : originalQuery(parameters);

            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            Object.defineProperty(navigator, 'languages', {
                get: () => ['ru-RU', 'ru', 'en-US', 'en'],
            });
        });

        await page.setExtraHTTPHeaders({
            'accept-language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        });
    }

    /**
     * Выполняет задачу в кластере
     */
    async executeTask<T>(
        task: (page: Page, data: ClusterTaskData) => Promise<T>,
        data: ClusterTaskData = {},
    ): Promise<T> {
        if (!this.isInitialized || !this.cluster) {
            await this.initializeCluster();
        }

        const taskData: ClusterTaskData = {
            jobId: data.jobId || `job_${Date.now()}`,
            userAgent: getRandomUserAgent(),
            ...data,
        };

        try {
            const result = await this.cluster!.execute(taskData);
            return await task(result.page, result.data);
        } catch (error) {
            console.error(
                `[BrowserService] Task execution failed for job ${taskData.jobId}:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Создает отдельную страницу для длительных операций
     */
    async createPage(jobId?: string): Promise<{ page: Page; close: () => Promise<void> }> {
        if (!this.isInitialized || !this.cluster) {
            await this.initializeCluster();
        }

        const taskData: ClusterTaskData = {
            jobId: jobId || `page_${Date.now()}`,
            userAgent: getRandomUserAgent(),
        };

        const result = await this.cluster!.execute(taskData);

        return {
            page: result.page,
            close: async () => {
                try {
                    if (!result.page.isClosed()) {
                        await result.page.close();
                    }
                } catch (error) {
                    console.error('Failed to close page:', error);
                }
            },
        };
    }

    /**
     * Закрывает страницу
     */
    async closePage(page: Page): Promise<void> {
        if (!page || page.isClosed()) return;

        try {
            await page.close();
        } catch (error) {
            console.error('Failed to close page:', error);
        }
    }

    /**
     * Получает статистику кластера
     */
    getClusterStats() {
        if (!this.cluster) {
            return {
                isInitialized: false,
                queueSize: 0,
                idle: true,
                workers: 0,
            };
        }

        // Правильное получение размера очереди через кластер
        const clusterAny = this.cluster as any;
        const queueSize = clusterAny.waitingTargets ? clusterAny.waitingTargets.size : 0;

        return {
            isInitialized: this.isInitialized,
            queueSize: queueSize,
            idle: this.cluster.idle,
            workers: this.maxConcurrency,
        };
    }

    /**
     * Освобождает браузер для job
     */
    async releaseBrowserForJob(jobId: string): Promise<void> {
        console.log(
            `[BrowserService] Browser release for job ${jobId} - handled automatically by cluster`,
        );
    }

    /**
     * Перезапускает кластер
     */
    async restartCluster(): Promise<void> {
        console.log('[BrowserService] Restarting cluster...');
        await this.close();
        await this.initializeCluster();
    }

    /**
     * Закрывает кластер
     */
    async close(): Promise<void> {
        if (this.cluster) {
            try {
                console.log('[BrowserService] Closing cluster...');
                await this.cluster.idle();
                await this.cluster.close();
            } catch (error) {
                console.error('[BrowserService] Error closing cluster:', error);
            } finally {
                this.cluster = null;
                this.isInitialized = false;
            }
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.close();
    }
}
