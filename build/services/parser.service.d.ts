import { Page } from 'puppeteer';
import { GoogleService } from './google.service';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { StatusService } from './status.service';
interface Product {
    id: string;
    name: string;
    price: string;
    flag: string;
    url: string;
}
export declare class ParserService {
    private readonly config;
    private readonly google;
    private readonly logger;
    private readonly status;
    private exchangeRate;
    private browser;
    private userAgent;
    private urlsOnUserAgents;
    private onUserAgent;
    private ms;
    private abortController;
    private isRestarting;
    constructor(config: ConfigService, google: GoogleService, logger: LoggerService, status: StatusService);
    onModuleInit(): Promise<void>;
    enter(): Promise<void>;
    restart(): Promise<void>;
    private launchBrowser;
    private closeBrowser;
    private createPage;
    private closePage;
    private solveCaptcha;
    private sleep;
    private openUrl;
    private waitFor;
    private fixUrl;
    parse(): Promise<void>;
    parseRow(sheetName: string, url: string, signal: AbortSignal): Promise<void>;
    parseCategoryPage(page: Page, url: string): Promise<Product[]>;
    parseProducts(products: Product[]): Promise<string[][]>;
    getProduct(page: Page, url: string): Promise<Omit<Product, 'id' | 'url'>>;
    getExchangeRates(): Promise<any>;
}
export {};
