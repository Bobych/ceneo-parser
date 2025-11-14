import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Page } from 'puppeteer';

import { IExchangeRate } from '@/interfaces/ExchangeRateInterface';
import formatCategoryName from '@/utils/formatCategoryName';
import { CaptchaService } from '@/captcha/captcha.service';
import { BrowserService } from '@/browser/browser.service';
import { GoogleService } from '@/google/google.service';
import { LoggerService } from '@/logger/logger.service';
import { ProductDto } from '@/parser/dto/product.dto';
import { ParserConfig } from '@/config/parser.config';
import { ProductService } from './product.service';
import { fixUrl } from '@/utils/fixUrl';
import { sleep } from '@/utils/sleep';
import { ENV } from '@/constants';

@Injectable()
export class ParserService implements OnModuleInit {
    private readonly logger: Logger;

    private exchangeRate: number = null;
    private lastDeletedSheetName: string = '';

    constructor(
        private readonly config: ConfigService,
        private readonly google: GoogleService,
        private readonly captcha: CaptchaService,
        private readonly browserService: BrowserService,
        private readonly productService: ProductService,
        private readonly loggerRedisService: LoggerService,
    ) {
        this.logger = new Logger(ParserService.name);
    }

    private async log(message: string) {
        await this.loggerRedisService.set({
            service: 'parser',
            message: message,
        });
        this.logger.log(message);
    }

    async onModuleInit() {
        this.enter();
    }

    private async enter() {
        try {
            await this.parse();
        } catch (error) {
            this.log(`Глобальная ошибка в parse(): ${error}`);
        } finally {
            setTimeout(() => this.enter(), 2000);
        }
    }

    private async openUrl(page: Page, url: string) {
        await sleep();
        this.log(`Пытаюсь открыть: ${url}`);

        await page.goto(url, {
            waitUntil: ['domcontentloaded'],
            timeout: 20000,
        });
        this.log(`Открыл: ${url}`);
        await this.captcha.checkCaptcha(page);
    }

    private async waitFor(page: Page, selector: string) {
        try {
            this.log(`Жду селектор: ${selector}.`);
            await page.waitForSelector(selector, { timeout: 20000 });
            this.log(`Успешно дождался селектора: ${selector}.`);
            return;
        } catch (error) {
            throw new Error(`Не удалось дождаться селектора ${selector} попытки. Ошибка: ${error}`);
        }
    }

    private async getNextUrl(page: Page, sourceUrl: string) {
        await this.openUrl(page, sourceUrl);
        return await page.evaluate(() => {
            const nextButton = document.querySelector('.pagination .pagination__next');
            return nextButton ? 'https://www.ceneo.pl' + nextButton.getAttribute('href') : null;
        });
    }

    async parse() {
        const googleRowData = await this.google.getLastUidRow();

        const formattedCategoryName = formatCategoryName(googleRowData.uid, googleRowData.name);
        const url = googleRowData.url;

        this.log(`Перехожу к Google Row: ${url}`);

        if (url !== '---') {
            try {
                if (this.lastDeletedSheetName !== formattedCategoryName) {
                    await this.productService.removeSheetName(formattedCategoryName);
                    this.lastDeletedSheetName = formattedCategoryName;
                }

                await this.parseFullCategory(formattedCategoryName, url);
            } catch (error) {
                this.log(`[ERROR] parser (категория не отпарсилась): ${error}`);
            }
        } else {
            try {
                await this.productService.removeSheetName(formattedCategoryName);
                await this.productService.saveProduct({
                    name: '',
                    sheetName: formattedCategoryName,
                    price: null,
                    externalId: null,
                    flag: false,
                    url: '',
                });
            } catch (error) {
                this.log(`[ERROR] Saving empty category: ${error}`);
            }
        }
        await this.google.increaseLastUid();
    }

    async parseFullCategory(sheetName: string, url: string) {
        await this.fetchExchangeRate();

        try {
            while (url) {
                url = await fixUrl(url);

                const products = await this.browserService.runTask(async page => {
                    await this.openUrl(page, url);
                    await this.waitFor(page, ParserConfig.categoryClasses.category);
                    return this.parseCategoryPage(page);
                });

                if (!products) return;

                await Promise.all(
                    products.map(product =>
                        this.browserService.runTask(async page => {
                            await this.parseProduct(page, product, sheetName);
                        }),
                    ),
                );

                url = await this.browserService.runTask(async page => {
                    return this.getNextUrl(page, url);
                });
            }
        } catch (error) {
            this.log(`[ERROR] parseFullCategory: ${error}`);
        }
    }

    async parseCategoryPage(page: Page): Promise<ProductDto[] | null> {
        try {
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
            this.log(`[ERROR] parseCategoryPage: ${error}`);
            return null;
        }
    }

    async parseProduct(page: Page, product: ProductDto, sheetName: string) {
        const pr = await this.getProduct(page, product.url);
        if (!pr) return;

        product.name = pr.name;
        product.price = pr.price;
        product.flag = pr.flag;
        product.sheetName = sheetName;

        if (this.exchangeRate && product.price)
            product.price = Number((product.price / this.exchangeRate).toFixed(2));

        await this.productService.saveProduct(product);
    }

    async getProduct(
        page: Page,
        url: string,
    ): Promise<Pick<ProductDto, 'name' | 'price' | 'flag'>> {
        try {
            await this.openUrl(page, url);

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
            this.log(`[ERROR] getProduct: ${error}`);
            return null;
        }
    }

    async fetchExchangeRate() {
        try {
            const url = this.config.get<string>(ENV.EXCHANGE_RATE_URL);
            const response = await fetch(url);
            const data: IExchangeRate = await response.json();
            const rate = data.rates[0].bid;

            this.log(`[INFO] Полученный обменный курс (bid): ${rate}`);
            this.exchangeRate = rate || null;
        } catch (error) {
            this.log(`[ERROR] fetchExchangeRate: ${error}`);
        }
    }
}
