export const BrowserConfig = {
    headless: 'new',
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
        '--no-first-run',
        '--single-process',
    ],
    protocolTimeout: 120000,
};
