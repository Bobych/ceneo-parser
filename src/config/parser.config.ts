import * as process from 'node:process';

const getProxyUrl = (): string => {
  const port = process.env.PROXY_PORT || '1';
  const host = process.env.PROXY_HOST || 'localhost';
  return `--proxy-server=http://${host}:${port}`;
};

const getProxyAuth = (): { username: string; password: string } => ({
  username: process.env.PROXY_USER || 'localhost',
  password: process.env.PROXY_PASSWORD || '',
});

export const ParserConfig = {
  proxyUrl: getProxyUrl,
  proxyAuth: getProxyAuth,

  categoryClasses: {
    category: '.cat-prod-row',
    name: '.cat-prod-row__name',
    url: '.cat-prod-row__name a',
  },

  productClasses: {
    offer: '.product-offer__container',
    name: '.product-top__title h1',
    price: '.product-offer__product__price .value',
    availability: '.shipmentday-container span',
    supplier: '.product-offer__logo img',
  },
} as const;
