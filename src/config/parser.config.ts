import * as process from 'node:process';

const getRandomPort = (min = 10000, max = 10999): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const getProxyUrl = (): string => {
  const port = getRandomPort();
  const host = process.env.PROXY_HOST || 'localhost';
  return `--proxy-server=http://${host}:${port}`;
};

const getProxyAuth = (): { username: string; password: string } => ({
  username: process.env.PROXY_USER || 'localhost',
  password: process.env.PROXY_PASSWORD || '',
});

const getUserAgent = (): string => {
  const userAgents = [
    // Chrome (Windows/macOS/Linux)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',

    // Мобильные Android (Chrome/Firefox)
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',

    // iOS (Chrome/Firefox)
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/126.0 Mobile/15E148 Safari/605.1.15',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
};

export const ParserConfig = {
  proxyUrl: getProxyUrl,
  proxyAuth: getProxyAuth,
  userAgent: getUserAgent,

  categoryClasses: {
    category: '.cat-prod-row',
    name: '.cat-prod-row__name',
    url: '.cat-prod-row__name a',
  },

  productClasses: {
    name: '.product-top__title h1',
    offer: '.product-offer',
    price: '.price',
    availability: '.product-availability a',
    supplier: '.product-offer__logo img',
  },
} as const;
