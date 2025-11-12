import { Browser, Page } from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IExchangeRate } from '@/interfaces/ExchangeRateInterface';
import { ParserConfig } from '@/config/parser.config';
import { GoogleService } from '@/google/google.service';
import { ENV, QUEUE_PARSER_CONCURRENCY } from '@/constants';
import { CaptchaService } from '@/captcha/captcha.service';
import { BrowserService } from '@/browser/browser.service';
import { fixUrl } from '@/utils/fixUrl';
import { ProductDto } from '@/parser/dto/product.dto';
import { ProductService } from './product.service';
import { sleep } from '@/utils/sleep';
import { QueueService } from '@/queue/queue.service';
import { JobContextService } from '@/queue/job-context.service';

@Injectable()
export class ParserService {
    private exchangeRate: number = null;

    constructor(
        private readonly config: ConfigService,
        private readonly google: GoogleService,
        private readonly captcha: CaptchaService,
        private readonly browserService: BrowserService,
        private readonly productService: ProductService,
        private readonly queueService: QueueService,
        private readonly jobContext: JobContextService,
    ) {}

    private async log(message: string) {
        console.log(message);
    }

    async updateJobProgress(extraData?: any) {
        const job = this.jobContext.getJob();

        if (job) {
            await job.updateProgress({
                timestamp: Date.now(),
                uid: job.data.uid,
                ...extraData,
            });
        }
    }

    private formUidName(uid: string, name: string) {
        return `${uid}_${name}`;
    }

    async onModuleInit() {
        this.enterWithQueue();
    }

    private async enterWithQueue() {
        try {
            const activeJobs = await this.queueService.getActiveJobsCount();
            if (activeJobs < QUEUE_PARSER_CONCURRENCY * 2) {
                await this.scheduleNextUid();
            }
        } catch (error) {
            await this.log(`Глобальная ошибка в scheduleNextUid(): ${error}`);
        } finally {
            setTimeout(() => this.enterWithQueue(), 30000);
        }
    }

    private async scheduleNextUid() {
        try {
            const uid = await this.google.getLastUid();

            await this.queueService.addParseJob(uid);
            await this.google.increaseLastUid();
        } catch (error) {
            console.error('Error scheduling job:', error);
        }
    }

    async enter() {
        try {
            await this.parse();
        } catch (error) {
            await this.log(`Глобальная ошибка в parse(): ${error}`);
        } finally {
            setTimeout(() => this.enter(), 2000);
        }
    }

    private async openUrl(page: Page, url: string) {
        await sleep();
        await this.log(`Пытаюсь открыть: ${url}`);

        // await this.browserService.rotateUserAgent(page);
        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: 20000,
        });
        await this.log(`Открыл: ${url}`);
        await this.captcha.checkCaptcha(page);
    }

    private async waitFor(page: Page, selector: string) {
        try {
            await this.log(`Жду селектор: ${selector}.`);
            await page.waitForSelector(selector, { timeout: 20000 });
            await this.log(`Успешно дождался селектора: ${selector}.`);
            return;
        } catch (error) {
            await this.browserService.rotateUserAgent(page, true);
            throw new Error(`Не удалось дождаться селектора ${selector} попытки. Ошибка: ${error}`);
        }
    }

    private async getNextUrl(page: Page) {
        return await page.evaluate(() => {
            const nextButton = document.querySelector('.pagination .pagination__next');
            return nextButton ? 'https://www.ceneo.pl' + nextButton.getAttribute('href') : null;
        });
    }

    async parseWithUid(uid: string) {
        const googleRowData = await this.google.getUidRow(uid);

        if (!googleRowData) {
            await this.google.setLastUid('1');
            throw Error('[GO TO FIRST LINE]');
        }

        const uidName = this.formUidName(googleRowData.uid, googleRowData.name);
        const url = googleRowData.url;

        await this.log(`Перехожу к Google Row: ${url}`);

        if (url !== '---') {
            await this.parseFullCategory(uidName, url);
        } else {
            try {
                await this.productService.removeSheetName(uidName);
                await this.productService.saveProduct({
                    name: '',
                    sheetName: uidName,
                    price: null,
                    externalId: null,
                    flag: false,
                    url: '',
                });
            } catch (error) {
                console.log('[ERROR] Saving empty category: ', error);
            }
        }
    }

    async parse() {
        const googleRowData = await this.google.getLastUidRow();

        const uidName = this.formUidName(googleRowData.uid, googleRowData.name);
        const url = googleRowData.url;

        await this.log(`Перехожу к Google Row: ${url}`);

        if (url !== '---') {
            try {
                await this.parseFullCategory(uidName, url);
            } catch (error) {
                throw error;
            }
        } else {
            try {
                await this.productService.removeSheetName(uidName);
                await this.productService.saveProduct({
                    name: '',
                    sheetName: uidName,
                    price: null,
                    externalId: null,
                    flag: false,
                    url: '',
                });
            } catch (error) {
                console.log('[ERROR] Saving empty category: ', error);
            }
        }
        await this.google.increaseLastUid();
    }

    async parseFullCategory(sheetName: string, url: string) {
        await this.getExchangeRates();

        try {
            while (url) {
                url = await fixUrl(url);
                await this.browserService.runTask(async page => {
                    try {
                        await this.openUrl(page, url);
                        const productsOnPage = await this.parseCategoryPage(page, url);
                        if (!productsOnPage) return;

                        await this.parseProducts(productsOnPage, sheetName);
                        url = await this.getNextUrl(page);
                    } catch (error) {
                        await this.log(`Ошибка при парсинге страницы категории: ${error}`);
                        url = null;
                    }
                });
            }
        } catch (error) {
            console.error(error);
        }
    }

    async parseCategoryPage(page: Page, url: string): Promise<ProductDto[] | null> {
        try {
            await this.openUrl(page, url);
            await this.waitFor(page, ParserConfig.categoryClasses.category);

            return await page.$$eval(
                ParserConfig.categoryClasses.category,
                (rows, categoryClasses) => {
                    return rows
                        .map(row => {
                            const productLink =
                                Array.from(row.querySelectorAll(categoryClasses.url))
                                    .map(a => a.getAttribute('href') || '')
                                    .find(
                                        link => !link.startsWith('.') && !link.includes('Click'),
                                    ) || '';
                            if (productLink === '') return null;
                            return {
                                externalId: Number(productLink.slice(1)),
                                name: '',
                                price: null,
                                flag: false,
                                url: `https://www.ceneo.pl${productLink}`,
                                sheetName: '',
                            };
                        })
                        .filter(item => item !== null);
                },
                ParserConfig.categoryClasses,
            );
        } catch (error) {
            await this.log(`Ошибка при парсинге категории: ${error}`);
            return null;
        }
    }

    async parseProducts(products: ProductDto[], sheetName: string) {
        const results: any[] = [];

        const tasks = products.map(product => async () => {
            try {
                return await this.browserService.runTask(async page => {
                    await this.browserService.rotateUserAgent(page);
                    page.setDefaultNavigationTimeout(60000);

                    const pr = await this.getProduct(page, product.url);

                    if (!pr) return null;

                    product.name = pr.name;
                    product.price = pr.price;
                    product.flag = pr.flag;
                    product.sheetName = sheetName;

                    if (this.exchangeRate !== 0 && pr.price) {
                        const priceInPLN = pr.price;
                        product.price = parseFloat((priceInPLN / this.exchangeRate).toFixed(2));
                    }

                    await this.productService.saveProduct(product);

                    return product;
                });
            } catch (error) {
                await this.log(`Ошибка при парсинге продукта: ${product.url} - ${error}`);
                return null;
            }
        });

        const chunkSize = QUEUE_PARSER_CONCURRENCY;
        for (let i = 0; i < tasks.length; i += chunkSize) {
            const chunk = tasks.slice(i, i + chunkSize);
            const chunkResults = await Promise.allSettled(chunk.map(task => task()));

            for (const result of chunkResults) {
                if (result.status === 'fulfilled' && result.value) {
                    const p = result.value;
                    if (p.name && p.name.trim() !== '') {
                        results.push([p.externalId, p.name, p.price, p.flag, p.url]);
                    }
                }
            }

            await this.log(
                `Обработано ${Math.min(i + chunkSize, tasks.length)}/${tasks.length} продуктов`,
            );
        }

        return results;
    }

    async getProduct(
        page: Page,
        url: string,
    ): Promise<Pick<ProductDto, 'name' | 'price' | 'flag'>> {
        try {
            await this.updateJobProgress({
                stage: 'parsing_product',
                productUrl: url,
                timestamp: Date.now(),
            });

            await this.openUrl(page, url);

            await this.updateJobProgress({
                stage: 'page_loaded',
                status: 'analyzing_offers',
            });

            const count = await page.$$eval(
                ParserConfig.productClasses.offer,
                elements => elements.length,
            );

            if (count === 0) {
                return null;
            }

            await this.updateJobProgress({
                stage: 'offers_found',
                offersCount: count,
            });

            const offers = await page.$$eval(
                ParserConfig.productClasses.offer,
                (elements, productClasses) => {
                    const uniqueOffers = [];

                    for (const el of elements) {
                        const priceEl = el.querySelector(productClasses.price);
                        const priceText =
                            priceEl?.textContent?.replace(/\s/g, '').replace(',', '.') || '';
                        const price = parseFloat(priceText);

                        const availabilityEl = el.querySelector(productClasses.availability);
                        const availability = availabilityEl?.textContent?.trim() || '';

                        const supplierLogo = el.querySelector(
                            productClasses.supplier,
                        ) as HTMLImageElement;
                        const supplierName = supplierLogo ? supplierLogo.alt : null;

                        if (
                            uniqueOffers.some(
                                offer => offer.price === price && offer.supplier === supplierName,
                            )
                        ) {
                            continue;
                        }

                        uniqueOffers.push({ price, availability, supplier: supplierName });
                    }

                    return uniqueOffers
                        .filter(
                            offer =>
                                !isNaN(offer.price) &&
                                (offer.availability.includes('Wysyłka w 1 dzień') ||
                                    offer.availability.includes('Wysyłka do 3 dni')),
                        )
                        .sort((a, b) => a.price - b.price);
                },
                ParserConfig.productClasses,
            );

            await this.updateJobProgress({
                stage: 'offers_processed',
                validOffers: offers.length,
            });

            const name = await page.$eval(
                ParserConfig.productClasses.name,
                el => el.textContent?.trim() || '',
            );

            let price = null;
            if (offers.length >= 2) {
                price = parseFloat(((offers[0].price + offers[1].price) / 2).toFixed(2));
            }

            let flag = true;
            if (price === null) {
                flag = false;
            }

            await this.updateJobProgress({
                stage: 'product_parsed',
                result: { name, price, flag },
            });

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
        }
    }
}
