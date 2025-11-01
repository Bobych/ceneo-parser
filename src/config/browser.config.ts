import { LaunchOptions } from 'puppeteer';

export const BrowserConfig: LaunchOptions = {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-webgl',
        '--disable-accelerated-2d-canvas',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--enable-unsafe-swiftshader',
    ],
    protocolTimeout: 120000,
};
