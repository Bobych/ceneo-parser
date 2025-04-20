export const BrowserConfig = {
  headless: true,
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--single-process',
    '--no-zygote',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--blink-settings=imagesEnabled=false',
    '--window-size=1920,1080',
  ],
  protocolTimeout: 120000,
} as const;
