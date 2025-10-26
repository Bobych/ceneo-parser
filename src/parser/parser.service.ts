import { Page } from 'puppeteer';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IExchangeRate } from '@/interfaces/ExchangeRateInterface';
import { ParserConfig } from '@/config/parser.config';
import { GoogleService } from '@/google/google.service';
import { LoggerService } from '@/logger/logger.service';
import { StatusService } from '@/status/status.service';
import { ENV } from '@/constants';
import { CaptchaService } from '@/captcha/captcha.service';
import { BrowserService } from '@/browser/browser.service';
import { fixUrl } from '@/utils/fixUrl';
import { ProductDto } from '@/parser/dto/product.dto';
import { ProductService } from './product.service';
import { sleep } from '@/utils/sleep';
import { QueueService } from '@/queue/queue.service';

@Injectable()
export class ParserService {
    private exchangeRate: number = null;

    constructor(
        private readonly config: ConfigService,
        private readonly google: GoogleService,
        private readonly logger: LoggerService,
        private readonly status: StatusService,
        private readonly captcha: CaptchaService,
        private readonly browser: BrowserService,
        private readonly productService: ProductService,
        private readonly queueService: QueueService,
    ) {}

    private log(message: string) {
        console.log(message);
        return this.logger.set({ service: 'parser', message });
    }

    private formUidName(uid: string, name: string) {
        return `${uid}_${name}`;
    }

    async onModuleInit() {
        this.enterWithQueue();
    }

    private async enterWithQueue() {
        setInterval(async () => {
            const activeJobs = await this.queueService.getActiveJobsCount();

            if (activeJobs >= 3) return;
            const availableSlots = 3 - activeJobs;
            for (let i = 0; i < availableSlots; i++) {
                await this.scheduleNextUid();
            }
        }, 10000);
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

        await Promise.all([
            page.goto(url),
            page.waitForNavigation({
                waitUntil: ['domcontentloaded'],
                timeout: 20000,
            }),
        ]);

        await this.log(`Открыл: ${url}`);
        await this.browser.rotateUserAgent();
        await this.captcha.checkCaptcha(page);
    }

    private async waitFor(page: Page, selector: string) {
        try {
            await this.log(`Жду селектор: ${selector}.`);
            await page.waitForSelector(selector, { timeout: 20000 });
            await this.log(`Успешно дождался селектора: ${selector}.`);
            return;
        } catch (error) {
            await this.browser.rotateUserAgent(true);
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

        const uidName = this.formUidName(googleRowData.uid, googleRowData.name);
        const url = googleRowData.url;

        await this.log(`Перехожу к Google Row: ${url}`);

        await this.status.set({
            type: 'googlerow',
            data: uidName,
        });

        if (url !== '---') {
            console.log('теперь тут');
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

        await this.status.set({
            type: 'googlerow',
            data: uidName,
        });

        if (url !== '---') await this.parseFullCategory(uidName, url);
        else {
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
        while (url) {
            url = await fixUrl(url);
            let page: Page | null = null;

            try {
                page = await this.browser.createPage();
                const productsOnPage = await this.parseCategoryPage(page, url);

                if (!productsOnPage) continue;

                await this.parseProducts(productsOnPage, sheetName);

                url = await this.getNextUrl(page);
            } catch (error) {
                await this.log(`Ошибка при парсинге страницы категории: ${error}`);
            } finally {
                await this.browser.closePage(page);
            }
        }
    }

    async parseCategoryPage(page: Page, url: string): Promise<ProductDto[] | null> {
        try {
            await this.openUrl(page, url);
            await this.status.set({ type: 'categorypage', data: url });
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
        let i = 0;
        const l = products.length;

        while (i < l) {
            const product = products[i];
            let page: Page | null = null;

            try {
                page = await this.browser.createPage();
                const pr = await this.getProduct(page, product.url);
                if (!pr) {
                    i++;
                    // await this.browser.rotateUserAgent(true);
                    continue;
                }

                product.name = pr.name;
                product.price = pr.price;
                product.flag = pr.flag;
                product.sheetName = sheetName;

                if (this.exchangeRate !== 0 && pr.price) {
                    const priceInPLN = pr.price;
                    product.price = parseFloat((priceInPLN / this.exchangeRate).toFixed(2));
                }

                await this.productService.saveProduct(product);

                i++;
            } catch (error) {
                await this.log(`Ошибка при парсинге продукта: ${product.url} - ${error}`);
            } finally {
                await this.browser.closePage(page);
            }
        }

        return products
            .filter(p => p.name.trim() !== '')
            .map(p => [p.externalId, p.name, p.price, p.flag, p.url]);
    }

    async getProduct(
        page: Page,
        url: string,
    ): Promise<Pick<ProductDto, 'name' | 'price' | 'flag'>> {
        try {
            await this.openUrl(page, url);

            await this.status.set({
                type: 'product',
                data: url,
            });
            const count = await page.$$eval(
                ParserConfig.productClasses.offer,
                elements => elements.length,
            );

            if (count === 0) {
                return null;
            }

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
