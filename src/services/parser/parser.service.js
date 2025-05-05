"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParserService = void 0;
const common_1 = require("@nestjs/common");
const ps = __importStar(require("puppeteer-extra"));
const capmonstercloud_client_1 = require("@zennolab_com/capmonstercloud-client");
const parser_config_1 = require("@config/parser.config");
let ParserService = (() => {
    let _classDecorators = [(0, common_1.Injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var ParserService = _classThis = class {
        constructor(config, google, logger, status) {
            this.config = config;
            this.google = google;
            this.logger = logger;
            this.status = status;
            this.exchangeRate = null;
            this.browser = null;
            this.userAgent = parser_config_1.ParserConfig.userAgent();
            this.urlsOnUserAgents = 150;
            this.onUserAgent = 0;
            this.ms = 75;
            this.abortController = null;
            this.isRestarting = false;
        }
        async onModuleInit() {
            await this.enter();
        }
        async enter() {
            if (this.isRestarting) {
                await this.logger.set({
                    service: 'parser',
                    message: 'Restarting is completed.',
                });
                this.isRestarting = false;
            }
            setTimeout(async () => {
                await this.parse();
                await this.enter();
            }, 1000);
        }
        async restart() {
            if (this.abortController) {
                this.abortController.abort();
                this.isRestarting = true;
                console.log('Restart called.');
            }
            else {
                console.log('No process to restart.');
            }
        }
        async launchBrowser() {
            await this.logger.set({
                service: 'parser',
                message: 'Launching a browser...',
            });
            await this.closeBrowser();
            try {
                this.browser = await ps.default.launch(parser_config_1.ParserConfig.browserConfig);
            }
            catch (error) {
                await this.logger.set({
                    service: 'parser',
                    message: `Error by launching a browser: ${error}`,
                });
                setTimeout(() => this.launchBrowser(), 1000);
            }
        }
        async closeBrowser() {
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
                await this.logger.set({
                    service: 'parser',
                    message: 'Закрываю браузер...',
                });
            }
        }
        async createPage() {
            if (!this.browser) {
                await this.launchBrowser();
            }
            if (this.onUserAgent >= this.urlsOnUserAgents) {
                this.onUserAgent = 0;
                this.userAgent = parser_config_1.ParserConfig.userAgent();
            }
            const page = await this.browser.newPage();
            await page.setUserAgent(this.userAgent);
            this.onUserAgent += 1;
            return page;
        }
        async closePage(page) {
            if (!page.isClosed())
                await page.close();
        }
        async solveCaptcha(page) {
            const capMonster = capmonstercloud_client_1.CapMonsterCloudClientFactory.Create(new capmonstercloud_client_1.ClientOptions({
                clientKey: await this.config.get("CAPTCHA_API_TOKEN" /* ENV.CAPTCHA_API_TOKEN */),
            }));
            const siteKey = await page.$eval('.cf-turnstile', (el) => el.getAttribute('data-sitekey'));
            const task = new capmonstercloud_client_1.TurnstileProxylessRequest({
                websiteKey: siteKey,
                websiteURL: page.url(),
            });
            for (let i = 0; i < 3; i++) {
                const result = await capMonster.Solve(task);
                if (!result.error) {
                    return result.solution.token;
                }
                else {
                    await this.logger.set({
                        service: 'parser',
                        message: `Error by solving captcha: ${result.error}`,
                    });
                }
                await this.logger.set({
                    service: 'parser',
                    message: `${i + 1} try of captcha solving is failed. Error: ${result.error}`,
                });
                await this.sleep();
            }
            throw new Error(`Error by solving captcha.`);
        }
        async sleep(ms) {
            const period = ms ? ms : this.ms;
            return new Promise((resolve) => setTimeout(resolve, Math.floor(Math.random() * period) + period));
        }
        async openUrl(page, url) {
            await this.sleep();
            await this.logger.set({
                service: 'parser',
                message: `Try to open: ${url}`,
            });
            await Promise.all([
                page.goto(url),
                page.waitForNavigation({
                    waitUntil: ['domcontentloaded'],
                    timeout: 10000,
                }),
            ]);
            await this.logger.set({
                service: 'parser',
                message: `Opened: ${url}`,
            });
            if (await page.$('.cf-turnstile')) {
                try {
                    await this.logger.set({
                        service: 'parser',
                        message: 'Captcha found, solving...',
                    });
                    const captchaResponse = await this.solveCaptcha(page);
                    const dynamicId = await page.$eval('.cf-turnstile input[type="hidden"]', (el) => el.id);
                    await page.evaluate((response, dynamicId) => {
                        const input = document.getElementById(dynamicId);
                        input.value = response;
                    }, captchaResponse, dynamicId);
                    await page.click('button[type="submit"]');
                    await this.logger.set({
                        service: 'parser',
                        message: 'Captcha solved.',
                    });
                    await this.sleep(500);
                }
                catch (error) {
                    console.log(error);
                    return null;
                }
            }
        }
        async waitFor(page, selector, retries = 3) {
            let attempt = 0;
            while (attempt < retries) {
                try {
                    await this.logger.set({
                        service: 'parser',
                        message: `Trying to wait the selector ${selector}.`,
                    });
                    await page.waitForSelector(selector, { timeout: 10000 });
                    await this.logger.set({
                        service: 'parser',
                        message: `Success waiting the selector ${selector}.`,
                    });
                    return;
                }
                catch (error) {
                    attempt++;
                    await this.logger.set({
                        service: 'parser',
                        message: `Try ${attempt}: failed to wait the selector ${selector}. Error: ${error}`,
                    });
                    await page.reload();
                    if (attempt === retries) {
                        throw new Error(`Failed to wait selector ${selector} for ${retries} tries.`);
                    }
                }
            }
        }
        async fixUrl(url) {
            const hasHtm = url.endsWith('.htm');
            const hasParam = url.includes('0112-0');
            if (!hasHtm) {
                url += '.htm';
            }
            if (!hasParam) {
                url = url.replace('.htm', ';0112-0.htm');
            }
            return url;
        }
        async parse() {
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            try {
                const data = await this.google.getLastUidRow();
                const uid = `${data.uid}_${data.name}`;
                const url = data.url;
                await this.launchBrowser();
                await this.logger.set({
                    service: 'parser',
                    message: `Перехожу к Google Row: ${url}`,
                });
                await this.status.set({
                    type: 'googlerow',
                    data: uid,
                });
                await this.parseRow(uid, url, signal);
                if (!signal.aborted) {
                    await this.google.increaseLastUid();
                }
                await this.closeBrowser();
            }
            catch (error) {
                if (error.message === 'Parse aborted') {
                    console.log('Parsing was aborted');
                }
                else {
                    console.error('Error during parsing:', error);
                }
            }
            finally {
                this.abortController = null;
            }
        }
        async parseRow(sheetName, url, signal) {
            if (url === '---') {
                await this.google.insertData(sheetName, [[]]);
                return;
            }
            while (url && !signal.aborted) {
                url = await this.fixUrl(url);
                const page = await this.createPage();
                const productsOnPage = await this.parseCategoryPage(page, url);
                if (!productsOnPage) {
                    this.userAgent = parser_config_1.ParserConfig.userAgent();
                    await this.closePage(page);
                    continue;
                }
                const dataToWrite = await this.parseProducts(productsOnPage);
                await this.google.insertData(sheetName, dataToWrite);
                url = await page.evaluate(() => {
                    const nextButton = document.querySelector('.pagination .pagination__next');
                    return nextButton ? nextButton.getAttribute('href') : null;
                });
                if (url) {
                    url = 'https://www.ceneo.pl' + url;
                }
                await this.closePage(page);
            }
        }
        async parseCategoryPage(page, url) {
            try {
                await this.openUrl(page, url);
                await this.status.set({
                    type: 'categorypage',
                    data: url,
                });
                await this.waitFor(page, parser_config_1.ParserConfig.categoryClasses.category);
                await this.getExchangeRates();
                return await page.$$eval(parser_config_1.ParserConfig.categoryClasses.category, (rows, categoryClasses) => {
                    return rows
                        .map((row) => {
                        const productLink = Array.from(row.querySelectorAll(categoryClasses.url))
                            .map((a) => a.getAttribute('href') || '')
                            .find((link) => !link.startsWith('.') && !link.includes('Click')) || '';
                        if (productLink === '')
                            return null;
                        return {
                            id: productLink.slice(1),
                            name: '',
                            price: '',
                            flag: '',
                            url: `https://www.ceneo.pl${productLink}`,
                        };
                    })
                        .filter((item) => item !== null);
                }, parser_config_1.ParserConfig.categoryClasses);
            }
            catch (error) {
                await this.logger.set({
                    service: 'parser',
                    message: `${error}`,
                });
                return null;
            }
        }
        async parseProducts(products) {
            let i = 0;
            const l = products.length;
            let attempts = 0;
            while (i < l) {
                attempts++;
                const product = products[i];
                const page = await this.createPage();
                const pr = await this.getProduct(page, product.url);
                await this.closePage(page);
                if (!pr) {
                    this.userAgent = parser_config_1.ParserConfig.userAgent();
                    if (attempts >= 3) {
                        i++;
                        attempts = 0;
                    }
                    continue;
                }
                product.name = pr.name;
                product.price = pr.price;
                product.flag = pr.flag;
                if (this.exchangeRate !== 0 && pr.price) {
                    const priceInPLN = parseFloat(pr.price);
                    product.price = (priceInPLN / this.exchangeRate).toFixed(2);
                }
                attempts = 0;
                i++;
            }
            return products
                .filter((p) => p.name.trim() !== '')
                .map((p) => [p.id, p.name, p.price, p.flag, p.url]);
        }
        async getProduct(page, url) {
            try {
                await this.openUrl(page, url);
                await this.status.set({
                    type: 'product',
                    data: url,
                });
                await this.waitFor(page, parser_config_1.ParserConfig.productClasses.offer);
                const offers = await page.$$eval(parser_config_1.ParserConfig.productClasses.offer, (elements, productClasses) => {
                    const uniqueOffers = [];
                    for (const el of elements) {
                        const priceEl = el.querySelector(productClasses.price);
                        const priceText = priceEl?.textContent?.replace(/\s/g, '').replace(',', '.') || '';
                        const price = parseFloat(priceText);
                        const availabilityEl = el.querySelector(productClasses.availability);
                        const availability = availabilityEl?.textContent?.trim() || '';
                        const supplierLogo = el.querySelector(productClasses.supplier);
                        const supplierName = supplierLogo ? supplierLogo.alt : null;
                        if (uniqueOffers.some((offer) => offer.price === price && offer.supplier === supplierName)) {
                            continue;
                        }
                        uniqueOffers.push({ price, availability, supplier: supplierName });
                    }
                    return uniqueOffers
                        .filter((offer) => !isNaN(offer.price) &&
                        (offer.availability.includes('Wysyłka w 1 dzień') ||
                            offer.availability.includes('Wysyłka do 3 dni')))
                        .sort((a, b) => a.price - b.price);
                }, parser_config_1.ParserConfig.productClasses);
                const name = await page.$eval(parser_config_1.ParserConfig.productClasses.name, (el) => el.textContent?.trim() || '');
                let price = '';
                if (offers.length >= 2) {
                    price = ((offers[0].price + offers[1].price) / 2).toFixed(2);
                }
                let flag = '1';
                if (price === '') {
                    flag = '';
                }
                return {
                    name: name,
                    price: price,
                    flag: flag,
                };
            }
            catch (error) {
                await this.logger.set({
                    service: 'parser',
                    message: `${error}`,
                });
                return null;
            }
        }
        async getExchangeRates() {
            try {
                const url = this.config.get("EXCHANGE_RATE_URL" /* ENV.EXCHANGE_RATE_URL */);
                const response = await fetch(url);
                const data = await response.json();
                const rate = data.rates[0].bid;
                await this.logger.set({
                    service: 'parser',
                    message: `Полученный обменный курс (bid): ${rate}`,
                });
                this.exchangeRate = rate || null;
            }
            catch (error) {
                await this.logger.set({
                    service: 'parser',
                    message: `${error}`,
                });
                return null;
            }
        }
    };
    __setFunctionName(_classThis, "ParserService");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        ParserService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return ParserService = _classThis;
})();
exports.ParserService = ParserService;
