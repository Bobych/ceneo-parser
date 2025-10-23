export interface Product {
  externalId: number;
  name: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  convertedPrice?: number;
  flag?: boolean;
  url: string;
  categoryUrl?: string;
  sheetName: string;
  exchangeRate?: number;
}
