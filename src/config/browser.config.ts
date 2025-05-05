export const BrowserConfig = {
  headless: true,
  executablePath: '/usr/bin/chromium',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
    '--enable-unsafe-swiftshader',
  ],
  protocolTimeout: 120000,
  dumpio: true,
} as const;
